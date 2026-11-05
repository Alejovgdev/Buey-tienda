import HomeLanding from '@/components/Home/HomeLanding';
import { getHomeProducts } from '@/lib/tienda';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const products = await getHomeProducts();
  return <HomeLanding products={products} />;
}

