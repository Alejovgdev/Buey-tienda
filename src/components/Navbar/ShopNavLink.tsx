'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { TbShoppingBag } from 'react-icons/tb';

interface ShopNavLinkProps {
  variant?: 'inline' | 'row';
  onNavigate?: () => void;
}

// Pill de "Tienda": fondo sólido amber-500 con texto en el oscuro de marca
// (#1a1410) — contraste verificado (~8.5:1) frente a blanco sobre amber
// (~2.1:1, insuficiente), y coherente con Button.tsx y el badge del carrito,
// que ya usan esta misma combinación.
export default function ShopNavLink({ variant = 'inline', onNavigate }: ShopNavLinkProps) {
  const pathname = usePathname();
  const isActive = pathname === '/tienda' || pathname.startsWith('/tienda/');

  return (
    <Link
      href="/tienda"
      onClick={onNavigate}
      className={`flex items-center gap-2 rounded-full bg-amber-500 font-semibold text-[#1a1410] shadow-sm transition-colors duration-200 hover:bg-amber-400 ${
        variant === 'row' ? 'w-full justify-center px-4 py-2.5' : 'px-4 py-1.5'
      } ${isActive ? 'ring-2 ring-white/60' : ''}`}
    >
      <TbShoppingBag className="text-lg" />
      <span>Tienda</span>
    </Link>
  );
}
