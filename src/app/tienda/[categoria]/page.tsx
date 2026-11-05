import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getActiveCategories, getCategoryBySlug, getProductCardsByCategory } from '@/lib/tienda';
import CategoryNav from '@/components/Tienda/CategoryNav';
import ProductGrid from '@/components/Tienda/ProductGrid';
import ShippingNotice from '@/components/Tienda/ShippingNotice';
import ShopAvailabilityBanner from '@/components/Tienda/ShopAvailabilityBanner';

interface CategoriaPageProps {
  params: Promise<{ categoria: string }>;
}

export async function generateMetadata({ params }: CategoriaPageProps): Promise<Metadata> {
  const { categoria } = await params;
  const category = await getCategoryBySlug(categoria);

  if (!category) return {};

  return {
    title: `${category.name} | Tienda El Buey Madurado`,
    description:
      category.description ??
      `Descubre ${category.name} en la tienda online de El Buey Madurado.`,
  };
}

export default async function CategoriaPage({ params }: CategoriaPageProps) {
  const { categoria } = await params;
  const category = await getCategoryBySlug(categoria);

  if (!category) notFound();

  const [categories, products] = await Promise.all([
    getActiveCategories(),
    getProductCardsByCategory(category.id),
  ]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16">
      <ShopAvailabilityBanner />
      <div className="mb-8 md:mb-12">
        <CategoryNav categories={categories} activeSlug={category.slug} />
      </div>

      <header className="mb-6 max-w-2xl md:mb-8">
        <h1 className="text-3xl font-extrabold text-white sm:text-4xl md:text-5xl">
          {category.name}
        </h1>
        {category.description && (
          <p className="mt-3 text-base text-white/70 md:text-lg">{category.description}</p>
        )}
      </header>

      <ProductGrid
        products={products}
        emptyMessage={`Todavía no hay productos disponibles en ${category.name}.`}
      />

      <ShippingNotice className="mt-14 md:mt-20" />
    </div>
  );
}
