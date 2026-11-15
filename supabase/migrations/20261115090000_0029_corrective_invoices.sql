-- =============================================================================
-- 0029_corrective_invoices.sql
-- Paso 8: facturas rectificativas (serie R).
--
-- - Se emiten desde el panel con issue_corrective_invoice, en una sola
--   transacción: número sin huecos (contador R por año, como la T), factura
--   y evento en el historial del pedido. Si algo falla no queda nada.
-- - Rectifican la factura vigente del pedido (la simplificada T: la tienda no
--   emite completas) y guardan su referencia en rectifies_invoice_id.
-- - Dos tipos:
--     TOTAL:   devuelve todo lo que quede por rectificar (envío incluido).
--     PARTIAL: devuelve un importe con IVA incluido; base e IVA se calculan
--              con el tipo de IVA de la factura original.
-- - Importes en negativo y una sola línea: «Devolución total» o
--   «Devolución parcial: <motivo>».
-- - Tope: la suma de las rectificativas nunca supera la factura original.
-- - request_id: el mismo id de petición devuelve la misma rectificativa
--   (un doble clic no crea dos).
-- - No devuelve el dinero: la devolución se hace a mano en el TPV de Redsys.
-- =============================================================================

ALTER TABLE invoices ADD COLUMN request_id UUID;

CREATE UNIQUE INDEX invoices_request_id_unique
  ON invoices(request_id) WHERE request_id IS NOT NULL;

ALTER TABLE invoices ADD CONSTRAINT invoices_request_id_only_corrective
  CHECK (request_id IS NULL OR invoice_type = 'CORRECTIVE');

-- La vista invoices_with_status no cambia: la rectificada pasa a
-- «Rectificada» sola. No muestra request_id (se fijó i.* al crearla en la
-- 0025) y no le hace falta.

