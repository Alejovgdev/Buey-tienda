import { getShopSettings } from '@/lib/shop-settings';
import ShopSettingsBanner from './ShopSettingsBanner';
import type { ShopSettingsData } from '@/types/shop';

export default async function ShopAvailabilityBanner({ settings: snapshot }: { settings?: ShopSettingsData | null }) {
  // La ficha comparte una única lectura entre aviso visible y oferta estructurada.
  const settings = snapshot === undefined ? await getShopSettings() : snapshot;
  return <ShopSettingsBanner settings={settings ?? {
    acceptingOrders: false, noticeMessage: null,
    checkoutDisabledMessage: 'No se ha podido comprobar la apertura de la tienda. Recarga la página para volver a intentarlo.',
  }} />;
}
