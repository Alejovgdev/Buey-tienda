-- =============================================================================
-- 0013_products_shop_settings_labels.sql
-- Sistema de etiquetado alimentario, Unidad 2: configuración por producto y
-- datos del operador alimentario. Ver docs/FOOD_LABEL_ADMIN_DESIGN.md, §6.1-6.2.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- products — perfil de etiquetado y configuración de envasado.
-- Reutiliza ingredients/allergens/storage_conditions/prep_instructions/
-- cooking_method ya existentes (sección 11 bis) — no se duplican.
-- ---------------------------------------------------------------------------
ALTER TABLE products
  ADD COLUMN label_profile_id        UUID REFERENCES label_profiles(id),
  ADD COLUMN label_display_name      TEXT,             -- denominación legal, si difiere del nombre comercial (products.name)
  ADD COLUMN country_of_origin       TEXT,
  ADD COLUMN usual_units_per_package INT NOT NULL DEFAULT 1,  -- prellena units_in_package en cada etiqueta generada
  ADD COLUMN suggested_package_count INT NOT NULL DEFAULT 1;  -- envases sugeridos = quantity de la línea × este valor

CREATE INDEX ON products(label_profile_id);

-- ---------------------------------------------------------------------------
-- shop_settings — datos del operador alimentario (singleton).
-- operator_health_registry_code / operator_identification_mark son
-- configurables pero condicionales: cada label_profiles.requires_health_mark
-- decide si se muestran/exigen en un tipo de producto concreto (§17 del
-- diseño) — no se imprimen por defecto en ninguna etiqueta.
-- ---------------------------------------------------------------------------
ALTER TABLE shop_settings
  ADD COLUMN operator_legal_name           TEXT,
  ADD COLUMN operator_tax_id               TEXT,
  ADD COLUMN operator_address              TEXT,
  ADD COLUMN operator_health_registry_code TEXT,
  ADD COLUMN operator_identification_mark  TEXT,
  ADD COLUMN operator_country              TEXT NOT NULL DEFAULT 'ES';

-- Datos identificativos ya públicos en content/legal/aviso-legal.md — se
-- trasladan aquí para que la aplicación pueda consultarlos de forma
-- estructurada. El registro sanitario/marca de identificación quedan sin
-- rellenar (NULL) hasta que APPCC confirme si aplican (ver §17).
UPDATE shop_settings
SET operator_legal_name = 'EL BUEY MADURADO, S.L.',
    operator_tax_id = 'B-24770836',
    operator_address = 'C/ La Reina, 41, 46800 Xàtiva (València)',
    operator_country = 'ES'
WHERE singleton = true;

-- ---------------------------------------------------------------------------
-- Backfill del seed de desarrollo (0006_seed_dev.sql) — asigna perfiles
-- provisionales a los 10 productos de ejemplo para poder probar el flujo
-- completo. ⚠️ SOLO DESARROLLO, igual que el resto de 0006. El "Pack Gourmet
-- El Buey" se deja deliberadamente SIN perfil asignado (label_profile_id
-- NULL) como caso de prueba real de "producto sin plantilla configurada"
-- (validaciones, §10 del diseño).
-- ---------------------------------------------------------------------------
UPDATE products SET
  label_profile_id = (SELECT id FROM label_profiles WHERE key = 'carne_vacuno'),
  country_of_origin = 'España',
  usual_units_per_package = 1,
  suggested_package_count = 1
WHERE id IN (
  '22222222-0000-0000-0000-000000000001', -- chuletón de vaca madurada
  '22222222-0000-0000-0000-000000000002', -- tomahawk madurado
  '22222222-0000-0000-0000-000000000003', -- entrecot madurado
  '22222222-0000-0000-0000-000000000004'  -- pack degustación madurado
);

UPDATE products SET
  label_profile_id = (SELECT id FROM label_profiles WHERE key = 'preparado_carnico'),
  usual_units_per_package = 4,
  suggested_package_count = 1
WHERE id IN (
  '22222222-0000-0000-0000-000000000005', -- burger wagyu artesana
  '22222222-0000-0000-0000-000000000006'  -- burger angus artesana
);

UPDATE products SET
  label_profile_id = (SELECT id FROM label_profiles WHERE key = 'elaborado_congelado'),
  usual_units_per_package = 12,
  suggested_package_count = 1
WHERE id IN (
  '22222222-0000-0000-0000-000000000007', -- croquetas de jamón ibérico
  '22222222-0000-0000-0000-000000000008'  -- croquetas de boletus
);

UPDATE products SET
  label_profile_id = (SELECT id FROM label_profiles WHERE key = 'elaborado_refrigerado'),
  usual_units_per_package = 1,
  suggested_package_count = 1
WHERE id = '22222222-0000-0000-0000-000000000009'; -- salsa chimichurri artesana

-- prod_pack_gourm ('...-010', Pack Gourmet El Buey) se deja sin tocar a
-- propósito: label_profile_id permanece NULL.