-- ---------------------------------------------------------------------------
-- issue_corrective_invoice
--   p_kind       'TOTAL' | 'PARTIAL'
--   p_amount     céntimos (IVA incluido), positivo; solo para PARTIAL
--   p_reason     motivo obligatorio (1–300 caracteres)
--   p_request_id id de la petición (UUID), obligatorio
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.issue_corrective_invoice(
  p_order_id   uuid,
  p_kind       text,
  p_amount     int,
  p_reason     text,
  p_request_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order          orders%ROWTYPE;
  v_original       invoices%ROWTYPE;
  v_existing       invoices%ROWTYPE;
  v_settings       shop_settings%ROWTYPE;
  v_tax_id         text;
  v_reason         text := btrim(coalesce(p_reason, ''));
  v_done_total     int;
  v_done_base      int;
  v_done_vat       int;
  v_left_total     int;
  v_left_base      int;
  v_left_vat       int;
  v_rate_count     int;
  v_rate           numeric;
  v_amount         int;
  v_base           int;
  v_vat            int;
  v_description    text;
  v_breakdown      jsonb;
  v_issued_at      timestamptz := now();
  v_issue_date     date;
  v_year           int;
  v_number         int;
  v_invoice_number text;
  v_invoice_id     uuid;
BEGIN
  IF p_request_id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PETICION_NO_VALIDA');
  END IF;
  IF p_kind IS NULL OR p_kind NOT IN ('TOTAL', 'PARTIAL') THEN
    RETURN jsonb_build_object('ok', false, 'error', 'TIPO_NO_VALIDO');
  END IF;

  -- Bloquear el pedido serializa dos rectificativas simultáneas del mismo
  -- pedido: la segunda ve lo que ya ha emitido la primera.
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PEDIDO_NO_ENCONTRADO');
  END IF;

  -- Repetición de la misma petición (doble clic o reintento): misma factura.
  SELECT * INTO v_existing FROM invoices WHERE request_id = p_request_id;
  IF FOUND THEN
    IF v_existing.order_id <> p_order_id THEN
      RETURN jsonb_build_object('ok', false, 'error', 'PETICION_NO_VALIDA');
    END IF;
    RETURN jsonb_build_object('ok', true, 'already_issued', true,
      'invoice_id', v_existing.id, 'invoice_number', v_existing.invoice_number,
      'total', v_existing.total);
  END IF;

  IF v_reason = '' OR length(v_reason) > 300 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'MOTIVO_NO_VALIDO');
  END IF;

  -- Factura vigente: la última simplificada o completa que no ha sido
  -- sustituida. Hoy siempre es la simplificada T.
  SELECT * INTO v_original
  FROM invoices i
  WHERE i.order_id = p_order_id
    AND i.invoice_type IN ('SIMPLIFIED', 'FULL')
    AND NOT EXISTS (SELECT 1 FROM invoices s WHERE s.replaces_invoice_id = i.id)
  ORDER BY i.issued_at DESC
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'SIN_FACTURA');
  END IF;

  -- Lo ya rectificado (en negativo) y lo que queda.
  SELECT coalesce(sum(total), 0), coalesce(sum(tax_base_total), 0), coalesce(sum(vat_total), 0)
  INTO v_done_total, v_done_base, v_done_vat
  FROM invoices
  WHERE rectifies_invoice_id = v_original.id;

  v_left_total := v_original.total + v_done_total;
  v_left_base  := v_original.tax_base_total + v_done_base;
  v_left_vat   := v_original.vat_total + v_done_vat;
  IF v_left_total <= 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'NADA_QUE_DEVOLVER');
  END IF;

  SELECT count(*), min((b->>'vat_rate')::numeric)
  INTO v_rate_count, v_rate
  FROM jsonb_array_elements(v_original.vat_breakdown) b;

  IF p_kind = 'TOTAL' THEN
    -- Todo lo que falta, exacto al céntimo.
    v_amount := v_left_total;
    v_base := v_left_base;
    v_vat := v_left_vat;
    v_description := 'Devolución total';
  ELSE
    IF p_amount IS NULL OR p_amount <= 0 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'IMPORTE_NO_VALIDO');
    END IF;
    IF p_amount > v_left_total THEN
      RETURN jsonb_build_object('ok', false, 'error', 'IMPORTE_SUPERA_FACTURA',
        'remaining', v_left_total);
    END IF;
    -- Con un solo tipo de IVA se sabe qué parte del importe es IVA. Con
    -- varios no, y se rechaza en vez de calcularlo mal.
    IF v_rate_count <> 1 THEN
      RETURN jsonb_build_object('ok', false, 'error', 'VARIOS_TIPOS_IVA');
    END IF;

    v_amount := p_amount;
    IF v_amount = v_left_total THEN
      -- Si cubre todo lo que queda, se cierra exacto, igual que la total.
      v_base := v_left_base;
      v_vat := v_left_vat;
    ELSE
      v_base := round(v_amount * 100 / (100 + v_rate))::int;
      -- Los redondeos acumulados nunca pueden pasar de la base o del IVA que
      -- quedan por rectificar.
      v_base := least(v_base, v_left_base);
      v_vat := v_amount - v_base;
      IF v_vat > v_left_vat THEN
        v_vat := v_left_vat;
        v_base := v_amount - v_vat;
      END IF;
    END IF;
    v_description := 'Devolución parcial: ' || v_reason;
  END IF;

  -- Desglose por tipo de IVA en negativo. Con un solo tipo, una fila. Una
  -- total sobre una factura con varios tipos devuelve lo que queda de cada uno.
  IF v_rate_count = 1 THEN
    v_breakdown := jsonb_build_array(jsonb_build_object(
      'vat_rate', v_rate, 'tax_base', -v_base, 'vat_amount', -v_vat));
  ELSE
    SELECT coalesce(jsonb_agg(jsonb_build_object(
             'vat_rate', o.vat_rate,
             'tax_base', -(o.tax_base + coalesce(d.tax_base, 0)),
             'vat_amount', -(o.vat_amount + coalesce(d.vat_amount, 0))
           ) ORDER BY o.vat_rate), '[]'::jsonb)
    INTO v_breakdown
    FROM (
      SELECT (b->>'vat_rate')::numeric AS vat_rate, (b->>'tax_base')::int AS tax_base, (b->>'vat_amount')::int AS vat_amount
      FROM jsonb_array_elements(v_original.vat_breakdown) b
    ) o
    LEFT JOIN (
      SELECT (b->>'vat_rate')::numeric AS vat_rate, sum((b->>'tax_base')::int)::int AS tax_base, sum((b->>'vat_amount')::int)::int AS vat_amount
      FROM invoices r, jsonb_array_elements(r.vat_breakdown) b
      WHERE r.rectifies_invoice_id = v_original.id
      GROUP BY 1
    ) d ON d.vat_rate = o.vat_rate;
  END IF;

  SELECT * INTO v_settings FROM shop_settings WHERE singleton = true;
  v_tax_id := upper(regexp_replace(coalesce(v_settings.operator_tax_id, ''), '[^A-Za-z0-9]', '', 'g'));
  IF coalesce(btrim(v_settings.operator_legal_name), '') = ''
     OR v_tax_id = ''
     OR coalesce(btrim(v_settings.operator_address), '') = '' THEN
    RETURN jsonb_build_object('ok', false, 'error', 'DATOS_EMPRESA_INCOMPLETOS');
  END IF;

  -- Número sin huecos en la serie R (mismo mecanismo que la T).
  v_issue_date := public.madrid_date(v_issued_at);
  v_year := extract(year FROM v_issue_date)::int;

  INSERT INTO invoice_counters AS c (series, year, last_number)
  VALUES ('R', v_year, 1)
  ON CONFLICT (series, year) DO UPDATE SET last_number = c.last_number + 1
  RETURNING c.last_number INTO v_number;

  v_invoice_number := 'R' || v_year::text || '-' || lpad(v_number::text, greatest(4, length(v_number::text)), '0');

  INSERT INTO invoices (
    invoice_type, series, year, number, invoice_number, order_id,
    issued_at, issue_date, operation_date,
    rectifies_invoice_id, correction_reason, request_id,
    issuer_legal_name, issuer_tax_id, issuer_address, issuer_country,
    customer_name,
    lines, vat_breakdown, tax_base_total, vat_total, total
  ) VALUES (
    'CORRECTIVE', 'R', v_year, v_number, v_invoice_number, p_order_id,
    v_issued_at, v_issue_date, v_original.operation_date,
    v_original.id, v_reason, p_request_id,
    btrim(v_settings.operator_legal_name), v_tax_id, btrim(v_settings.operator_address), v_settings.operator_country,
    v_original.customer_name,
    jsonb_build_array(jsonb_build_object(
      'type', 'CORRECTION',
      'description', v_description,
      'quantity', 1,
      'unit_price', -v_amount,
      'line_total', -v_amount,
      'vat_rate', CASE WHEN v_rate_count = 1 THEN v_rate END,
      'tax_base', -v_base,
      'vat_amount', -v_vat
    )),
    v_breakdown, -v_base, -v_vat, -v_amount
  )
  RETURNING id INTO v_invoice_id;

  -- En la misma transacción: si no se puede apuntar, no hay factura.
  INSERT INTO order_status_history (order_id, event_type, notes, metadata)
  VALUES (
    p_order_id,
    'FACTURA_RECTIFICATIVA_EMITIDA',
    v_invoice_number || ' rectifica ' || v_original.invoice_number
      || ' (' || CASE WHEN p_kind = 'TOTAL' THEN 'total' ELSE 'parcial' END || ', -'
      || replace(to_char(v_amount / 100.0, 'FM9999990.00'), '.', ',') || ' €): ' || v_reason,
    jsonb_build_object(
      'invoice_number', v_invoice_number,
      'rectifies', v_original.invoice_number,
      'kind', p_kind,
      'amount', v_amount,
      'reason', v_reason
    )
  );

  RETURN jsonb_build_object('ok', true, 'already_issued', false,
    'invoice_id', v_invoice_id, 'invoice_number', v_invoice_number,
    'total', -v_amount);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.issue_corrective_invoice(uuid, text, int, text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_corrective_invoice(uuid, text, int, text, uuid) TO service_role;
