import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getProductDetailBySlug } from '@/lib/tienda';
import ProductDetail from '@/components/Tienda/ProductDetail';
import ShopAvailabilityBanner from '@/components/Tienda/ShopAvailabilityBanner';

interface ProductoPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ProductoPageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductDetailBySlug(slug);

  if (!product) return {};

  return {
    title: `${product.name} | Tienda El Buey Madurado`,
    description:
      product.description ?? `${product.name}, disponible en la tienda online de El Buey Madurado.`,
  };
}

export default async function ProductoPage({ params }: ProductoPageProps) {
  const { slug } = await params;
  const product = await getProductDetailBySlug(slug);

  if (!product) notFound();

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16">
      <ShopAvailabilityBanner />
      <ProductDetail product={product} />
    </div>
  );
}
