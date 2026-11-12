import { supabase } from './supabase';
import { readAllCatalogRows } from './catalog-query';
import { SEO_ORIGIN } from './seo';

const PUBLIC_PATHS = [
  '/', '/carta', '/reservas', '/contacto', '/sobre-nosotros', '/sorteo',
  '/aviso-legal', '/politica-de-privacidad', '/politica-de-cookies',
  '/condiciones-de-contratacion', '/tienda',
] as const;

export async function getSitemapUrls(): Promise<string[]> {
  const [categories, products] = await Promise.all([
    readAllCatalogRows((from, to) => supabase
      .from('categories')
      .select('id, slug, name', { count: 'exact' })
      .eq('is_active', true)
      .order('id')
      .range(from, to)),
    readAllCatalogRows((from, to) => supabase
      .from('products')
      .select('id, slug, name, category_id', { count: 'exact' })
      .eq('is_active', true)
      .order('id')
      .range(from, to)),
  ]);

  const preparedCategories = categories.filter(category => category.slug.trim() && category.name.trim());
  const categoryIds = new Set(preparedCategories.map(category => category.id));
  // Una ficha pública requiere producto y categoría activos. El stock no decide
  // la indexación: las fichas temporalmente agotadas se conservan.
  const publicProducts = products.filter(product =>
    categoryIds.has(product.category_id) && product.slug.trim() && product.name.trim()
  );
  const populatedIds = new Set(publicProducts.map(product => product.category_id));

  return [...new Set([
    ...PUBLIC_PATHS.map(route => SEO_ORIGIN + (route === '/' ? '' : route)),
    ...preparedCategories.filter(category => populatedIds.has(category.id))
      .map(category => `${SEO_ORIGIN}/tienda/${encodeURIComponent(category.slug)}`),
    ...publicProducts.map(product => `${SEO_ORIGIN}/tienda/producto/${encodeURIComponent(product.slug)}`),
  ])];
}

export function serializeSitemap(urls: string[]): string {
  const escapeXml = (text: string) => text.replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  })[char]!);
  // No hay una fecha fiable que cubra todos los cambios visibles de cada página
  // (incluidos formatos, precios y stock). No inventar lastmod al servir el XML.
  return '<?xml version="1.0" encoding="UTF-8"?>\n'
    + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
    + urls.map(url => `  <url><loc>${escapeXml(url)}</loc></url>`).join('\n')
    + '\n</urlset>\n';
}
