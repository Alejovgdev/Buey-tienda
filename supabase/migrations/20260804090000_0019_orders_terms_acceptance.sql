-- =============================================================================
-- 0019_orders_terms_acceptance.sql
-- Registro de la aceptación de las Condiciones Generales de Contratación.
--
-- El checkout ya exige el checkbox `acceptTerms` (validado en cliente y, de
-- verdad, en servidor: src/lib/checkout-schema.ts), pero hasta ahora no se
-- guardaba ninguna prueba de esa aceptación. El contrato va por la v1.1 y
-- seguirá cambiando, así que hace falta saber qué texto aceptó cada cliente.
--
-- La versión la escribe SIEMPRE el servidor desde la constante TERMS_VERSION de
-- src/lib/legal.ts, nunca llega en el body de la petición.
--
-- No se añaden columnas de IP ni de user agent a propósito: la Política de
-- Privacidad publicada no declara ese tratamiento y no se recogen datos que el
-- texto legal no cubra.
-- =============================================================================

ALTER TABLE orders
  ADD COLUMN terms_version     TEXT,
  ADD COLUMN terms_accepted_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- Documentación de las columnas
--
-- Ambas son NULLABLE de forma deliberada. Los pedidos que ya existen son datos
-- de prueba anteriores a que el contrato existiera: no hay ningún valor real
-- que se les pueda asignar, y rellenarlos con la versión actual sería inventar
-- una aceptación que nunca ocurrió. Por eso no hay backfill.
-- ---------------------------------------------------------------------------

COMMENT ON COLUMN orders.terms_version IS
  'Versión de las Condiciones Generales de Contratación aceptada por el cliente '
  '(p. ej. "1.1"). La escribe el servidor desde TERMS_VERSION en src/lib/legal.ts; '
  'nunca se acepta del cliente. NULL en los pedidos anteriores a esta migración, '
  'que son datos de prueba previos a la existencia del contrato: no se rellenan '
  'porque no hubo aceptación real que registrar.';

COMMENT ON COLUMN orders.terms_accepted_at IS
  'Momento en que se registró la aceptación, tomado del reloj del servidor al '
  'insertar el pedido. NULL en los pedidos anteriores a esta migración, por el '
  'mismo motivo que terms_version.';

-- ---------------------------------------------------------------------------
-- RLS: sin cambios.
--
-- `orders` tiene RLS activado desde 0004 y NINGUNA política, de modo que anon
-- tiene deny por defecto sobre toda la tabla; el backend accede con
-- service_role, que bypassa RLS. Las políticas de RLS en Postgres son a nivel
-- de fila, no de columna, y no existe ningún GRANT por columnas sobre `orders`,
-- así que las columnas nuevas quedan cubiertas por el mismo deny sin tocar nada.
-- ---------------------------------------------------------------------------
