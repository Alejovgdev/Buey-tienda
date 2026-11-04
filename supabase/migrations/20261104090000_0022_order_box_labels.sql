-- Etiqueta de caja: una única copia confirmada por pedido, independiente
-- del etiquetado alimentario. Solo se inserta tras confirmación explícita.
-- La PK decide de forma atómica cuál de dos confirmaciones concurrentes gana.
CREATE TABLE order_box_labels (
  order_id UUID PRIMARY KEY REFERENCES orders(id),
  draft_id UUID NOT NULL,
  snapshot JSONB NOT NULL CHECK (jsonb_typeof(snapshot) = 'object'),
  confirmed_session_id TEXT NOT NULL,
  confirmed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE order_box_labels ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON order_box_labels FROM PUBLIC, anon, authenticated;
-- service_role omite RLS, pero no los privilegios de tabla. La aplicación
-- puede leer e insertar; no sobrescribir ni borrar la primera copia.
REVOKE UPDATE, DELETE, TRUNCATE ON order_box_labels FROM service_role;
GRANT SELECT, INSERT ON order_box_labels TO service_role;
