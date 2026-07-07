-- =============================================================================
-- 0004_rls_policies.sql
-- Row Level Security en todas las tablas. Matriz de la sección 19.
--
-- Lectura pública (anon) con filtro is_active donde aplique:
--   categories, products, product_variants, product_images,
--   promotions, shop_settings
--
-- Sin políticas públicas (solo service_role accede):
--   orders, order_items, payments, order_status_history, product_labels
--
-- RLS activado sin política = deny por defecto para anon.
-- El backend usa service_role (bypass de RLS).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Activar RLS en todas las tablas
-- ---------------------------------------------------------------------------
ALTER TABLE categories            ENABLE ROW LEVEL SECURITY;
ALTER TABLE products              ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants      ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_images        ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotions            ENABLE ROW LEVEL SECURITY;
ALTER TABLE shop_settings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders                ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items           ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_status_history  ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_labels        ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- LECTURA PÚBLICA — catálogo
-- ---------------------------------------------------------------------------

-- categories: solo las activas
CREATE POLICY "anon puede leer categorias activas"
  ON categories FOR SELECT
  TO anon
  USING (is_active = true);

-- products: solo los activos
CREATE POLICY "anon puede leer productos activos"
  ON products FOR SELECT
  TO anon
  USING (is_active = true);

-- product_variants: solo las activas
CREATE POLICY "anon puede leer variantes activas"
  ON product_variants FOR SELECT
  TO anon
  USING (is_active = true);

-- product_images: todas las imágenes (la visibilidad depende del producto activo)
CREATE POLICY "anon puede leer imagenes de productos"
  ON product_images FOR SELECT
  TO anon
  USING (true);

-- promotions: todas (el frontend filtra por is_active y fechas vía endpoint)
CREATE POLICY "anon puede leer promociones"
  ON promotions FOR SELECT
  TO anon
  USING (true);

-- shop_settings: la única fila singleton
CREATE POLICY "anon puede leer configuracion de tienda"
  ON shop_settings FOR SELECT
  TO anon
  USING (true);

-- ---------------------------------------------------------------------------
-- SIN POLÍTICAS PÚBLICAS — datos de pedidos, pagos e historial
-- orders, order_items, payments, order_status_history, product_labels
-- No se crea ninguna política para anon → deny por defecto.
-- El backend accede con service_role (bypassa RLS).
-- ---------------------------------------------------------------------------
