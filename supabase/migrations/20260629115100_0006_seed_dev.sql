-- =============================================================================
-- 0006_seed_dev.sql
-- Datos placeholder de desarrollo. Sección 25 del documento técnico.
--
-- ⚠️  SOLO PARA DESARROLLO — sustituir/eliminar antes de producción.
--     Precios y alérgenos son ilustrativos y deben verificarse con el cliente.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- UUIDs fijos para referencias cruzadas en el seed
-- ---------------------------------------------------------------------------
-- Categorías
DO $$
DECLARE
  cat_carne    UUID := '11111111-0000-0000-0000-000000000001';
  cat_burger   UUID := '11111111-0000-0000-0000-000000000002';
  cat_croqueta UUID := '11111111-0000-0000-0000-000000000003';
  cat_gourmet  UUID := '11111111-0000-0000-0000-000000000004';

  -- Productos
  prod_chuleton UUID := '22222222-0000-0000-0000-000000000001';
  prod_tomahawk UUID := '22222222-0000-0000-0000-000000000002';
  prod_entrecot UUID := '22222222-0000-0000-0000-000000000003';
  prod_pack_deg UUID := '22222222-0000-0000-0000-000000000004';
  prod_burger_w UUID := '22222222-0000-0000-0000-000000000005';
  prod_burger_a UUID := '22222222-0000-0000-0000-000000000006';
  prod_croqueta_j UUID := '22222222-0000-0000-0000-000000000007';
  prod_croqueta_b UUID := '22222222-0000-0000-0000-000000000008';
  prod_chimichurri UUID := '22222222-0000-0000-0000-000000000009';
  prod_pack_gourm  UUID := '22222222-0000-0000-0000-000000000010';

  -- Variantes (necesitamos la de burger_wagyu para la promoción)
  var_chuleton_1kg   UUID := '33333333-0000-0000-0000-000000000001';
  var_chuleton_15kg  UUID := '33333333-0000-0000-0000-000000000002';
  var_chuleton_2kg   UUID := '33333333-0000-0000-0000-000000000003';
  var_tomahawk       UUID := '33333333-0000-0000-0000-000000000004';
  var_entrecot_400g  UUID := '33333333-0000-0000-0000-000000000005';
  var_entrecot_800g  UUID := '33333333-0000-0000-0000-000000000006';
  var_pack_deg       UUID := '33333333-0000-0000-0000-000000000007';
  var_burger_w_4     UUID := '33333333-0000-0000-0000-000000000008';
  var_burger_w_8     UUID := '33333333-0000-0000-0000-000000000009';
  var_burger_a_4     UUID := '33333333-0000-0000-0000-000000000010';
  var_burger_a_8     UUID := '33333333-0000-0000-0000-000000000011';
  var_croqueta_j_12  UUID := '33333333-0000-0000-0000-000000000012';
  var_croqueta_j_24  UUID := '33333333-0000-0000-0000-000000000013';
  var_croqueta_b_12  UUID := '33333333-0000-0000-0000-000000000014';
  var_chimichurri    UUID := '33333333-0000-0000-0000-000000000015';
  var_pack_gourm     UUID := '33333333-0000-0000-0000-000000000016';

  supabase_url TEXT := 'https://pwkpuvagoupvynamskmh.supabase.co';
BEGIN

-- ---------------------------------------------------------------------------
-- CATEGORÍAS (4) — sección 25
-- ---------------------------------------------------------------------------
INSERT INTO categories (id, slug, name, sort_order, is_active) VALUES
  (cat_carne,    'packs-carne-madurada', 'Packs de Carne Madurada',  1, true),
  (cat_burger,   'hamburguesas',         'Hamburguesas Artesanas',    2, true),
  (cat_croqueta, 'croquetas',            'Croquetas',                 3, true),
  (cat_gourmet,  'gourmet',              'Productos Gourmet',         4, true)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- PRODUCTOS (10) con campos de plantilla de etiqueta — sección 25
-- ---------------------------------------------------------------------------

-- Packs de Carne Madurada
INSERT INTO products (id, slug, name, description, category_id, is_active, sort_order,
  allergens, allergens_notes, ingredients, storage_conditions, prep_instructions, cooking_method)
