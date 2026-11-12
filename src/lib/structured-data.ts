import { SEO_ORIGIN } from './seo';
import type { ProductDetailData } from '@/types/shop';

export type JsonLdData = Record<string, unknown>;
export type BreadcrumbItem = { name: string; path: `/${string}` };

export function serializeJsonLd(data: JsonLdData): string {
  // El texto de DB no puede cerrar el elemento script ni introducir HTML.
  return JSON.stringify(data).replace(/</g, '\\u003c')
    .replace(/\u2028/g, '\\u2028').replace(/\u2029/g, '\\u2029');
}

export const RESTAURANT_ID = `${SEO_ORIGIN}/#restaurant`;

export function restaurantJsonLd(): JsonLdData {
  return {
    '@context': 'https://schema.org',
    '@type': 'Restaurant',
    '@id': RESTAURANT_ID,
    name: 'El Buey Madurado',
    url: SEO_ORIGIN,
    telephone: '+34670775786',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Calle Reina, 41',
      addressLocality: 'Xàtiva',
      addressRegion: 'Valencia',
      postalCode: '46800',
      addressCountry: 'ES',
    },
    image: [`${SEO_ORIGIN}/assets/images/local-fachada.webp`, `${SEO_ORIGIN}/assets/images/local-sala.webp`],
    menu: `${SEO_ORIGIN}/carta`,
  };
}

export function categoryBreadcrumbs(category: { name: string; slug: string }): BreadcrumbItem[] {
  if (!category.name.trim() || !category.slug.trim()) return [];
  return [
    { name: 'Tienda', path: '/tienda' },
    { name: category.name, path: `/tienda/${encodeURIComponent(category.slug)}` },
  ];
}

export function productBreadcrumbs(product: ProductDetailData): BreadcrumbItem[] {
  const parents = categoryBreadcrumbs(product.category);
  if (!parents.length || !product.name.trim() || !product.slug.trim()) return [];
  return [...parents, { name: product.name, path: `/tienda/producto/${encodeURIComponent(product.slug)}` }];
}

export function breadcrumbJsonLd(items: BreadcrumbItem[]): JsonLdData | null {
  if (items.length < 2) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    '@id': `${SEO_ORIGIN}${items[items.length - 1].path}#breadcrumb`,
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem', position: index + 1, name: item.name, item: `${SEO_ORIGIN}${item.path}`,
    })),
  };
}

function imageUrl(value: string): string | null {
  if (!value.startsWith('/') && !value.startsWith('https://')) return null;
  try {
    const url = new URL(value, SEO_ORIGIN);
    return url.protocol === 'https:' ? url.toString() : null;
  } catch {
    return null;
  }
}

export function productJsonLd(
  product: ProductDetailData,
  selectedVariantId: string | undefined,
  acceptingOrders: boolean
): JsonLdData | null {
  const images = [...new Set(product.images.map(image => imageUrl(image.url)).filter((url): url is string => url !== null))];
  // No sustituir fotos ausentes por placeholders ni completar atributos comerciales.
  if (!product.name.trim() || !product.slug.trim() || images.length === 0) return null;
  const url = `${SEO_ORIGIN}/tienda/producto/${encodeURIComponent(product.slug)}`;
  const data: JsonLdData = {
    '@context': 'https://schema.org', '@type': 'Product', '@id': `${url}#product`,
    url, name: product.name, image: images,
  };
  if (product.description?.trim()) data.description = product.description;

  // Las variantes proceden de la consulta pública filtrada por is_active.
  // Resolver el ID en los datos actuales evita marcar una selección antigua.
  const selected = product.variants.find(variant => variant.id === selectedVariantId);
  if (acceptingOrders && selected?.name.trim() && Number.isSafeInteger(selected.price) && selected.price >= 0
    && Number.isSafeInteger(selected.stock)) {
    data.offers = {
      '@type': 'Offer', '@id': `${url}#offer-${encodeURIComponent(selected.id)}`,
      url, name: selected.name,
      price: (selected.price / 100).toFixed(2), priceCurrency: 'EUR',
      availability: `https://schema.org/${selected.stock > 0 ? 'InStock' : 'OutOfStock'}`,
    };
  }
  return data;
}
