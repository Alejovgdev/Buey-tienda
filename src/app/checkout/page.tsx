import type { Metadata } from 'next';
import ShopAvailabilityBanner from '@/components/Tienda/ShopAvailabilityBanner';
import CheckoutView from '@/components/Checkout/CheckoutView';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Finalizar compra | El Buey Madurado',
  description: 'Completa tus datos y paga tu pedido de forma segura.',
};

export default async function CheckoutPage() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-12 md:px-6 md:py-16">
      <ShopAvailabilityBanner />

      <h1 className="mb-8 text-3xl font-extrabold text-white sm:text-4xl">Finalizar compra</h1>

      <CheckoutView />
    </div>
  );
}
