'use client';

import Link from 'next/link';
import { FaShoppingBag } from 'react-icons/fa';
import { useCart } from '@/contexts/CartContext';

export default function CartLink() {
  const { totalQuantity } = useCart();

  return (
    <Link
      href="/carrito"
      aria-label="Ver carrito"
      className="relative flex items-center p-2 text-2xl text-gray-200 transition-colors duration-200 hover:text-amber-500"
    >
      <FaShoppingBag />
      {totalQuantity > 0 && (
        <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber-500 px-1 text-xs font-bold text-[#1a1410]">
          {totalQuantity}
        </span>
      )}
    </Link>
  );
}
