'use client';

import Image from 'next/image';
import { FaMinus, FaPlus, FaTrash } from 'react-icons/fa';
import { useCart } from '@/contexts/CartContext';
import { formatPriceFromCents } from '@/lib/format-price';
import type { CartItem } from '@/types/cart';

interface CartLineItemProps {
  item: CartItem;
}

export default function CartLineItem({ item }: CartLineItemProps) {
  const { updateQuantity, removeItem } = useCart();

  const atMinimum = item.quantity <= 1;
  const atStockCap = item.stock > 0 && item.quantity >= item.stock;
  const lineTotal = item.unitPrice * item.quantity;

  return (
    <div className="flex gap-4 border-b border-white/10 py-5 last:border-b-0">
      <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl bg-black ring-1 ring-white/10 sm:h-28 sm:w-28">
        {item.imageUrl ? (
          <Image
            src={item.imageUrl}
            alt={item.productName}
            fill
            sizes="112px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-white/30">
            Sin imagen
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col justify-between">
        <div>
          <h3 className="font-semibold text-white">{item.productName}</h3>
          <p className="text-sm text-white/60">{item.variantName}</p>
          <p className="mt-1 text-sm text-amber-400/90">
            {formatPriceFromCents(item.unitPrice)} / ud.
          </p>
        </div>

        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <div className="flex items-center rounded-full border border-white/15">
              <button
                type="button"
                onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                disabled={atMinimum}
                aria-label="Disminuir cantidad"
                className="p-2 text-white/80 transition-colors duration-200 hover:text-amber-400 disabled:cursor-not-allowed disabled:text-white/20"
              >
                <FaMinus className="text-xs" />
              </button>
              <span className="min-w-8 text-center text-sm font-semibold text-white">
                {item.quantity}
              </span>
              <button
                type="button"
                onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                disabled={atStockCap}
                aria-label="Aumentar cantidad"
                className="p-2 text-white/80 transition-colors duration-200 hover:text-amber-400 disabled:cursor-not-allowed disabled:text-white/20"
              >
                <FaPlus className="text-xs" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => removeItem(item.variantId)}
              aria-label="Eliminar del carrito"
              className="p-2 text-white/40 transition-colors duration-200 hover:text-red-400"
            >
              <FaTrash className="text-sm" />
            </button>
          </div>

          <p className="font-semibold text-white">{formatPriceFromCents(lineTotal)}</p>
        </div>

        {atStockCap && (
          <p className="mt-1 text-xs text-white/40">
            Cantidad máxima disponible según stock (orientativo, se confirma al pagar).
          </p>
        )}
      </div>
    </div>
  );
}
