-- =============================================================================
-- 0005_storage_bucket.sql
-- Bucket product-images con lectura pública. Sección 9 del documento técnico.
--
-- Lectura: pública (sin autenticación) — imágenes de catálogo accesibles
--          directamente desde <img> y Next.js Image.
-- Escritura: solo desde backend con SERVICE_ROLE_KEY o desde Supabase Studio.
--            Nunca desde el navegador del cliente.
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'product-images',
  'product-images',
  true,          -- lectura pública
  307200,        -- 300 KB límite por archivo (WebP optimizado)
  ARRAY['image/webp', 'image/jpeg', 'image/png', 'image/gif']
)
ON CONFLICT (id) DO NOTHING;

-- Política de lectura pública (anon puede leer objetos del bucket)
CREATE POLICY "Lectura publica de imagenes de productos"
  ON storage.objects FOR SELECT
  TO anon
  USING (bucket_id = 'product-images');
