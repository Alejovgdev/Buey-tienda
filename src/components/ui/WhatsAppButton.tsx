'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FaCalendarAlt } from 'react-icons/fa';

// Dentro del flujo de compra (tienda/carrito/checkout/confirmacion) no tiene
// sentido invitar a reservar mesa mientras el usuario compra online, y el
// boton flotante llega a tapar tarjetas de producto. En /reservas tambien se
// oculta porque el usuario ya esta en ese flujo, y en /admin porque es una
// herramienta interna.
function isInShopFlow(pathname: string): boolean {
  return (
    pathname.startsWith('/tienda') ||
    pathname.startsWith('/carrito') ||
    pathname.startsWith('/checkout') ||
    pathname.startsWith('/pedido') ||
    pathname.startsWith('/reservas') ||
    pathname.startsWith('/admin')
  );
}

export default function ReservasButton() {
  const pathname = usePathname();

  // La portada ya incluye sus propios accesos a reservas.
  if (pathname === '/' || isInShopFlow(pathname)) return null;

  return (
    <Link
      href="/reservas"
      aria-label="Reservar mesa"
      className="
        fixed bottom-8 right-5 z-40
        flex items-center gap-2
        px-5 py-3
        rounded-full
        bg-amber-500 text-[#1a1410]
        font-semibold
        shadow-xl
        transition-all duration-300
        hover:scale-105 hover:bg-amber-400
        active:scale-95
      "
      prefetch
    >
      <FaCalendarAlt className="text-sm" />
      Reservar
    </Link>
  );
}
