import { getPublicSiteUrl } from '@/lib/public-site-url';

// Logo de la cabecera de los emails al cliente. Se sirve desde public/ de la
// propia web (se genera con `node scripts/prepare-email-logo.mjs`). La URL
// tiene que ser absoluta y pública: en local apunta a localhost y el cliente
// de correo no puede cargarla.
export const EMAIL_LOGO_PATH = '/assets/images/logo-buey-email.png';
export const EMAIL_LOGO_WIDTH = 120;
export const EMAIL_LOGO_HEIGHT = 120;

export function getEmailLogoUrl(): string {
  return getPublicSiteUrl(EMAIL_LOGO_PATH);
}
