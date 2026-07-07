-- =============================================================================
-- 0008_harden_function_privileges.sql
-- Hardening post-auditoria de Fase 1.
--
-- Objetivo:
-- - Cerrar ejecucion publica de funciones/RPC backend.
-- - Cerrar privilegios publicos sobre redsys_order_seq.
-- - Fijar search_path en funciones propias de Fase 1.
-- - Revocar ejecucion publica de rls_auto_enable() sin borrar la funcion
--   ni el event trigger ensure_rls.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Funciones/RPC backend: solo service_role.
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.decrement_stock_and_confirm_order(uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_stock_and_confirm_order(uuid, jsonb)
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.generate_redsys_ds_order()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_redsys_ds_order()
  TO service_role;

REVOKE EXECUTE ON FUNCTION public.suggest_product_label_fields()
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.suggest_product_label_fields()
  TO service_role;

-- ---------------------------------------------------------------------------
-- redsys_order_seq: no debe poder usarse ni avanzarse desde anon/authenticated.
-- ---------------------------------------------------------------------------
REVOKE ALL ON SEQUENCE public.redsys_order_seq
  FROM PUBLIC, anon, authenticated;
GRANT USAGE, SELECT, UPDATE ON SEQUENCE public.redsys_order_seq
  TO service_role;

-- ---------------------------------------------------------------------------
-- rls_auto_enable(): mantener funcion y event trigger, cerrar ejecucion publica.
-- No se modifica su search_path porque ya usa search_path=pg_catalog.
-- ---------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.rls_auto_enable()
  FROM PUBLIC, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Fijar search_path en funciones propias de Fase 1.
-- ---------------------------------------------------------------------------
ALTER FUNCTION public.decrement_stock_and_confirm_order(uuid, jsonb)
  SET search_path = public, pg_temp;

ALTER FUNCTION public.generate_redsys_ds_order()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.suggest_product_label_fields()
  SET search_path = public, pg_temp;
