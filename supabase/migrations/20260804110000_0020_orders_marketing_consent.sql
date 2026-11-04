-- =============================================================================
-- 0020_orders_marketing_consent.sql
-- Registro de la elección sobre comunicaciones comerciales en el checkout.
--
-- La casilla es opcional, independiente de las Condiciones Generales y nunca
-- bloquea una compra. El servidor guarda la elección true/false en cada pedido.
-- Si el cliente consiente, también guarda cuándo lo hizo y qué versión del
-- texto vio. La versión procede de MARKETING_CONSENT_VERSION en
-- src/lib/legal.ts; nunca se acepta desde el cliente.
--
-- No se realiza ninguna alta automática en Google, Brevo ni Resend.
-- =============================================================================

ALTER TABLE orders
  ADD COLUMN marketing_consent         BOOLEAN,
  ADD COLUMN marketing_consent_at      TIMESTAMPTZ,
  ADD COLUMN marketing_consent_version TEXT;

-- El DEFAULT se establece después de crear la columna: así los pedidos
-- históricos conservan NULL, mientras cualquier pedido nuevo que omita el
-- campo queda de forma segura como no consentido.
ALTER TABLE orders
  ALTER COLUMN marketing_consent SET DEFAULT FALSE;

-- Tres estados válidos:
--   NULL  + NULL  + NULL = pedido anterior a esta migración, sin información.
--   FALSE + NULL  + NULL = pedido nuevo cuyo cliente no marcó la casilla.
--   TRUE  + fecha + versión = consentimiento afirmativo con prueba completa.
ALTER TABLE orders
  ADD CONSTRAINT orders_marketing_consent_evidence_check
  CHECK (
    (
      marketing_consent IS NULL
      AND marketing_consent_at IS NULL
      AND marketing_consent_version IS NULL
    )
    OR
    (
      marketing_consent = FALSE
      AND marketing_consent_at IS NULL
      AND marketing_consent_version IS NULL
    )
    OR
    (
      marketing_consent = TRUE
      AND marketing_consent_at IS NOT NULL
      AND NULLIF(BTRIM(marketing_consent_version), '') IS NOT NULL
    )
  );

COMMENT ON COLUMN orders.marketing_consent IS
  'Elección del cliente sobre comunicaciones comerciales. TRUE si marcó la '
  'casilla; FALSE si no la marcó en un pedido creado después de esta migración; '
  'NULL en pedidos anteriores, para los que no existe información.';

COMMENT ON COLUMN orders.marketing_consent_at IS
  'Momento en que se registró el consentimiento comercial afirmativo, tomado '
  'del reloj del servidor. NULL si no consintió o si el pedido es anterior.';

COMMENT ON COLUMN orders.marketing_consent_version IS
  'Versión del texto de consentimiento comercial mostrado al cliente. La '
  'escribe el servidor desde MARKETING_CONSENT_VERSION en src/lib/legal.ts. '
  'NULL si no consintió o si el pedido es anterior.';

-- RLS no cambia: orders ya tiene RLS activado sin políticas para anon y el
-- backend accede mediante service_role, igual que para el resto del pedido.
