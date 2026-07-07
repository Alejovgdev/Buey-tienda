'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCart } from '@/contexts/CartContext';
import CartLineItem from './CartLineItem';
import CartSummary from './CartSummary';
import CartAllergensNotice from './CartAllergensNotice';

export default function CarritoView() {
  const { items, isLoaded } = useCart();
  const searchParams = useSearchParams();
  const pagoFallido = searchParams.get('pago') === 'fallido';

  if (!isLoaded) {
    return <div className="mx-auto max-w-4xl px-4 py-24 text-center text-white/40">Cargando…</div>;
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        {pagoFallido && (
          <div
            role="status"
            className="mb-8 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-left text-sm text-red-200 md:text-base"
          >
            El pago no se ha completado.
          </div>
        )}
        <h1 className="text-2xl font-bold text-white sm:text-3xl">Tu carrito está vacío</h1>
        <p className="mt-3 text-white/60">
          Descubre nuestra selección de carne madurada, hamburguesas artesanas y productos
          gourmet.
        </p>
        <Link
          href="/tienda"
          className="mt-6 inline-flex rounded-full border border-transparent bg-amber-500 px-6 py-3 font-semibold text-[#1a1410] transition-colors duration-200 hover:border-amber-500 hover:bg-[#1a1410] hover:text-amber-500"
        >
          Ir a la tienda
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 md:px-6 md:py-16">
      <h1 className="mb-8 text-3xl font-extrabold text-white sm:text-4xl">Tu carrito</h1>

      {pagoFallido && (
        <div
          role="status"
          className="mb-8 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-4 text-sm text-red-200 md:text-base"
        >
          El pago no se ha completado. Tu carrito sigue intacto — puedes intentarlo de nuevo
          cuando quieras.
        </div>
      )}

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_360px]">
        <div className="rounded-2xl border border-white/10 bg-white/5 px-6">
          {items.map((item) => (
            <CartLineItem key={item.variantId} item={item} />
          ))}
        </div>

        <div className="space-y-6">
          <CartSummary items={items} />
          <CartAllergensNotice items={items} />
          <Link
            href="/checkout"
            className="flex w-full items-center justify-center rounded-full border border-transparent bg-amber-500 px-6 py-3 font-semibold text-[#1a1410] transition-colors duration-200 hover:border-amber-500 hover:bg-[#1a1410] hover:text-amber-500"
          >
            Proceder al pago
          </Link>
        </div>
      </div>
    </div>
  );
}
