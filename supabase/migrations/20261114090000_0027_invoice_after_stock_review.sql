-- =============================================================================
-- 0027_invoice_after_stock_review.sql
-- Paso 6: factura de un pedido que se cobró pero se quedó en «Error de stock»
-- y el admin ha resuelto pasándolo a «Preparando».
--
-- Problema: en ese caso el banco cobró y el pago está guardado como
-- 'succeeded' (con su paid_at en payments), pero orders.paid_at se queda NULL,
-- porque la RPC de pago solo lo rellena cuando todo sale bien (migración
-- 0023). issue_simplified_invoice exigía orders.paid_at y respondía
-- PEDIDO_NO_PAGADO aunque el cobro existiera.
--
-- Cambio (solo en la comprobación de pago y en la fecha de operación):
-- - Sigue haciendo falta un pago 'succeeded' por el importe exacto del pedido.
-- - Además: o bien orders.paid_at está relleno (camino normal, sin cambios),
--   o bien el pedido está en PREPARING (revisión resuelta por el admin).
--   Un pedido en STOCK_ERROR, NEEDS_REVIEW o CANCELLED sin orders.paid_at no
--   se factura: responde PEDIDO_EN_REVISION.
-- - Fecha de operación: orders.paid_at y, si falta, payments.paid_at (el
--   momento real del cobro).
--
-- No se tocan: numeración, copia de datos, idempotencia, privilegios (CREATE
-- OR REPLACE conserva los GRANT de la 0025) ni la RPC de pago. orders.paid_at
-- sigue significando «pago y stock confirmados a la vez».
-- =============================================================================

