-- =============================================================================
-- 0015_extend_product_labels.sql
-- Sistema de etiquetado alimentario, Unidad 4: un envase físico = una fila de
-- product_labels = una etiqueta. Ver docs/FOOD_LABEL_ADMIN_DESIGN.md, §6.6 y §8.
-- =============================================================================

ALTER TABLE product_labels
  ADD COLUMN label_profile_id        UUID REFERENCES label_profiles(id),
  ADD COLUMN variant_name            TEXT,             -- snapshot autocontenido, sin JOIN
  ADD COLUMN package_sequence        INT NOT NULL DEFAULT 1,   -- "envase 1 de N"
  ADD COLUMN package_count_for_line  INT NOT NULL DEFAULT 1,   -- N total de la línea, congelado al generar
  ADD COLUMN units_in_package        INT NOT NULL DEFAULT 1,   -- unidades de venta dentro de ESTE envase
  ADD COLUMN country_of_origin       TEXT,
  ADD COLUMN packaging_date          DATE,             -- fecha de envasado (distinta de elaboration_date)
  ADD COLUMN best_before_date        DATE,             -- consumo preferente — alternativa a expiry_date, nunca ambas
  ADD COLUMN beef_traceability_info  TEXT,             -- texto libre; formato definitivo pendiente de validación APPCC
  ADD COLUMN status                  TEXT NOT NULL DEFAULT 'PENDING'
                                      CHECK (status IN ('PENDING', 'READY', 'PRINTED', 'REPRINTED', 'CANCELLED')),
  ADD COLUMN cancelled_at            TIMESTAMPTZ,
  ADD COLUMN cancelled_reason        TEXT,
  ADD COLUMN created_by              TEXT,             -- nombre operativo de sesión (ver §17), no una cuenta individual
  ADD COLUMN updated_by              TEXT,
  ADD COLUMN updated_at              TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX ON product_labels(order_item_id);
CREATE INDEX ON product_labels(status);

-- ---------------------------------------------------------------------------
-- Reemplaza el trigger de pre-relleno (0003_product_labels.sql).
--
-- Cambio de fondo respecto a la versión original: antes copiaba SIEMPRE desde
-- products en vivo, lo que rompía la trazabilidad de pedidos antiguos si el
-- producto cambiaba después de la compra. Ahora, si la etiqueta nace de una
-- línea de pedido (order_item_id IS NOT NULL), copia del snapshot congelado
-- en order_items (0014) — nunca del catálogo en vivo. Solo se recurre a
-- products en vivo para etiquetas manuales sin pedido asociado
-- (order_item_id IS NULL), un caso de flexibilidad ya contemplado en el
-- diseño original de la tabla (order_item_id siempre fue NULLABLE).
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION suggest_product_label_fields()
RETURNS TRIGGER AS $$
DECLARE
  oi order_items%ROWTYPE;
  p  products%ROWTYPE;
  prof label_profiles%ROWTYPE;
BEGIN
  SELECT * INTO p FROM products WHERE id = NEW.product_id;

  IF NEW.order_item_id IS NOT NULL THEN
    SELECT * INTO oi FROM order_items WHERE id = NEW.order_item_id;

    IF NEW.product_name IS NULL OR NEW.product_name = '' THEN
      NEW.product_name := COALESCE(oi.label_display_name_snapshot, oi.product_name_snapshot, p.name);
    END IF;
    IF NEW.variant_name IS NULL THEN NEW.variant_name := oi.variant_name_snapshot; END IF;
    IF NEW.ingredients IS NULL THEN NEW.ingredients := oi.ingredients_snapshot; END IF;
    IF NEW.allergens IS NULL THEN NEW.allergens := oi.allergens_snapshot; END IF;
    IF NEW.allergens_notes IS NULL THEN NEW.allergens_notes := oi.allergens_notes_snapshot; END IF;
    IF NEW.storage_conditions IS NULL THEN NEW.storage_conditions := oi.storage_conditions_snapshot; END IF;
    IF NEW.prep_instructions IS NULL THEN NEW.prep_instructions := oi.prep_instructions_snapshot; END IF;
    IF NEW.cooking_method IS NULL THEN NEW.cooking_method := oi.cooking_method_snapshot; END IF;
    IF NEW.country_of_origin IS NULL THEN NEW.country_of_origin := oi.country_of_origin_snapshot; END IF;
    IF NEW.label_profile_id IS NULL THEN NEW.label_profile_id := oi.label_profile_id_snapshot; END IF;
  ELSE
    -- Etiqueta manual sin pedido asociado: única situación en la que se
    -- permite leer products en vivo (no hay snapshot del que partir).
    IF NEW.product_name IS NULL OR NEW.product_name = '' THEN NEW.product_name := COALESCE(p.label_display_name, p.name); END IF;
    IF NEW.ingredients IS NULL THEN NEW.ingredients := p.ingredients; END IF;
    IF NEW.allergens IS NULL THEN NEW.allergens := p.allergens; END IF;
    IF NEW.allergens_notes IS NULL THEN NEW.allergens_notes := p.allergens_notes; END IF;
    IF NEW.storage_conditions IS NULL THEN NEW.storage_conditions := p.storage_conditions; END IF;
    IF NEW.prep_instructions IS NULL THEN NEW.prep_instructions := p.prep_instructions; END IF;
    IF NEW.cooking_method IS NULL THEN NEW.cooking_method := p.cooking_method; END IF;
    IF NEW.country_of_origin IS NULL THEN NEW.country_of_origin := p.country_of_origin; END IF;
    IF NEW.label_profile_id IS NULL THEN NEW.label_profile_id := p.label_profile_id; END IF;
  END IF;

  -- Texto de conservación por defecto del perfil, solo si sigue vacío tras
  -- lo anterior (ni snapshot/producto ni el propio formulario lo trajeron).
  IF NEW.label_profile_id IS NOT NULL AND (NEW.storage_conditions IS NULL OR NEW.storage_conditions = '') THEN
    SELECT * INTO prof FROM label_profiles WHERE id = NEW.label_profile_id;
    IF prof.default_storage_text IS NOT NULL THEN
      NEW.storage_conditions := prof.default_storage_text;
    END IF;
  END IF;

  -- Sugerir lote L{YYMMDD}-{slug} si viene vacío (editable por el trabajador).
  IF NEW.lote IS NULL OR NEW.lote = '' THEN
    NEW.lote := 'L'
      || to_char(COALESCE(NEW.elaboration_date, CURRENT_DATE), 'YYMMDD')
      || '-'
      || p.slug;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- El trigger before_insert_product_label (0003) ya apunta a esta función por
-- nombre — CREATE OR REPLACE la actualiza sin necesidad de recrear el trigger.
