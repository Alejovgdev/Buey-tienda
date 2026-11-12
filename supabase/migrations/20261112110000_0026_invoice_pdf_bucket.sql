-- =============================================================================
-- 0026_invoice_pdf_bucket.sql
-- Paso 5: almacén PRIVADO para los PDF de las facturas.
--
-- - No público: sin URL pública de lectura.
-- - Sin políticas en storage.objects para anon ni authenticated: con RLS
--   activado en storage.objects, nadie salvo el servidor (service_role) puede
--   leer ni subir.
-- - Solo PDF, hasta 1 MB.
-- - Ruta: <año>/Factura-<número>.pdf. La aplicación sube con upsert = false,
--   así que un PDF guardado no se sobrescribe.
-- =============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'invoices',
  'invoices',
  false,
  1048576,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;
