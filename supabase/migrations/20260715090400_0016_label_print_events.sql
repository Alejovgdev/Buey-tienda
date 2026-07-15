-- =============================================================================
-- 0016_label_print_events.sql
-- Sistema de etiquetado alimentario, Unidad 5: histórico append-only de
-- impresión/reimpresión. Ver docs/FOOD_LABEL_ADMIN_DESIGN.md, §6.7 y §11.
-- =============================================================================

CREATE TABLE label_print_events (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_label_id UUID        NOT NULL REFERENCES product_labels(id),
  is_reprint       BOOLEAN     NOT NULL DEFAULT false,
  reprint_reason   TEXT,
  printed_by       TEXT        NOT NULL,   -- nombre operativo introducido en el login (sesión única compartida)
  session_id       TEXT        NOT NULL,   -- identificador de sesión (claim "sid" del JWT admin, ver src/lib/admin-auth.ts)
  label_snapshot   JSONB       NOT NULL,   -- contenido exacto impreso, ya resuelto (todos los campos en texto plano)
  printed_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON label_print_events(product_label_id, printed_at);

-- Solo INSERT desde la aplicación — ningún endpoint expone UPDATE/DELETE
-- sobre esta tabla (ver §11 y §13 del diseño). No se declara ninguna regla
-- de base de datos adicional para esto porque supabaseAdmin (service_role)
-- bypassa RLS igual que en el resto de tablas de pedidos; la garantía real
-- vive en el código de las API routes, igual que ya ocurre con
-- order_status_history.

-- ---------------------------------------------------------------------------
-- Ajuste de la retención de 6 meses (pg_cron, 0003 + 0007): no debe borrar
-- una etiqueta que ya tiene histórico de impresión real. Instrucción expresa
-- del encargo: "no borres automáticamente etiquetas ni eventos de impresión
-- hasta que exista una política de retención validada". Las etiquetas nunca
-- impresas (borradores abandonados) sí se siguen limpiando a los 6 meses,
-- igual que antes.
-- Se reprograma el mismo job por nombre — mismo patrón ya usado en 0007 para
-- ajustar este job sin tocar la migración original.
-- ---------------------------------------------------------------------------
SELECT cron.schedule(
  'delete-old-product-labels',
  '0 3 * * *',
  $$DELETE FROM product_labels
    WHERE COALESCE(elaboration_date, created_at::date) < CURRENT_DATE - INTERVAL '6 months'
      AND NOT EXISTS (
        SELECT 1 FROM label_print_events e WHERE e.product_label_id = product_labels.id
      )$$
);
