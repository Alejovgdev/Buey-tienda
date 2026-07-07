-- =============================================================================
-- 0010_fix_seed_product_images_placeholder.sql
-- Corrige las rutas de product_images del seed de desarrollo (0006_seed_dev.sql):
-- apuntaban a rutas products/<slug>/main.webp que nunca se subieron al bucket.
--
-- El bucket product-images tiene hoy 5 fotos genéricas de carne subidas a mano
-- para poder ver el catálogo con fotos reales durante el desarrollo:
--   carne1.jpeg, carne5.jpeg, carne6.jpeg, carne9.jpg, carne10.jpg
-- (nombres y extensiones verificados en vivo contra el bucket con el cliente
-- anon antes de escribir este UPDATE — carne6 es .jpeg, no .jpg).
--
-- Se reparten en round-robin sobre los 10 productos del seed (2 productos por
-- imagen). Es intencional que varios productos compartan imagen: son
-- placeholders de desarrollo, no fotografía real por producto.
--
-- ⚠️  SOLO PARA DESARROLLO — al igual que el resto de 0006_seed_dev.sql, estas
--     URLs deben sustituirse por fotografía real por producto antes de
--     producción (ver cabecera de 0006_seed_dev.sql).
-- =============================================================================

DO $$
DECLARE
  supabase_url TEXT := 'https://pwkpuvagoupvynamskmh.supabase.co';

  assignments CONSTANT jsonb := '[
    {"slug": "chuleton-vaca-madurada",     "file": "carne1.jpeg"},
    {"slug": "tomahawk-madurado",          "file": "carne5.jpeg"},
    {"slug": "entrecot-madurado",          "file": "carne6.jpeg"},
    {"slug": "pack-degustacion-madurado",  "file": "carne9.jpg"},
    {"slug": "burger-wagyu",               "file": "carne10.jpg"},
    {"slug": "burger-angus",               "file": "carne1.jpeg"},
    {"slug": "croquetas-jamon-iberico",    "file": "carne5.jpeg"},
    {"slug": "croquetas-boletus",          "file": "carne6.jpeg"},
    {"slug": "salsa-chimichurri",          "file": "carne9.jpg"},
    {"slug": "pack-gourmet-el-buey",       "file": "carne10.jpg"}
  ]'::jsonb;

  item RECORD;
BEGIN
  FOR item IN SELECT (elem->>'slug') AS slug, (elem->>'file') AS file
              FROM jsonb_array_elements(assignments) AS elem
  LOOP
    UPDATE product_images
    SET storage_path = item.file,
        url = supabase_url || '/storage/v1/object/public/product-images/' || item.file
    FROM products p
    WHERE product_images.product_id = p.id
      AND p.slug = item.slug
      AND product_images.is_main = true;
  END LOOP;
END $$;
