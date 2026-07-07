import { supabase } from './supabase';
import type { ShopSettingsData } from '@/types/shop';

export async function getShopSettings(): Promise<ShopSettingsData | null> {
  const { data, error } = await supabase
    .from('shop_settings')
    .select('accepting_orders, notice_message, checkout_disabled_message')
    .maybeSingle();

  if (error || !data) return null;

  return {
    acceptingOrders: data.accepting_orders,
    noticeMessage: data.notice_message,
    checkoutDisabledMessage: data.checkout_disabled_message,
  };
}
