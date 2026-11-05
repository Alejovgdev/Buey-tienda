import { getShopSettings } from '@/lib/shop-settings';
import ShopSettingsBanner from './ShopSettingsBanner';

export default async function ShopAvailabilityBanner() {
  const settings = await getShopSettings();
  return <ShopSettingsBanner settings={settings ?? {
    acceptingOrders: false, noticeMessage: null,
    checkoutDisabledMessage: 'No se ha podido comprobar la apertura de la tienda. Recarga la página para volver a intentarlo.',
  }} />;
}
