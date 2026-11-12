import { describe, expect, it } from 'vitest';
import { breadcrumbJsonLd, categoryBreadcrumbs, productBreadcrumbs, productJsonLd, restaurantJsonLd, RESTAURANT_ID, serializeJsonLd } from './structured-data';
import type { ProductDetailData } from '@/types/shop';

function fixture(): ProductDetailData {
  return {
    slug: 'producto-local', name: 'Producto local', description: 'Descripción real',
    category: { slug: 'categoria-local', name: 'Categoría local' },
    allergens: [], allergensNotes: null,
    images: [{ url: '/assets/images/carne6.webp', altText: 'Foto real', isMain: true }],
    variants: [
      { id: 'first', name: 'Formato inicial', price: 3250, stock: 3 },
      { id: 'cheap', name: 'Formato menor', price: 975, stock: 4 },
      { id: 'sold-out', name: 'Formato agotado', price: 2100, stock: 0 },
    ],
  };
}

describe('serialización segura de JSON-LD', () => {
  it('conserva los datos sin permitir cerrar el script ni insertar HTML', () => {
    const input = { name: '</script><img src=x onerror=alert(1)>', description: 'Texto\u2028separado\u2029 & "comillas"' };
    const serialized = serializeJsonLd(input);
    expect(serialized).not.toContain('<');
    expect(serialized).not.toContain('\u2028');
    expect(serialized).not.toContain('\u2029');
    expect(JSON.parse(serialized)).toEqual(input);
  });
});

describe('entidad del restaurante', () => {
  it('mantiene una identidad estable y omite campos sin verificar', () => {
    const data = restaurantJsonLd();
    expect(data['@id']).toBe(RESTAURANT_ID);
    expect(data).toMatchObject({ '@type': 'Restaurant', name: 'El Buey Madurado', telephone: '+34670775786' });
    for (const field of ['openingHours', 'openingHoursSpecification', 'review', 'aggregateRating', 'geo', 'priceRange']) expect(data).not.toHaveProperty(field);
  });
});

describe('producto y oferta del formato mostrado', () => {
  it('usa el precio del formato inicial, aunque otro formato sea más barato', () => {
    const product = fixture();
    const data = productJsonLd(product, product.variants[0].id, true);
    expect(data).toMatchObject({
      '@type': 'Product', name: product.name, description: product.description,
      image: ['https://www.restauranteelbueymadurado.com/assets/images/carne6.webp'],
      offers: { name: 'Formato inicial', price: '32.50', priceCurrency: 'EUR', availability: 'https://schema.org/InStock' },
    });
    expect(data).not.toHaveProperty('sku');
    expect(data).not.toHaveProperty('gtin');
    expect(data).not.toHaveProperty('aggregateRating');
  });

  it('cambia precio y disponibilidad con el formato, conservando producto y URL canónica', () => {
    const product = fixture();
    const initial = productJsonLd(product, 'first', true);
    const changed = productJsonLd(product, 'sold-out', true);
    expect(changed?.['@id']).toBe(initial?.['@id']);
    expect(changed?.url).toBe(initial?.url);
    expect(changed?.offers).toMatchObject({ name: 'Formato agotado', price: '21.00', availability: 'https://schema.org/OutOfStock' });
  });

  it('no ofrece comprar cuando la tienda está cerrada o no se conoce su apertura', () => {
    const product = fixture();
    expect(productJsonLd(product, 'first', false)).not.toHaveProperty('offers');
  });

  it('no mantiene una oferta de un formato retirado de los datos actuales', () => {
    const product = fixture();
    product.variants = product.variants.filter(variant => variant.id !== 'first');
    expect(productJsonLd(product, 'first', true)).not.toHaveProperty('offers');
    expect(productJsonLd(product, undefined, true)).not.toHaveProperty('offers');
  });

  for (const price of [NaN, -1, 1.5]) {
    it(`omite una oferta con precio inválido: ${price}`, () => {
      const product = fixture(); product.variants[0].price = price;
      expect(productJsonLd(product, 'first', true)).not.toHaveProperty('offers');
    });
  }

  it('omite datos ausentes sin introducir descripción o fotos de ejemplo', () => {
    const product = fixture(); product.description = '   ';
    expect(productJsonLd(product, 'first', true)).not.toHaveProperty('description');
    product.images = [];
    expect(productJsonLd(product, 'first', true)).toBeNull();
    product.images = [{ url: 'javascript:alert(1)', altText: null, isMain: true }];
    expect(productJsonLd(product, 'first', true)).toBeNull();
  });
});

describe('migas de navegación', () => {
  it('comparte los datos de la categoría real con los enlaces y el marcado', () => {
    const product = fixture();
    const items = productBreadcrumbs(product);
    expect(items.map(item => item.name)).toEqual(['Tienda', 'Categoría local', 'Producto local']);
    expect(breadcrumbJsonLd(items)).toMatchObject({
      '@type': 'BreadcrumbList',
      itemListElement: items.map((item, index) => ({ name: item.name, position: index + 1, item: 'https://www.restauranteelbueymadurado.com' + item.path })),
    });
  });

  it('no inventa categorías ni publica una lista de un único elemento', () => {
    expect(categoryBreadcrumbs({ name: '', slug: '' })).toEqual([]);
    expect(breadcrumbJsonLd([{ name: 'Tienda', path: '/tienda' }])).toBeNull();
  });
});
