-- =============================================================================
-- 0025_invoices.sql
-- Paso 4: numeración y tabla de facturas.
--
-- - Series: T (simplificadas y completas) y R (rectificativas), reiniciadas
--   cada año: T2026-0001, R2026-0001…
-- - Sin huecos: no se usa SEQUENCE. El número sale de invoice_counters, cuya
--   fila se bloquea y se incrementa en la misma transacción que inserta la
--   factura; si algo falla, el incremento se deshace con todo lo demás.
-- - Año y fechas en hora de España (Europe/Madrid).
-- - Las facturas son inmutables: ni UPDATE ni DELETE ni TRUNCATE. El estado
--   «sustituida» no se guarda en la simplificada: se deduce de que una factura
--   completa apunte a ella (vista invoices_with_status).
-- - En este paso solo se emiten simplificadas, al confirmarse el pago
--   (issue_simplified_invoice). La tabla ya admite completas y rectificativas.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Fecha en hora de España. STABLE (no IMMUTABLE) porque depende de las reglas
-- de zona horaria del servidor.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.madrid_date(p_ts timestamptz)
RETURNS date
LANGUAGE sql
STABLE
SET search_path = public, pg_temp
AS $$ SELECT (p_ts AT TIME ZONE 'Europe/Madrid')::date $$;

-- ---------------------------------------------------------------------------
-- invoice_counters: último número emitido por serie y año.
-- ---------------------------------------------------------------------------
CREATE TABLE invoice_counters (
  series      TEXT NOT NULL CHECK (series IN ('T', 'R')),
  year        INT  NOT NULL CHECK (year BETWEEN 2000 AND 2999),
  last_number INT  NOT NULL CHECK (last_number >= 1),
  PRIMARY KEY (series, year)
);

-- ---------------------------------------------------------------------------
-- invoices
-- ---------------------------------------------------------------------------
CREATE TABLE invoices (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_type         TEXT        NOT NULL CHECK (invoice_type IN ('SIMPLIFIED', 'FULL', 'CORRECTIVE')),
  series               TEXT        NOT NULL CHECK (series IN ('T', 'R')),
  year                 INT         NOT NULL,
  number               INT         NOT NULL CHECK (number >= 1),
  invoice_number       TEXT        NOT NULL UNIQUE,          -- "T2026-0001"
  order_id             UUID        NOT NULL REFERENCES orders(id),

  issued_at            TIMESTAMPTZ NOT NULL DEFAULT now(),   -- momento de expedición
  issue_date           DATE        NOT NULL,                 -- fecha de factura (Madrid)
  operation_date       DATE        NOT NULL,                 -- fecha del pago (Madrid)

  -- Completa que sustituye a una simplificada / rectificativa y su original.
  replaces_invoice_id  UUID        REFERENCES invoices(id),
  rectifies_invoice_id UUID        REFERENCES invoices(id),
  correction_reason    TEXT,

  -- Copia de los datos del emisor en el momento de emitir.
  issuer_legal_name    TEXT        NOT NULL,
  issuer_tax_id        TEXT        NOT NULL,                 -- sin guiones: "B24770836"
  issuer_address       TEXT        NOT NULL,
  issuer_country       TEXT        NOT NULL,

  -- Destinatario: opcional en la simplificada, obligatorio en la completa.
  customer_name        TEXT,
  customer_tax_id      TEXT,
  customer_address     TEXT,

  -- Copia de líneas (productos, regalos y envío) y desglose por tipo de IVA.
  lines                JSONB       NOT NULL CHECK (jsonb_typeof(lines) = 'array' AND jsonb_array_length(lines) > 0),
  vat_breakdown        JSONB       NOT NULL CHECK (jsonb_typeof(vat_breakdown) = 'array'),

  -- Totales en céntimos.
  tax_base_total       INT         NOT NULL,
  vat_total            INT         NOT NULL,
  total                INT         NOT NULL,
  currency             TEXT        NOT NULL DEFAULT 'EUR',

  CONSTRAINT invoices_number_unique UNIQUE (series, year, number),
  CONSTRAINT invoices_number_format CHECK (
    invoice_number = series || year::text || '-' || lpad(number::text, greatest(4, length(number::text)), '0')
  ),
  CONSTRAINT invoices_year_matches_issue_date CHECK (year = extract(year FROM issue_date)::int),
  CONSTRAINT invoices_series_by_type CHECK (
    (invoice_type IN ('SIMPLIFIED', 'FULL') AND series = 'T')
    OR (invoice_type = 'CORRECTIVE' AND series = 'R')
  ),
  CONSTRAINT invoices_replaces_only_full CHECK (replaces_invoice_id IS NULL OR invoice_type = 'FULL'),
  CONSTRAINT invoices_rectifies_only_corrective CHECK (
    (invoice_type = 'CORRECTIVE') = (rectifies_invoice_id IS NOT NULL)
    AND (correction_reason IS NULL OR invoice_type = 'CORRECTIVE')
  ),
  CONSTRAINT invoices_full_has_customer CHECK (
    invoice_type <> 'FULL'
    OR (customer_name IS NOT NULL AND customer_tax_id IS NOT NULL AND customer_address IS NOT NULL)
  ),
  CONSTRAINT invoices_totals_consistent CHECK (tax_base_total + vat_total = total)
);

