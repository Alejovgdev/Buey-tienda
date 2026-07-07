import type { ShopSettingsData } from '@/types/shop';

interface ShopSettingsBannerProps {
  settings: ShopSettingsData;
}

export default function ShopSettingsBanner({ settings }: ShopSettingsBannerProps) {
  const message = settings.acceptingOrders
    ? settings.noticeMessage
    : settings.checkoutDisabledMessage;

  if (!message) return null;

  return (
    <div
      role="status"
      className={`mb-8 rounded-2xl border px-5 py-4 text-sm md:text-base ${
        settings.acceptingOrders
          ? 'border-amber-500/30 bg-amber-500/10 text-amber-200'
          : 'border-red-500/30 bg-red-500/10 text-red-200'
      }`}
    >
      {message}
    </div>
  );
}
