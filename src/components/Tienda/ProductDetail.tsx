import type { ProductDetailData } from '@/types/shop';
import ProductImageGallery from './ProductImageGallery';
import VariantSelector from './VariantSelector';
import AllergensBadge from './AllergensBadge';

interface ProductDetailProps {
  product: ProductDetailData;
}

export default function ProductDetail({ product }: ProductDetailProps) {
  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-2 lg:gap-16">
      <ProductImageGallery images={product.images} productName={product.name} />

      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-extrabold leading-tight text-white sm:text-4xl">
            {product.name}
          </h1>
          {product.description && (
            <p className="mt-4 text-base leading-relaxed text-white/70 md:text-lg">
              {product.description}
            </p>
          )}
        </div>

        <VariantSelector
          variants={product.variants}
          productSlug={product.slug}
          productName={product.name}
          imageUrl={product.images[0]?.url ?? null}
          allergens={product.allergens}
        />

        <AllergensBadge allergens={product.allergens} allergensNotes={product.allergensNotes} />
      </div>
    </div>
  );
}
