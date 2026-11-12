import HomeLanding from '@/components/Home/HomeLanding';
import { getHomeProducts } from '@/lib/tienda';
import { createPageMetadata } from '@/lib/seo';
import { CatalogQueryError } from '@/lib/catalog-query';
import RestaurantJsonLd from '@/components/Seo/RestaurantJsonLd';

export const metadata = createPageMetadata({
  path: '/',
  title: 'El Buey Madurado | Restaurante de carne madurada en Xàtiva',
  description: 'El Buey Madurado, restaurante de carne madurada en Calle Reina, 41, Xàtiva. Consulta la carta, reserva tu mesa o visita nuestra tienda online.',
});

export const dynamic = 'force-dynamic';

export default async function Home() {
  let catalogUnavailable = false;
  const products = await getHomeProducts().catch((error: unknown) => {
    if (!(error instanceof CatalogQueryError)) throw error;
    catalogUnavailable = true;
    return [];
  });
  return <><RestaurantJsonLd /><HomeLanding products={products} catalogUnavailable={catalogUnavailable} /></>;
}

