import type { Metadata } from 'next';
import { getShopSettings } from '@/lib/shop-settings';
import ShopSettingsBanner from '@/components/Tienda/ShopSettingsBanner';
import CheckoutView from '@/components/Checkout/CheckoutView';

export const metadata: Metadata = {
  title: 'Finalizar compra | El Buey Madurado',
  description: 'Completa tus datos y paga tu pedido de forma segura.',
};

export default async function CheckoutPage() {
  const shopSettings = await getShopSettings();
  const acceptingOrders = shopSettings?.acceptingOrders ?? false;

  return (
    <div className="mx-auto max-w-5xl px-4 py-12 md:px-6 md:py-16">
      {shopSettings && <ShopSettingsBanner settings={shopSettings} />}

      <h1 className="mb-8 text-3xl font-extrabold text-white sm:text-4xl">Finalizar compra</h1>

      <CheckoutView acceptingOrders={acceptingOrders} />
    </div>
  );
}
