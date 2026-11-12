import { getSitemapUrls, serializeSitemap } from '@/lib/catalog-sitemap';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Construir la respuesta solo cuando todas las consultas han terminado.
    const xml = serializeSitemap(await getSitemapUrls());
    return new Response(xml, {
      headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  } catch {
    return new Response('Sitemap no disponible temporalmente. Inténtalo más tarde.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'Retry-After': '60' },
    });
  }
}
