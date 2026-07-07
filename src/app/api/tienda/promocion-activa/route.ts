import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';

// Fase 3, sección 13. Primer uso de supabase-admin en código de aplicación:
// `promotions` no tiene política de lectura pública (Fase 1, hallazgo de la
// migración 0007), así que este endpoint es la única vía por la que el
// frontend puede saber si hay una promoción disponible. Solo devuelve lo
// mínimo que la UI necesita para mostrar el mensaje — nunca id,
// current_redemptions, max_redemptions ni starts_at/ends_at.
export const dynamic = 'force-dynamic';

type PromotionRow = {
  min_subtotal: number | null;
  max_redemptions: number | null;
  current_redemptions: number;
  gift_variant: {
    name: string;
    product: { name: string } | null;
  } | null;
};

export async function GET() {
  const nowIso = new Date().toISOString();

  const { data, error } = await supabaseAdmin
    .from('promotions')
    .select(
      `
      min_subtotal,
      max_redemptions,
      current_redemptions,
      gift_variant:product_variants!promotions_gift_variant_id_fkey (
        name,
        product:products ( name )
      )
    `
    )
    .eq('is_active', true)
    .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
    .or(`ends_at.is.null,ends_at.gte.${nowIso}`);

  if (error) {
    return NextResponse.json({ available: false });
  }

  const rows = data as unknown as PromotionRow[];

  const available = rows.find(
    (promo) =>
      promo.gift_variant?.product &&
      (promo.max_redemptions === null || promo.current_redemptions < promo.max_redemptions)
  );

  if (!available || !available.gift_variant?.product) {
    return NextResponse.json({ available: false });
  }

  return NextResponse.json({
    available: true,
    minSubtotal: available.min_subtotal,
    giftName: `${available.gift_variant.product.name} — ${available.gift_variant.name}`,
  });
}
