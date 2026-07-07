-- =============================================================================
-- 0003_product_labels.sql
-- Etiquetas de trazabilidad, secuencia Redsys y retención con pg_cron.
-- Secciones 11bis y 15 del documento técnico.
--
-- PRERREQUISITO: pg_cron activado en Database → Extensions antes de hacer push.
-- Si el push falla por permisos de pg_cron, activar la extensión y reintentar.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- product_labels
-- Una etiqueta por línea de pedido (order_item). expiry_date SIEMPRE manual.
-- ---------------------------------------------------------------------------
CREATE TABLE product_labels (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_item_id      UUID        REFERENCES order_items(id),  -- nullable
  product_id         UUID        NOT NULL REFERENCES products(id),

  lote               TEXT        NOT NULL DEFAULT '',
  product_name       TEXT        NOT NULL DEFAULT '',

  -- Snapshots de la plantilla del producto (se copian en el trigger)
  ingredients        TEXT,
  allergens          TEXT[],
  allergens_notes    TEXT,
  storage_conditions TEXT,
  prep_instructions  TEXT,
  cooking_method     TEXT,

  -- Campos específicos de esta unidad (manuales)
  weight_grams       INT,
  elaboration_date   DATE,
  expiry_date        DATE,   -- SIEMPRE manual, nunca calculada (seguridad alimentaria)

  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Trigger BEFORE INSERT — pre-relleno desde la plantilla del producto.
-- Solo sugiere valores; el admin puede editarlos antes de guardar.
-- El trigger NO calcula expiry_date.
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION suggest_product_label_fields()
RETURNS TRIGGER AS $$
DECLARE
  p products%ROWTYPE;
BEGIN
  SELECT * INTO p FROM products WHERE id = NEW.product_id;

  IF NEW.product_name IS NULL OR NEW.product_name = '' THEN NEW.product_name := p.name;               END IF;
  IF NEW.ingredients IS NULL                           THEN NEW.ingredients       := p.ingredients;       END IF;
  IF NEW.allergens IS NULL                             THEN NEW.allergens         := p.allergens;         END IF;
  IF NEW.allergens_notes IS NULL                       THEN NEW.allergens_notes   := p.allergens_notes;   END IF;
  IF NEW.storage_conditions IS NULL                    THEN NEW.storage_conditions := p.storage_conditions; END IF;
  IF NEW.prep_instructions IS NULL                     THEN NEW.prep_instructions  := p.prep_instructions;  END IF;
  IF NEW.cooking_method IS NULL                        THEN NEW.cooking_method     := p.cooking_method;     END IF;

  -- Sugerir lote L{YYMMDD}-{slug} si viene vacío (editable por el admin)
  IF NEW.lote IS NULL OR NEW.lote = '' THEN
    NEW.lote := 'L'
      || to_char(COALESCE(NEW.elaboration_date, CURRENT_DATE), 'YYMMDD')
      || '-'
      || p.slug;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER before_insert_product_label
  BEFORE INSERT ON product_labels
  FOR EACH ROW EXECUTE FUNCTION suggest_product_label_fields();

-- ---------------------------------------------------------------------------
-- Secuencia y función para generar Ds_Order de Redsys (sección 15).
-- Formato: 2 dígitos año + 6 dígitos secuencia → "26000001"
-- Cumple Redsys: 4-12 chars, primeros 4 dígitos numéricos ("2600" → OK).
-- ---------------------------------------------------------------------------
CREATE SEQUENCE IF NOT EXISTS redsys_order_seq START 1;

CREATE OR REPLACE FUNCTION generate_redsys_ds_order()
RETURNS TEXT
LANGUAGE sql
AS $$
  SELECT to_char(CURRENT_DATE, 'YY') || LPAD(nextval('redsys_order_seq')::TEXT, 6, '0');
$$;
-- Resultado: "26000001", "26000002", ..., "26999999"

-- ---------------------------------------------------------------------------
-- Job de pg_cron — retención 6 meses (sección 11bis).
-- Borra etiquetas cuya elaboration_date (o created_at si es NULL) sea > 6 meses.
-- Horario: el día 1 de cada mes a las 3:00 UTC.
-- NOTA: pg_cron debe estar habilitado en Extensions antes de aplicar esta migración.
-- ---------------------------------------------------------------------------
SELECT cron.schedule(
  'delete-old-product-labels',
  '0 3 1 * *',
  $$DELETE FROM product_labels
    WHERE COALESCE(elaboration_date, created_at::date) < CURRENT_DATE - INTERVAL '6 months'$$
);
