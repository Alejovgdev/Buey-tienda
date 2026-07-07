import type { ProductCardData } from '@/types/shop';
import ProductCard from './ProductCard';

interface ProductGridProps {
  products: ProductCardData[];
  emptyMessage?: string;
}

export default function ProductGrid({
  products,
  emptyMessage = 'Todavía no hay productos disponibles en esta categoría.',
}: ProductGridProps) {
  if (products.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-12 text-center text-white/60">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6 lg:grid-cols-4">
      {products.map((product) => (
        <ProductCard key={product.slug} product={product} />
      ))}
    </div>
  );
}
