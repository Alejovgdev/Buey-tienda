'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import type { ProductCardData } from '@/types/shop';
import { formatPriceFromCents } from '@/lib/format-price';

interface ProductCardProps {
  product: ProductCardData;
}

export default function ProductCard({ product }: ProductCardProps) {
  const priceLabel =
    product.minPrice === null
      ? null
      : product.hasMultiplePrices
        ? `Desde ${formatPriceFromCents(product.minPrice)}`
        : formatPriceFromCents(product.minPrice);

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
    >
      <Link href={`/tienda/producto/${product.slug}`} className="group block">
        <div className="relative aspect-[4/5] overflow-hidden rounded-2xl bg-black ring-1 ring-white/10">
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.imageAlt ?? product.name}
              fill
              sizes="(min-width: 1024px) 23vw, (min-width: 640px) 30vw, 45vw"
              className={`object-cover transition-transform duration-500 ease-out group-hover:scale-105 ${
                product.soldOut ? 'opacity-60' : ''
              }`}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-white/30">
              Sin imagen
            </div>
          )}

          {product.soldOut && (
            <span className="absolute right-3 top-3 rounded-full border border-white/20 bg-black/80 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-white">
              Agotado
            </span>
          )}
        </div>

        <div className="mt-3 space-y-1">
          <h3 className="line-clamp-1 text-base font-semibold text-white group-hover:text-amber-400 transition-colors duration-200 md:text-lg">
            {product.name}
          </h3>
          {priceLabel && (
            <p className="text-sm font-medium text-amber-400/90 md:text-base">{priceLabel}</p>
          )}
        </div>
      </Link>
    </motion.div>
  );
}
