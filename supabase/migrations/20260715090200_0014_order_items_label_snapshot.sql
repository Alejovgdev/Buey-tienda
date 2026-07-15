-- =============================================================================
-- 0014_order_items_label_snapshot.sql
-- Sistema de etiquetado alimentario, Unidad 3: snapshot legal completo en
-- order_items. Hoy solo se congela allergens_snapshot/allergens_notes_snapshot
-- (0001) — el resto de datos legales se leería en vivo de products, lo que
-- rompería el etiquetado de pedidos antiguos si el catálogo cambia después.
-- Ver docs/FOOD_LABEL_ADMIN_DESIGN.md, §6.4 y §7.
--
-- Todas las columnas quedan NULLABLE: las líneas de pedido creadas antes de
-- esta migración no tienen estos datos y no se backfillean con datos "en
-- vivo" de products (eso sería exactamente el problema que se quiere evitar).
-- La capa de aplicación debe tratar un snapshot NULL como "dato no congelado,
-- verificar manualmente", nunca sustituirlo en silencio (§14 del diseño).
-- =============================================================================

ALTER TABLE order_items
  ADD COLUMN ingredients_snapshot            TEXT,
  ADD COLUMN storage_conditions_snapshot     TEXT,
  ADD COLUMN prep_instructions_snapshot      TEXT,
  ADD COLUMN cooking_method_snapshot         TEXT,
  ADD COLUMN country_of_origin_snapshot      TEXT,
  ADD COLUMN label_display_name_snapshot     TEXT,
  ADD COLUMN usual_units_per_package_snapshot INT,
  ADD COLUMN suggested_package_count_snapshot INT,
  ADD COLUMN label_profile_id_snapshot       UUID REFERENCES label_profiles(id),
  -- Copia congelada de las reglas del perfil en el momento del pedido (campos
  -- visibles/obligatorios/bloqueantes, tipo de fecha, textos fijos...) para
  -- que una edición posterior de label_profiles no altere pedidos ya hechos.
  -- label_profile_id_snapshot es solo informativo/para JOINs cuando el perfil
  -- todavía existe; esta columna JSONB es la que manda.
  ADD COLUMN label_profile_snapshot          JSONB;
