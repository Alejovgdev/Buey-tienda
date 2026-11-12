import type { MetadataRoute } from 'next';
import { SEO_ORIGIN } from '@/lib/seo';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: '/api/',
    },
    // Carrito, checkout, confirmación y login deben poder mostrar su noindex.
    // El control de acceso administrativo sigue en middleware y en cada API.
    sitemap: `${SEO_ORIGIN}/sitemap.xml`,
  };
}
