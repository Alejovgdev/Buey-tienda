-- =============================================================================
-- 20260705082241_order_number_generator.sql
-- Fase 4, Unidad 2. Genera order_number ("BM-2026-00001") de forma atomica,
-- igual patron que generate_redsys_ds_order (seccion 15) - contar filas en JS
-- antes del INSERT seria una condicion de carrera real bajo concurrencia.
-- Hardening (search_path, privilegios) aplicado directamente, calcado de
-- 0008_harden_function_privileges.sql.
-- =============================================================================

CREATE SEQUENCE IF NOT EXISTS order_number_seq START 1;

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT
LANGUAGE sql
AS $$
  SELECT 'BM-' || to_char(CURRENT_DATE, 'YYYY') || '-' || LPAD(nextval('order_number_seq')::TEXT, 5, '0');
$$;
-- Resultado: "BM-2026-00001", "BM-2026-00002", ...

REVOKE EXECUTE ON FUNCTION public.generate_order_number()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_order_number()
  TO service_role;

ALTER FUNCTION public.generate_order_number()
  SET search_path = public, pg_temp;

REVOKE ALL ON SEQUENCE public.order_number_seq
  FROM PUBLIC, anon, authenticated;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE public.order_number_seq
  TO service_role;
