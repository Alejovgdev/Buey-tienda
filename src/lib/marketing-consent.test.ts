import { describe, expect, it } from 'vitest';
import { MARKETING_CONSENT_VERSION } from '@/lib/legal';
import { buildMarketingConsentEvidence } from '@/lib/marketing-consent';

describe('buildMarketingConsentEvidence', () => {
  it('registra la elección negativa sin fecha ni versión', () => {
    expect(buildMarketingConsentEvidence(false, '2026-08-04T12:00:00.000Z')).toEqual({
      marketing_consent: false,
      marketing_consent_at: null,
      marketing_consent_version: null,
    });
  });

  it('registra la elección afirmativa con fecha y versión del texto', () => {
    const consentedAt = '2026-08-04T12:00:00.000Z';

    expect(buildMarketingConsentEvidence(true, consentedAt)).toEqual({
      marketing_consent: true,
      marketing_consent_at: consentedAt,
      marketing_consent_version: MARKETING_CONSENT_VERSION,
    });
  });
});