-- Como mucho una simplificada por pedido, y cada factura se sustituye una vez.
CREATE UNIQUE INDEX invoices_one_simplified_per_order
  ON invoices(order_id) WHERE invoice_type = 'SIMPLIFIED';
CREATE UNIQUE INDEX invoices_replaced_once
  ON invoices(replaces_invoice_id) WHERE replaces_invoice_id IS NOT NULL;
CREATE INDEX invoices_order_id_idx ON invoices(order_id);
CREATE INDEX invoices_rectifies_idx ON invoices(rectifies_invoice_id) WHERE rectifies_invoice_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Inmutabilidad: además de los privilegios, un trigger rechaza cualquier
-- modificación o borrado, venga del rol que venga.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.invoices_reject_changes()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'Las facturas no se pueden modificar ni borrar (%).', TG_OP
    USING ERRCODE = 'restrict_violation';
END;
$$;

CREATE TRIGGER invoices_no_update_delete
  BEFORE UPDATE OR DELETE ON invoices
  FOR EACH ROW EXECUTE FUNCTION public.invoices_reject_changes();

CREATE TRIGGER invoices_no_truncate
  BEFORE TRUNCATE ON invoices
  FOR EACH STATEMENT EXECUTE FUNCTION public.invoices_reject_changes();

-- ---------------------------------------------------------------------------
-- Estado calculado: SUSTITUIDA si una completa la sustituye, RECTIFICADA si
-- tiene alguna rectificativa, EMITIDA en otro caso.
-- ---------------------------------------------------------------------------
CREATE VIEW invoices_with_status
WITH (security_invoker = true)
AS
SELECT
  i.*,
  CASE
    WHEN EXISTS (SELECT 1 FROM invoices f WHERE f.replaces_invoice_id = i.id) THEN 'SUSTITUIDA'
    WHEN EXISTS (SELECT 1 FROM invoices r WHERE r.rectifies_invoice_id = i.id) THEN 'RECTIFICADA'
    ELSE 'EMITIDA'
  END AS status
FROM invoices i;

-- ---------------------------------------------------------------------------
-- Privilegios: la aplicación (service_role) solo puede LEER. Las facturas y
-- los contadores solo se escriben a través de issue_simplified_invoice.
-- ---------------------------------------------------------------------------
ALTER TABLE invoice_counters ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON invoice_counters, invoices, invoices_with_status FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON invoice_counters, invoices, invoices_with_status TO service_role;

REVOKE EXECUTE ON FUNCTION public.invoices_reject_changes() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.madrid_date(timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.madrid_date(timestamptz) TO service_role;

-- ---------------------------------------------------------------------------
-- issue_simplified_invoice: emite la simplificada de un pedido pagado.
-- Idempotente: si ya existe, la devuelve sin crear otra.
-- SECURITY DEFINER para poder escribir en tablas en las que service_role
-- solo tiene SELECT.
-- ---------------------------------------------------------------------------
CREATE FUNCTION public.issue_simplified_invoice(p_order_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_order          orders%ROWTYPE;
  v_existing       invoices%ROWTYPE;
  v_settings       shop_settings%ROWTYPE;
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

  -- Solo pedidos con el pago confirmado y cobrado por el importe del pedido.
  IF v_order.paid_at IS NULL OR NOT EXISTS (
    SELECT 1 FROM payments
    WHERE order_id = p_order_id AND status = 'succeeded' AND amount = v_order.total
  ) THEN
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
    v_issued_at, v_issue_date, public.madrid_date(v_order.paid_at),
    btrim(v_settings.operator_legal_name), v_tax_id, btrim(v_settings.operator_address), v_settings.operator_country,
    btrim(v_order.customer_name || ' ' || v_order.customer_last_name),
    v_lines, v_breakdown, v_order.tax_base_total, v_order.vat_total, v_order.total
  )
  RETURNING id INTO v_invoice_id;

  RETURN jsonb_build_object('ok', true, 'already_issued', false,
    'invoice_id', v_invoice_id, 'invoice_number', v_invoice_number);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.issue_simplified_invoice(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.issue_simplified_invoice(uuid) TO service_role;
