import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProductDetailBySlug } from '@/lib/tienda';
import ProductDetail from '@/components/Tienda/ProductDetail';
import ShopAvailabilityBanner from '@/components/Tienda/ShopAvailabilityBanner';
import { createPageMetadata } from '@/lib/seo';
import { getShopSettings } from '@/lib/shop-settings';
import { productBreadcrumbs } from '@/lib/structured-data';
import ShopBreadcrumbs from '@/components/Tienda/ShopBreadcrumbs';

interface ProductoPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ProductoPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductDetailBySlug(slug);

  if (!product) return {};

  return createPageMetadata({
    path: `/tienda/producto/${encodeURIComponent(product.slug)}`,
    title: `${product.name} | Tienda El Buey Madurado`,
    description:
      product.description?.trim() ||
      `Consulta la ficha de ${product.name} en la tienda online de El Buey Madurado.`,
  });
}

export default async function ProductoPage({ params }: ProductoPageProps) {
  const { slug } = await params;
  const product = await getProductDetailBySlug(slug);

  if (!product) notFound();

  const settings = await getShopSettings();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16">
      <ShopAvailabilityBanner settings={settings} />
      <ShopBreadcrumbs items={productBreadcrumbs(product)} />
      <ProductDetail product={product} acceptingOrders={settings?.acceptingOrders === true} />
    </div>
  );
}
