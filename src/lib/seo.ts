import type { Metadata } from 'next';

// Identidad SEO independiente de NEXT_PUBLIC_BASE_URL y de las URL de pagos.
// No se obtiene del host de la petición ni del dominio de una preview.
export const SEO_ORIGIN = 'https://www.restauranteelbueymadurado.com';

interface PageMetadataOptions {
  path: `/${string}`;
  title: string;
  description: string;
}

export function createPageMetadata({ path, title, description }: PageMetadataOptions): Metadata {
  const canonical = new URL(path, SEO_ORIGIN);
  canonical.search = '';
  canonical.hash = '';

  return {
    title,
    description,
    alternates: { canonical: canonical.toString() },
  };
}
