-- =============================================================================
-- 0018_label_tables_rls.sql
-- Sistema de etiquetado alimentario, Unidad 7: RLS de las tablas nuevas.
-- Mismo patrón que 0004_rls_policies.sql: RLS activado sin ninguna política
-- pública = deny por defecto para anon/authenticated. El backend admin accede
-- siempre con supabaseAdmin (service_role), que bypassa RLS — igual que ya
-- ocurre con orders, order_items, payments, order_status_history y
-- product_labels. Ver docs/FOOD_LABEL_ADMIN_DESIGN.md, §13.
-- =============================================================================

ALTER TABLE label_profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE label_print_events  ENABLE ROW LEVEL SECURITY;

-- Sin políticas para anon/authenticated en ninguna de las dos — ninguna se
-- consulta desde el frontend público, solo desde el panel admin (service_role).
