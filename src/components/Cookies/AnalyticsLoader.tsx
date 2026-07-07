'use client';

import { Analytics } from '@vercel/analytics/react';
import { useConsent } from '@/contexts/ConsentContext';

export default function AnalyticsLoader() {
  const { consent, isLoaded } = useConsent();

  // Only mount Vercel Analytics after the user has consented to analytics cookies
  if (!isLoaded || !consent.analisis) return null;

  return <Analytics />;
}