VALUES
  -- Chuletón de Vaca Madurada (producto de ejemplo con etiqueta completa — sección 25)
  (prod_chuleton, 'chuleton-vaca-madurada', 'Chuletón de Vaca Madurada',
   'Chuletón de vaca madurada en cámara durante al menos 30 días. Sabor intenso y textura tierna.',
   cat_carne, true, 1,
   '{}', NULL,
   'Carne de vacuno (100%)',
   'Conservar entre 0°C y 4°C',
   'Sacar de la nevera 30 min antes de cocinar',
   'Cocinar a la brasa o plancha muy caliente'),

  (prod_tomahawk, 'tomahawk-madurado', 'Tomahawk Madurado',
   'Tomahawk madurado con hueso largo. Ideal para la brasa. Unidad de aproximadamente 1,2 kg.',
   cat_carne, true, 2,
   '{}', NULL, NULL,
   'Conservar entre 0°C y 4°C',
   'Sacar de la nevera 30 min antes de cocinar',
   'Cocinar a la brasa a alta temperatura'),

  (prod_entrecot, 'entrecot-madurado', 'Entrecot Madurado',
   'Entrecot de vaca madurada. Corte jugoso y lleno de sabor.',
   cat_carne, true, 3,
   '{}', NULL, NULL,
   'Conservar entre 0°C y 4°C',
   'Sacar de la nevera 20 min antes de cocinar',
   'Cocinar a la plancha o brasa a fuego alto'),

  (prod_pack_deg, 'pack-degustacion-madurado', 'Pack Degustación Madurado',
   'Selección de los mejores cortes madurados. Perfecto para disfrutar en casa o regalar.',
   cat_carne, true, 4,
   '{}', NULL, NULL,
   'Conservar entre 0°C y 4°C',
   'Consultar instrucciones de cada pieza incluida',
   'Variable según el corte incluido')
ON CONFLICT (id) DO NOTHING;

-- Hamburguesas Artesanas
INSERT INTO products (id, slug, name, description, category_id, is_active, sort_order,
  allergens, allergens_notes)
VALUES
  (prod_burger_w, 'burger-wagyu', 'Burger Wagyu Artesana',
   'Hamburguesa 100% wagyu elaborada artesanalmente. Perfecta para brasa o plancha.',
   cat_burger, true, 1,
   ARRAY['gluten','huevo','leche'],
   'Elaborado en cocina donde se manipulan frutos secos.'),

  (prod_burger_a, 'burger-angus', 'Burger Angus Artesana',
   'Hamburguesa de ternera Angus. Jugosa y con todo el sabor de la carne de calidad.',
   cat_burger, true, 2,
   ARRAY['gluten','huevo'],
   NULL)
ON CONFLICT (id) DO NOTHING;

-- Croquetas
INSERT INTO products (id, slug, name, description, category_id, is_active, sort_order,
  allergens, allergens_notes)
VALUES
  (prod_croqueta_j, 'croquetas-jamon-iberico', 'Croquetas de Jamón Ibérico',
   'Croquetas caseras de jamón ibérico. Crujientes por fuera y cremosas por dentro.',
   cat_croqueta, true, 1,
   ARRAY['gluten','leche','huevo'],
   'Puede contener trazas de frutos secos.'),

  (prod_croqueta_b, 'croquetas-boletus', 'Croquetas de Boletus',
   'Croquetas de boletus edulis con un toque de nata. Perfectas como entrante.',
   cat_croqueta, true, 2,
   ARRAY['gluten','leche','huevo'],
   NULL)
ON CONFLICT (id) DO NOTHING;

-- Productos Gourmet
INSERT INTO products (id, slug, name, description, category_id, is_active, sort_order,
  allergens, allergens_notes)
VALUES
  (prod_chimichurri, 'salsa-chimichurri', 'Salsa Chimichurri Artesana',
   'Chimichurri artesano con hierbas frescas. Acompañamiento perfecto para la carne.',
   cat_gourmet, true, 1,
   '{}', NULL),

  (prod_pack_gourm, 'pack-gourmet-el-buey', 'Pack Gourmet El Buey',
   'Pack selección con los mejores productos de El Buey Madurado. Ideal para regalo.',
   cat_gourmet, true, 2,
   ARRAY['gluten','leche','huevo'],
   'Puede contener trazas de frutos secos.')
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- VARIANTES con precios en céntimos y stock inicial — sección 25
-- ---------------------------------------------------------------------------
INSERT INTO product_variants (id, product_id, name, price, stock, is_active, sort_order) VALUES
  -- Chuletón de Vaca Madurada
  (var_chuleton_1kg,  prod_chuleton, '1 kg',   4500, 20, true, 1),
  (var_chuleton_15kg, prod_chuleton, '1,5 kg',  6500, 20, true, 2),
  (var_chuleton_2kg,  prod_chuleton, '2 kg',    8500, 20, true, 3),
  -- Tomahawk
  (var_tomahawk,    prod_tomahawk, 'Unidad ~1,2 kg', 5500, 20, true, 1),
  -- Entrecot
  (var_entrecot_400g, prod_entrecot, '400 g', 2200, 20, true, 1),
  (var_entrecot_800g, prod_entrecot, '800 g', 4000, 20, true, 2),
  -- Pack Degustación
  (var_pack_deg,    prod_pack_deg, 'Pack único', 9900, 20, true, 1),
  -- Burger Wagyu
  (var_burger_w_4,  prod_burger_w, 'Pack 4 uds.', 2200, 40, true, 1),
  (var_burger_w_8,  prod_burger_w, 'Pack 8 uds.', 4000, 40, true, 2),
  -- Burger Angus
  (var_burger_a_4,  prod_burger_a, 'Pack 4 uds.', 1800, 40, true, 1),
  (var_burger_a_8,  prod_burger_a, 'Pack 8 uds.', 3200, 40, true, 2),
  -- Croquetas Jamón
  (var_croqueta_j_12, prod_croqueta_j, 'Caja 12 uds.', 1400, 30, true, 1),
  (var_croqueta_j_24, prod_croqueta_j, 'Caja 24 uds.', 2600, 30, true, 2),
  -- Croquetas Boletus
  (var_croqueta_b_12, prod_croqueta_b, 'Caja 12 uds.', 1300, 30, true, 1),
  -- Salsa Chimichurri
  (var_chimichurri, prod_chimichurri, 'Tarro 200 ml', 900, 30, true, 1),
  -- Pack Gourmet
  (var_pack_gourm, prod_pack_gourm, 'Pack básico', 8900, 20, true, 1)
