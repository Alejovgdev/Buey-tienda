import type { Metadata } from 'next';
import { Suspense } from 'react';
import CarritoView from '@/components/Carrito/CarritoView';

export const metadata: Metadata = {
  title: 'Tu carrito | El Buey Madurado',
  description: 'Revisa los productos de tu carrito antes de finalizar el pedido.',
  robots: { index: false, follow: true },
};

export default function CarritoPage() {
  return (
    <Suspense fallback={null}>
      <CarritoView />
    </Suspense>
  );
}
