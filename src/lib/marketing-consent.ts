import { MARKETING_CONSENT_VERSION } from '@/lib/legal';

export type MarketingConsentEvidence = {
  marketing_consent: boolean;
  marketing_consent_at: string | null;
  marketing_consent_version: string | null;
};

/**
 * Construye la evidencia que se guarda con el pedido.
 *
 * La elección negativa también se registra expresamente, pero solo una elección
 * afirmativa lleva fecha y versión del texto que vio el cliente.
 */
export function buildMarketingConsentEvidence(
  consent: boolean,
  consentedAt = new Date().toISOString()
): MarketingConsentEvidence {
  if (!consent) {
    return {
      marketing_consent: false,
      marketing_consent_at: null,
      marketing_consent_version: null,
    };
  }

  return {
    marketing_consent: true,
    marketing_consent_at: consentedAt,
    marketing_consent_version: MARKETING_CONSENT_VERSION,
  };
}
