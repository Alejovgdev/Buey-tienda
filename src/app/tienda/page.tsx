import type { Metadata } from 'next';
import Link from 'next/link';
import { FaArrowRight } from 'react-icons/fa';
import { getCategoriesWithProducts } from '@/lib/tienda';
import CategoryNav from '@/components/Tienda/CategoryNav';
import ProductGrid from '@/components/Tienda/ProductGrid';
import ShippingNotice from '@/components/Tienda/ShippingNotice';
import ShopAvailabilityBanner from '@/components/Tienda/ShopAvailabilityBanner';
import { createPageMetadata } from '@/lib/seo';

export const metadata: Metadata = createPageMetadata({
  path: '/tienda',
  title: 'Comprar carne madurada online | Tienda El Buey Madurado',
  description:
    'Consulta el catálogo de la tienda online de El Buey Madurado. Explora sus categorías y las fichas de productos para realizar tu compra.',
});

const PRODUCTS_PER_CATEGORY = 4;

export default async function TiendaPage() {
  const categories = await getCategoriesWithProducts(PRODUCTS_PER_CATEGORY);

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16">
      <ShopAvailabilityBanner />

      <header className="mb-10 max-w-2xl md:mb-14">
        <h1 className="text-3xl font-extrabold leading-tight text-white sm:text-4xl md:text-5xl">
          La tienda de <span className="text-amber-500">El Buey Madurado</span>
        </h1>
        <p className="mt-4 text-base text-white/70 md:text-lg">
          Carne madurada, hamburguesas artesanas y productos gourmet, seleccionados con el
          mismo criterio que ponemos en nuestra sala. A domicilio.
        </p>
      </header>

      <div className="mb-12 md:mb-16">
        <CategoryNav categories={categories} />
      </div>

      <div className="space-y-16 md:space-y-20">
        {categories.map((category) => (
          <section key={category.id}>
            <div className="mb-6 flex items-end justify-between gap-4 md:mb-8">
              <div>
                <h2 className="text-2xl font-bold text-white md:text-3xl">{category.name}</h2>
                {category.description && (
                  <p className="mt-1 text-sm text-white/60 md:text-base">
                    {category.description}
                  </p>
                )}
              </div>
              <Link
                href={`/tienda/${category.slug}`}
                className="inline-flex shrink-0 items-center gap-1.5 text-sm font-semibold text-amber-400 transition-colors duration-200 hover:text-amber-300"
              >
                Ver todo
                <FaArrowRight className="text-xs" />
              </Link>
            </div>

            <ProductGrid products={category.products} />
          </section>
        ))}

        {categories.length === 0 && (
          <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-16 text-center text-white/60">
            La tienda no tiene categorías disponibles en este momento.
          </div>
        )}
      </div>

      <ShippingNotice className="mt-14 md:mt-20" />
    </div>
  );
}
