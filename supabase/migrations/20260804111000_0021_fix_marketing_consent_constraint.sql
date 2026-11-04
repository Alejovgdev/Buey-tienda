-- =============================================================================
-- 0021_fix_marketing_consent_constraint.sql
--
-- En PostgreSQL un CHECK también permite resultados NULL. La primera versión
-- del constraint comparaba booleanos con `=`, lo que podía producir NULL para
-- combinaciones inválidas cuyo marketing_consent fuese NULL. `IS TRUE` e
-- `IS FALSE` devuelven siempre un booleano y cierran ese hueco.
-- =============================================================================

ALTER TABLE orders
  DROP CONSTRAINT orders_marketing_consent_evidence_check;

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
      marketing_consent IS FALSE
      AND marketing_consent_at IS NULL
      AND marketing_consent_version IS NULL
    )
    OR
    (
      marketing_consent IS TRUE
      AND marketing_consent_at IS NOT NULL
      AND NULLIF(BTRIM(marketing_consent_version), '') IS NOT NULL
    )
  );
