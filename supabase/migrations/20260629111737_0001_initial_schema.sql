-- =============================================================================
-- 0001_initial_schema.sql
-- Esquema inicial de la tienda El Buey Madurado
-- Tablas: categories, products, product_variants, product_images,
--         promotions, shop_settings, orders, order_items,
--         payments, order_status_history
-- Todos los importes en céntimos (INT). Sin campos de IVA.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- categories
-- ---------------------------------------------------------------------------
CREATE TABLE categories (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT        UNIQUE NOT NULL,
  name        TEXT        NOT NULL,
  description TEXT,
  image_url   TEXT,
  sort_order  INT         NOT NULL DEFAULT 0,
  is_active   BOOLEAN     NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- products
-- Incluye campos de plantilla de etiqueta (sección 11bis)
-- ---------------------------------------------------------------------------
CREATE TABLE products (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug               TEXT        UNIQUE NOT NULL,
  name               TEXT        NOT NULL,
  description        TEXT,
  category_id        UUID        NOT NULL REFERENCES categories(id),
  is_active          BOOLEAN     NOT NULL DEFAULT true,
  sort_order         INT         NOT NULL DEFAULT 0,
  -- Alérgenos (sección 11)
  allergens          TEXT[]      DEFAULT '{}',
  allergens_notes    TEXT,
  -- Plantilla de etiqueta de trazabilidad (sección 11bis)
  ingredients        TEXT,
  storage_conditions TEXT,
  prep_instructions  TEXT,
  cooking_method     TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- product_variants
-- Precio y stock viven aquí, nunca en products
-- ---------------------------------------------------------------------------
CREATE TABLE product_variants (
  id         UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID    NOT NULL REFERENCES products(id),
  name       TEXT    NOT NULL,     -- "1kg", "Pack 4 uds.", "Caja 12 uds."
  price      INT     NOT NULL,     -- en céntimos: 2500 = 25,00€
  stock      INT     NOT NULL DEFAULT 0,
  is_active  BOOLEAN NOT NULL DEFAULT true,
  sort_order INT     NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------------------
-- product_images
-- ---------------------------------------------------------------------------
CREATE TABLE product_images (
  id           UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id   UUID    NOT NULL REFERENCES products(id),
  storage_path TEXT    NOT NULL,   -- "products/chuleton-chuletero/main.webp"
  url          TEXT    NOT NULL,   -- URL pública completa de Supabase Storage
  alt_text     TEXT,
  is_main      BOOLEAN NOT NULL DEFAULT false,
  sort_order   INT     NOT NULL DEFAULT 0
);

-- ---------------------------------------------------------------------------
-- promotions
-- ---------------------------------------------------------------------------
CREATE TABLE promotions (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT        NOT NULL,
  type                TEXT        NOT NULL DEFAULT 'GIFT_PRODUCT',
  min_subtotal        INT,                          -- NULL = sin mínimo; en céntimos
  gift_variant_id     UUID        NOT NULL REFERENCES product_variants(id),
  is_active           BOOLEAN     NOT NULL DEFAULT false,
  max_redemptions     INT,                          -- NULL = sin límite
  current_redemptions INT         NOT NULL DEFAULT 0,
  starts_at           TIMESTAMPTZ,
  ends_at             TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- shop_settings  (singleton — solo puede existir una fila)
-- ---------------------------------------------------------------------------
CREATE TABLE shop_settings (
  id                        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton                 BOOLEAN     NOT NULL DEFAULT true UNIQUE CHECK (singleton = true),
  accepting_orders          BOOLEAN     NOT NULL DEFAULT true,
  notice_message            TEXT,
  checkout_disabled_message TEXT,
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- orders
-- ---------------------------------------------------------------------------
CREATE TABLE orders (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number         TEXT        UNIQUE NOT NULL,  -- "BM-2026-00001"
  status               TEXT        NOT NULL,

  -- Snapshot del cliente al momento de la compra
  customer_name        TEXT        NOT NULL,
  customer_last_name   TEXT        NOT NULL,
  customer_email       TEXT        NOT NULL,
  customer_phone       TEXT        NOT NULL,

  -- Snapshot de la dirección de envío
  shipping_street      TEXT        NOT NULL,
  shipping_city        TEXT        NOT NULL,
  shipping_province    TEXT        NOT NULL,
  shipping_postal_code TEXT        NOT NULL,
  shipping_country     TEXT        NOT NULL DEFAULT 'ES',
  shipping_notes       TEXT,

  -- Totales en céntimos
  subtotal             INT         NOT NULL,
  shipping_cost        INT         NOT NULL DEFAULT 0,
  total                INT         NOT NULL,

  -- Notas internas del restaurante
  admin_notes          TEXT,

  -- Redsys: 4-12 chars, primeros 4 numéricos ("26000001")
  -- Único y nullable: se rellena al generar el payload Redsys (Fase 4)
  redsys_ds_order      TEXT        UNIQUE,

  -- Timestamps
  paid_at              TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- order_items
-- Todos los snapshots del momento de la compra
-- ---------------------------------------------------------------------------
CREATE TABLE order_items (
  id                       UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id                 UUID    NOT NULL REFERENCES orders(id),
  product_variant_id       UUID    REFERENCES product_variants(id),  -- nullable

  -- Snapshots del momento de la compra
  product_name_snapshot    TEXT    NOT NULL,
  variant_name_snapshot    TEXT    NOT NULL,
  unit_price_snapshot      INT     NOT NULL,    -- en céntimos (0 si es regalo)
  quantity                 INT     NOT NULL,
  line_total               INT     NOT NULL,    -- unit_price_snapshot × quantity

  -- Snapshots de alérgenos
  allergens_snapshot       TEXT[]  DEFAULT '{}',
  allergens_notes_snapshot TEXT,

  -- Tipo de ítem y referencia a promoción
  item_type                TEXT    NOT NULL DEFAULT 'PRODUCT',  -- 'PRODUCT' | 'GIFT'
  promotion_id             UUID    REFERENCES promotions(id)    -- solo si GIFT
);

-- ---------------------------------------------------------------------------
-- payments
-- ---------------------------------------------------------------------------
CREATE TABLE payments (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id             UUID        UNIQUE NOT NULL REFERENCES orders(id),
  redsys_ds_order      TEXT        NOT NULL,
  redsys_ds_response   TEXT,
  redsys_authorization TEXT,
  amount               INT         NOT NULL,    -- en céntimos
  currency             TEXT        NOT NULL DEFAULT 'EUR',
  status               TEXT        NOT NULL,    -- 'succeeded' | 'failed' | 'refunded'
  paid_at              TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- order_status_history  (inmutable — solo INSERT)
-- ---------------------------------------------------------------------------
CREATE TABLE order_status_history (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id        UUID        NOT NULL REFERENCES orders(id),
  event_type      TEXT        NOT NULL,
  previous_status TEXT,
  new_status      TEXT,
  notes           TEXT,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =============================================================================
-- ÍNDICES (sección 8)
-- =============================================================================
CREATE INDEX ON products(category_id, is_active);
CREATE INDEX ON product_variants(product_id, is_active);
CREATE INDEX ON orders(status, created_at DESC);
CREATE INDEX ON order_items(order_id);
CREATE INDEX ON order_status_history(order_id, created_at);