CREATE OR REPLACE FUNCTION public.issue_simplified_invoice(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order          orders%ROWTYPE;
  v_existing       invoices%ROWTYPE;
  v_settings       shop_settings%ROWTYPE;
  v_payment_paid   timestamptz;
  v_operation_ts   timestamptz;
  v_tax_id         text;
  v_issued_at      timestamptz := now();
  v_issue_date     date;
  v_year           int;
  v_number         int;
  v_invoice_number text;
  v_lines          jsonb;
  v_breakdown      jsonb;
  v_invoice_id     uuid;
BEGIN
  -- Bloquear el pedido serializa dos avisos simultáneos del mismo pago.
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PEDIDO_NO_ENCONTRADO');
  END IF;

  SELECT * INTO v_existing
  FROM invoices
  WHERE order_id = p_order_id AND invoice_type = 'SIMPLIFIED';
  IF FOUND THEN
    RETURN jsonb_build_object('ok', true, 'already_issued', true,
      'invoice_id', v_existing.id, 'invoice_number', v_existing.invoice_number);
  END IF;

  -- Cobro confirmado por el importe del pedido.
  SELECT paid_at INTO v_payment_paid
  FROM payments
  WHERE order_id = p_order_id AND status = 'succeeded' AND amount = v_order.total;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PEDIDO_NO_PAGADO');
  END IF;

  -- Pago y stock confirmados (camino normal) o revisión resuelta por el admin.
  IF v_order.paid_at IS NULL AND v_order.status <> 'PREPARING' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PEDIDO_EN_REVISION');
  END IF;

  v_operation_ts := coalesce(v_order.paid_at, v_payment_paid);
  IF v_operation_ts IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PEDIDO_NO_PAGADO');
  END IF;

  -- Copia del IVA guardada al crear el pedido (paso 3). Los pedidos anteriores
  -- no la tienen y no se facturan por esta vía.
  IF v_order.tax_base_total IS NULL OR v_order.vat_total IS NULL
     OR v_order.shipping_tax_base IS NULL
     OR EXISTS (SELECT 1 FROM order_items WHERE order_id = p_order_id AND tax_base IS NULL) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PEDIDO_SIN_IVA');
  END IF;

  SELECT * INTO v_settings FROM shop_settings WHERE singleton = true;
  v_tax_id := upper(regexp_replace(coalesce(v_settings.operator_tax_id, ''), '[^A-Za-z0-9]', '', 'g'));
  IF coalesce(btrim(v_settings.operator_legal_name), '') = ''
     OR v_tax_id = ''
     OR coalesce(btrim(v_settings.operator_address), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'DATOS_EMPRESA_INCOMPLETOS');
  END IF;

  -- Líneas: productos y regalos en el orden del pedido; el envío al final
  -- solo si se cobró.
  SELECT jsonb_agg(line ORDER BY sort_key, idx)
  INTO v_lines
  FROM (
    SELECT 0 AS sort_key,
           row_number() OVER (ORDER BY (oi.item_type = 'GIFT'), oi.product_name_snapshot, oi.variant_name_snapshot, oi.id) AS idx,
           jsonb_build_object(
             'type', oi.item_type,
             'description', oi.product_name_snapshot || ' — ' || oi.variant_name_snapshot,
             'quantity', oi.quantity,
             'unit_price', oi.unit_price_snapshot,
             'line_total', oi.line_total,
             'vat_rate', oi.vat_rate,
             'tax_base', oi.tax_base,
             'vat_amount', oi.vat_amount
           ) AS line
    FROM order_items oi
    WHERE oi.order_id = p_order_id
    UNION ALL
    SELECT 1, 1,
           jsonb_build_object(
             'type', 'SHIPPING',
             'description', 'Gastos de envío',
             'quantity', 1,
             'unit_price', v_order.shipping_cost,
             'line_total', v_order.shipping_cost,
             'vat_rate', v_order.shipping_vat_rate,
             'tax_base', v_order.shipping_tax_base,
             'vat_amount', v_order.shipping_vat_amount
           )
    WHERE v_order.shipping_cost > 0
  ) l;

  -- Desglose por tipo de IVA (las líneas a 0 € no tienen tipo y no cuentan).
  SELECT coalesce(jsonb_agg(jsonb_build_object(
           'vat_rate', vat_rate, 'tax_base', tax_base, 'vat_amount', vat_amount
         ) ORDER BY vat_rate), '[]'::jsonb)
  INTO v_breakdown
  FROM (
    SELECT (l->>'vat_rate')::numeric AS vat_rate,
           sum((l->>'tax_base')::int)::int AS tax_base,
           sum((l->>'vat_amount')::int)::int AS vat_amount
    FROM jsonb_array_elements(v_lines) l
    WHERE l->>'vat_rate' IS NOT NULL
    GROUP BY 1
  ) b;

  -- La copia de líneas tiene que cuadrar con los totales del pedido.
  IF (SELECT sum((l->>'tax_base')::int) FROM jsonb_array_elements(v_lines) l) IS DISTINCT FROM v_order.tax_base_total
     OR (SELECT sum((l->>'vat_amount')::int) FROM jsonb_array_elements(v_lines) l) IS DISTINCT FROM v_order.vat_total
     OR v_order.tax_base_total + v_order.vat_total <> v_order.total THEN
    RETURN jsonb_build_object('ok', false, 'error', 'TOTALES_INCOHERENTES');
  END IF;

  -- Número sin huecos: la fila del contador queda bloqueada hasta el final de
  -- la transacción; un fallo posterior deshace también el incremento.
  v_issue_date := public.madrid_date(v_issued_at);
  v_year := extract(year FROM v_issue_date)::int;

  INSERT INTO invoice_counters AS c (series, year, last_number)
  VALUES ('T', v_year, 1)
  ON CONFLICT (series, year) DO UPDATE SET last_number = c.last_number + 1
  RETURNING c.last_number INTO v_number;

  v_invoice_number := 'T' || v_year::text || '-' || lpad(v_number::text, greatest(4, length(v_number::text)), '0');

  INSERT INTO invoices (
    invoice_type, series, year, number, invoice_number, order_id,
    issued_at, issue_date, operation_date,
    issuer_legal_name, issuer_tax_id, issuer_address, issuer_country,
    customer_name,
    lines, vat_breakdown, tax_base_total, vat_total, total
  ) VALUES (
    'SIMPLIFIED', 'T', v_year, v_number, v_invoice_number, p_order_id,
    v_issued_at, v_issue_date, public.madrid_date(v_operation_ts),
    btrim(v_settings.operator_legal_name), v_tax_id, btrim(v_settings.operator_address), v_settings.operator_country,
    btrim(v_order.customer_name || ' ' || v_order.customer_last_name),
    v_lines, v_breakdown, v_order.tax_base_total, v_order.vat_total, v_order.total
  )
  RETURNING id INTO v_invoice_id;

  RETURN jsonb_build_object('ok', true, 'already_issued', false,
    'invoice_id', v_invoice_id, 'invoice_number', v_invoice_number);
END;
$$;

-- Por si acaso: mismos privilegios que en la 0025.
REVOKE EXECUTE ON FUNCTION public.issue_simplified_invoice(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_simplified_invoice(uuid) TO service_role;
