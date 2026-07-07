'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { ProductImageData } from '@/types/shop';

interface ProductImageGalleryProps {
  images: ProductImageData[];
  productName: string;
}

export default function ProductImageGallery({ images, productName }: ProductImageGalleryProps) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  if (images.length === 0) {
    return (
      <div className="flex aspect-square w-full items-center justify-center rounded-2xl bg-black text-white/30 ring-1 ring-white/10">
        Sin imagen
      </div>
    );
  }

  const selected = images[selectedIndex];

  return (
    <div className="lg:sticky lg:top-28">
      <div className="relative aspect-square w-full overflow-hidden rounded-2xl bg-black ring-1 ring-white/10">
        <Image
          key={selected.url}
          src={selected.url}
          alt={selected.altText ?? productName}
          fill
          priority
          sizes="(min-width: 1024px) 45vw, 100vw"
          className="object-cover"
        />
      </div>

      {images.length > 1 && (
        <div className="mt-4 flex gap-3 overflow-x-auto pb-1">
          {images.map((image, index) => (
            <button
              key={image.url}
              type="button"
              onClick={() => setSelectedIndex(index)}
              aria-label={`Ver imagen ${index + 1} de ${productName}`}
              className={`relative aspect-square w-20 shrink-0 overflow-hidden rounded-xl ring-2 transition-colors duration-200 ${
                index === selectedIndex
                  ? 'ring-amber-500'
                  : 'ring-white/10 hover:ring-white/30'
              }`}
            >
              <Image
                src={image.url}
                alt=""
                fill
                sizes="80px"
                className="object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