ON CONFLICT (id) DO NOTHING;

-- ---------------------------------------------------------------------------
-- IMÁGENES PLACEHOLDER — se sustituirán por imágenes reales
-- ---------------------------------------------------------------------------
INSERT INTO product_images (product_id, storage_path, url, alt_text, is_main, sort_order) VALUES
  (prod_chuleton,  'products/chuleton-vaca-madurada/main.webp',
   supabase_url || '/storage/v1/object/public/product-images/products/chuleton-vaca-madurada/main.webp',
   'Chuletón de Vaca Madurada', true, 1),
  (prod_tomahawk,  'products/tomahawk-madurado/main.webp',
   supabase_url || '/storage/v1/object/public/product-images/products/tomahawk-madurado/main.webp',
   'Tomahawk Madurado', true, 1),
  (prod_entrecot,  'products/entrecot-madurado/main.webp',
   supabase_url || '/storage/v1/object/public/product-images/products/entrecot-madurado/main.webp',
   'Entrecot Madurado', true, 1),
  (prod_pack_deg,  'products/pack-degustacion-madurado/main.webp',
   supabase_url || '/storage/v1/object/public/product-images/products/pack-degustacion-madurado/main.webp',
   'Pack Degustación Madurado', true, 1),
  (prod_burger_w,  'products/burger-wagyu/main.webp',
   supabase_url || '/storage/v1/object/public/product-images/products/burger-wagyu/main.webp',
   'Burger Wagyu Artesana', true, 1),
  (prod_burger_a,  'products/burger-angus/main.webp',
   supabase_url || '/storage/v1/object/public/product-images/products/burger-angus/main.webp',
   'Burger Angus Artesana', true, 1),
  (prod_croqueta_j, 'products/croquetas-jamon-iberico/main.webp',
   supabase_url || '/storage/v1/object/public/product-images/products/croquetas-jamon-iberico/main.webp',
   'Croquetas de Jamón Ibérico', true, 1),
  (prod_croqueta_b, 'products/croquetas-boletus/main.webp',
   supabase_url || '/storage/v1/object/public/product-images/products/croquetas-boletus/main.webp',
   'Croquetas de Boletus', true, 1),
  (prod_chimichurri, 'products/salsa-chimichurri/main.webp',
   supabase_url || '/storage/v1/object/public/product-images/products/salsa-chimichurri/main.webp',
   'Salsa Chimichurri Artesana', true, 1),
  (prod_pack_gourm, 'products/pack-gourmet-el-buey/main.webp',
   supabase_url || '/storage/v1/object/public/product-images/products/pack-gourmet-el-buey/main.webp',
   'Pack Gourmet El Buey', true, 1);

-- ---------------------------------------------------------------------------
-- SHOP_SETTINGS — singleton, tienda abierta
-- ---------------------------------------------------------------------------
INSERT INTO shop_settings (singleton, accepting_orders, notice_message, checkout_disabled_message)
VALUES (true, true, NULL, NULL)
ON CONFLICT (singleton) DO NOTHING;

-- ---------------------------------------------------------------------------
-- PROMOCIÓN PLACEHOLDER — is_active:false, activar desde Studio cuando se confirme
-- "Burger Wagyu de regalo en pedidos +100€, primeros 10" — sección 25
-- ---------------------------------------------------------------------------
INSERT INTO promotions (name, type, min_subtotal, gift_variant_id, is_active, max_redemptions)
VALUES (
  'Burger Wagyu de regalo en pedidos +100€',
  'GIFT_PRODUCT',
  10000,           -- 100€ en céntimos
  var_burger_w_4,  -- Pack 4 uds. Burger Wagyu Artesana
  false,           -- ⚠️ inactiva — activar desde Supabase Studio cuando se confirme
  10
);

END $$;
