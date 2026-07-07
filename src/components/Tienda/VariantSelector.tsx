'use client';

import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { FaCheck, FaMinus, FaPlus } from 'react-icons/fa';
import type { ProductVariantData } from '@/types/shop';
import { formatPriceFromCents } from '@/lib/format-price';
import { useCart } from '@/contexts/CartContext';

interface VariantSelectorProps {
  variants: ProductVariantData[];
  productSlug: string;
  productName: string;
  imageUrl: string | null;
  allergens: string[];
}

export default function VariantSelector({
  variants,
  productSlug,
  productName,
  imageUrl,
  allergens,
}: VariantSelectorProps) {
  const { addItem } = useCart();
  const [selectedId, setSelectedId] = useState(variants[0]?.id);
  const [quantity, setQuantity] = useState(1);
  const [justAdded, setJustAdded] = useState(false);

  const selected = useMemo(
    () => variants.find((variant) => variant.id === selectedId) ?? variants[0],
    [variants, selectedId]
  );

  // Cambiar de variante reinicia la cantidad: el stock puede ser muy distinto entre formatos.
  useEffect(() => {
    setQuantity(1);
  }, [selectedId]);

  if (!selected) return null;

  const soldOut = selected.stock <= 0;
  const atMinimum = quantity <= 1;
  const atStockCap = selected.stock > 0 && quantity >= selected.stock;

  const handleAddToCart = () => {
    if (soldOut) return;
    addItem(
      {
        variantId: selected.id,
        productSlug,
        productName,
        variantName: selected.name,
        unitPrice: selected.price,
        imageUrl,
        stock: selected.stock,
        allergens,
      },
      quantity
    );
    setJustAdded(true);
    setQuantity(1);
    window.setTimeout(() => setJustAdded(false), 1800);
  };

  return (
    <div className="space-y-5">
      {variants.length > 1 && (
        <div>
          <span className="text-sm font-semibold uppercase tracking-wide text-white/60">
            Formato
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            {variants.map((variant) => {
              const isActive = variant.id === selected.id;
              const isSoldOut = variant.stock <= 0;
              return (
                <button
                  key={variant.id}
                  type="button"
                  onClick={() => setSelectedId(variant.id)}
                  className={`rounded-full border px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                    isActive
                      ? 'border-amber-500 bg-amber-500 text-[#1a1410]'
                      : 'border-white/15 text-white/80 hover:border-amber-500/60 hover:text-amber-400'
                  } ${isSoldOut && !isActive ? 'opacity-40' : ''}`}
                >
                  {variant.name}
                  {isSoldOut ? ' · Agotado' : ''}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <p className="text-3xl font-bold text-white">{formatPriceFromCents(selected.price)}</p>

      {!soldOut && (
        <div>
          <span className="text-sm font-semibold uppercase tracking-wide text-white/60">
            Cantidad
          </span>
          <div className="mt-2 flex items-center gap-3">
            <div className="flex items-center rounded-full border border-white/15">
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                disabled={atMinimum}
                aria-label="Disminuir cantidad"
                className="p-3 text-white/80 transition-colors duration-200 hover:text-amber-400 disabled:cursor-not-allowed disabled:text-white/20"
              >
                <FaMinus className="text-xs" />
              </button>
              <span className="min-w-10 text-center text-base font-semibold text-white">
                {quantity}
              </span>
              <button
                type="button"
                onClick={() => setQuantity((q) => Math.min(selected.stock, q + 1))}
                disabled={atStockCap}
                aria-label="Aumentar cantidad"
                className="p-3 text-white/80 transition-colors duration-200 hover:text-amber-400 disabled:cursor-not-allowed disabled:text-white/20"
              >
                <FaPlus className="text-xs" />
              </button>
            </div>
            {atStockCap && (
              <span className="text-xs text-white/40">Máx. disponible (orientativo)</span>
            )}
          </div>
        </div>
      )}

      <motion.button
        type="button"
        onClick={handleAddToCart}
        disabled={soldOut}
        whileTap={soldOut ? undefined : { scale: 0.96 }}
        animate={justAdded ? { scale: [1, 1.06, 1] } : { scale: 1 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className={`inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-base font-semibold transition-colors duration-300 sm:w-auto ${
          soldOut
            ? 'cursor-not-allowed border border-white/10 bg-white/5 text-white/40'
            : 'bg-amber-500 text-[#1a1410] hover:bg-[#1a1410] hover:text-amber-500 hover:border-amber-500 border border-transparent'
        }`}
      >
        {soldOut ? (
          'Agotado'
        ) : justAdded ? (
          <>
            <FaCheck /> Añadido
          </>
        ) : (
          'Añadir al carrito'
        )}
      </motion.button>
    </div>
  );
}
