'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useCart } from '@/contexts/CartContext';
import { formatPriceFromCents } from '@/lib/format-price';
import type { HomeProductData } from '@/types/shop';
import styles from './HomeLanding.module.css';

export default function HomeProductCard({ product }: { product: HomeProductData }) {
  const { addItem } = useCart();
  const [selectedId, setSelectedId] = useState(
    product.variants.find((variant) => variant.stock > 0)?.id ?? product.variants[0]?.id
  );
  const [justAdded, setJustAdded] = useState(false);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selected = product.variants.find((variant) => variant.id === selectedId) ?? product.variants[0];
  const image = product.images[0];
  const soldOut = !selected || selected.stock <= 0;
  const href = `/tienda/producto/${product.slug}`;

  useEffect(() => () => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
  }, []);

  const addToCart = () => {
    if (soldOut) return;
    addItem({
      variantId: selected.id,
      productSlug: product.slug,
      productName: product.name,
      variantName: selected.name,
      unitPrice: selected.price,
      imageUrl: image?.url ?? null,
      stock: selected.stock,
      allergens: product.allergens,
    });
    setJustAdded(true);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setJustAdded(false), 1800);
  };

  return (
    <li className={styles.productCard}>
      <Link href={href} className={styles.productImage} aria-label={`Ver ${product.name}`}>
        {image ? (
          <Image src={image.url} alt={image.altText ?? product.name} fill sizes="(min-width: 1600px) 470px, (min-width: 1280px) 380px, (min-width: 768px) 30vw, 42vw" />
        ) : <span className={styles.noProductImage}>Sin imagen</span>}
      </Link>
      <div className={styles.productContent}>
        <h3><Link href={href}>{product.name}</Link></h3>
        {product.variants.length > 1 ? (
          <select
            className={styles.productVariant}
            aria-label={`Peso o formato de ${product.name}`}
            value={selected?.id}
            onChange={(event) => { setSelectedId(event.target.value); setJustAdded(false); }}
          >
            {product.variants.map((variant) => (
              <option key={variant.id} value={variant.id}>{variant.name}{variant.stock <= 0 ? ' · Agotado' : ''}</option>
            ))}
          </select>
        ) : selected ? <p className={styles.singleVariant}>{selected.name}</p> : null}
        <div className={styles.productActions}>
          <strong>{selected ? formatPriceFromCents(selected.price) : 'No disponible'}</strong>
          <button type="button" className={styles.button} disabled={soldOut} onClick={addToCart} aria-label={soldOut ? `${product.name} agotado` : `Añadir ${product.name}, ${selected.name}`}>
            {soldOut ? 'Agotado' : justAdded ? 'Añadido' : 'Añadir'}
          </button>
        </div>
        <span className={styles.cartFeedback} role="status">{justAdded ? 'Producto añadido al carrito' : ''}</span>
      </div>
    </li>
  );
}
