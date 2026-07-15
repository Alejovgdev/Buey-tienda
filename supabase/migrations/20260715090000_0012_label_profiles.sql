-- =============================================================================
-- 0012_label_profiles.sql
-- Sistema de etiquetado alimentario, Unidad 1: plantillas por tipo de producto.
-- Ver docs/FOOD_LABEL_ADMIN_DESIGN.md, secciones 6.5 y 9.
--
-- El catálogo de claves de campo reconocidas (product_name, net_weight, lot,
-- etc.) vive en código, no en la base de datos: src/lib/labels/label-fields.ts.
-- Los arrays de esta tabla (visible_fields, required_fields, blocking_fields,
-- preparation_fields, field_order) se validan contra ese catálogo en la capa
-- de aplicación (Zod), no con un CHECK de Postgres — así añadir una clave
-- nueva al catálogo no exige tocar esta migración, solo el archivo de código
-- y, si se quiere usar en un perfil ya existente, un UPDATE puntual.
-- =============================================================================

CREATE TABLE label_profiles (
  id                          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key                         TEXT        UNIQUE NOT NULL,
  name                        TEXT        NOT NULL,
  is_active                   BOOLEAN     NOT NULL DEFAULT true,

  -- Contenido de la etiqueta (claves del catálogo controlado por código)
  visible_fields              TEXT[]      NOT NULL DEFAULT '{}',
  required_fields             TEXT[]      NOT NULL DEFAULT '{}',
  blocking_fields             TEXT[]      NOT NULL DEFAULT '{}',
  preparation_fields          TEXT[]      NOT NULL DEFAULT '{}',
  field_order                 TEXT[]      NOT NULL DEFAULT '{}',

  -- Reglas de fecha — "expiry" (caducidad, seguridad alimentaria) o
  -- "best_before" (consumo preferente, calidad). Nunca las dos a la vez.
  date_type                   TEXT        NOT NULL DEFAULT 'EXPIRY'
                                           CHECK (date_type IN ('EXPIRY', 'BEST_BEFORE')),
  -- Solo una sugerencia de UI para prellenar la fecha en el formulario de
  -- preparación (packaging_date + N días) — el trabajador siempre debe
  -- confirmar/editar la fecha a mano; nunca se guarda sin revisión humana.
  suggested_shelf_life_days   INT,

  default_storage_text        TEXT,
  fixed_texts                 JSONB,

  requires_weight             BOOLEAN     NOT NULL DEFAULT true,
  requires_lot                BOOLEAN     NOT NULL DEFAULT true,
  requires_beef_traceability  BOOLEAN     NOT NULL DEFAULT false,
  -- RGSEAA / marca de identificación: dato global y condicional (shop_settings,
  -- ver 0013). Por defecto false — se activa por perfil solo cuando APPCC lo
  -- confirme para ese tipo de producto (docs/FOOD_LABEL_ADMIN_DESIGN.md, §17).
  requires_health_mark        BOOLEAN     NOT NULL DEFAULT false,

  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON label_profiles(is_active);

-- ---------------------------------------------------------------------------
-- Perfiles provisionales (sección 9 del diseño). PROVISIONALES: los campos
-- obligatorios/bloqueantes reales de cada tipo de producto los debe validar
-- el responsable de seguridad alimentaria/APPCC antes de producción — ver
-- docs/FOOD_LABEL_ADMIN_DESIGN.md, §17. Esta migración no inventa requisitos
-- legales definitivos, solo deja perfiles editables desde
-- /admin/configuracion/etiquetas para poder construir y probar el flujo.
-- ---------------------------------------------------------------------------
INSERT INTO label_profiles (
  key, name, visible_fields, required_fields, blocking_fields, preparation_fields,
  field_order, date_type, default_storage_text, fixed_texts,
  requires_weight, requires_lot, requires_beef_traceability, requires_health_mark
) VALUES
  (
    'carne_vacuno', 'Carne fresca/madurada de vacuno',
    ARRAY['product_name','variant_name','net_weight','units_in_package','ingredients','allergens',
          'lot','production_date','expiry_date','storage_conditions','usage_instructions','origin',
          'beef_traceability','operator_data'],
    ARRAY['product_name','net_weight','lot','expiry_date','storage_conditions','origin','beef_traceability'],
    ARRAY['product_name','net_weight','lot','expiry_date','storage_conditions','origin','beef_traceability'],
    ARRAY['net_weight','units_in_package','lot','production_date','expiry_date','beef_traceability'],
    ARRAY['product_name','variant_name','net_weight','units_in_package','ingredients','allergens','origin',
          'beef_traceability','lot','production_date','expiry_date','storage_conditions','usage_instructions',
          'operator_data'],
    'EXPIRY', 'Conservar entre 0°C y 4°C', NULL,
    true, true, true, false
  ),
  (
    'preparado_carnico', 'Preparado cárnico (hamburguesas, etc.)',
    ARRAY['product_name','variant_name','net_weight','units_in_package','ingredients','allergens',
          'lot','production_date','expiry_date','storage_conditions','usage_instructions','operator_data'],
    ARRAY['product_name','ingredients','allergens','lot','expiry_date'],
    ARRAY['product_name','ingredients','allergens','lot','expiry_date'],
    ARRAY['net_weight','units_in_package','lot','production_date','expiry_date'],
    ARRAY['product_name','variant_name','net_weight','units_in_package','ingredients','allergens',
          'lot','production_date','expiry_date','storage_conditions','usage_instructions','operator_data'],
    'EXPIRY', 'Conservar entre 0°C y 4°C', NULL,
    true, true, false, false
  ),
  (
    'elaborado_refrigerado', 'Elaborado refrigerado (croquetas, salsas, etc.)',
    ARRAY['product_name','variant_name','net_weight','units_in_package','ingredients','allergens',
          'lot','production_date','best_before_date','storage_conditions','usage_instructions','operator_data'],
    ARRAY['product_name','ingredients','allergens','lot','best_before_date'],
    ARRAY['product_name','ingredients','allergens','lot','best_before_date'],
    ARRAY['lot','production_date','best_before_date','units_in_package'],
    ARRAY['product_name','variant_name','net_weight','units_in_package','ingredients','allergens',
          'lot','production_date','best_before_date','storage_conditions','usage_instructions','operator_data'],
    'BEST_BEFORE', 'Conservar en refrigeración entre 0°C y 4°C', NULL,
    false, true, false, false
  ),
  (
    'elaborado_congelado', 'Elaborado congelado',
    ARRAY['product_name','variant_name','net_weight','units_in_package','ingredients','allergens',
          'lot','packaging_date','best_before_date','storage_conditions','usage_instructions','operator_data'],
    ARRAY['product_name','ingredients','allergens','lot','best_before_date','storage_conditions'],
    ARRAY['product_name','ingredients','allergens','lot','best_before_date','storage_conditions'],
    ARRAY['lot','packaging_date','best_before_date','units_in_package'],
    ARRAY['product_name','variant_name','net_weight','units_in_package','ingredients','allergens',
          'lot','packaging_date','best_before_date','storage_conditions','usage_instructions','operator_data'],
    'BEST_BEFORE', 'Congelado. Conservar a -18°C. No volver a congelar una vez descongelado.',
    '{"aviso_congelacion": "Ultracongelado — no volver a congelar una vez descongelado"}'::jsonb,
    false, true, false, false
  );
