'use client';

import { useEffect, useState } from 'react';
import { formatPriceFromCents } from '@/lib/format-price';
import type { PromotionAvailability } from '@/types/cart';

interface PromocionBannerProps {
  subtotal: number;
}

export default function PromocionBanner({ subtotal }: PromocionBannerProps) {
  const [promo, setPromo] = useState<PromotionAvailability | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/tienda/promocion-activa')
      .then((res) => res.json())
      .then((data: PromotionAvailability) => {
        if (!cancelled) setPromo(data);
      })
      .catch(() => {
        if (!cancelled) setPromo({ available: false });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!promo || !promo.available) return null;

  const thresholdMet = promo.minSubtotal === null || subtotal >= promo.minSubtotal;

  if (!thresholdMet) {
    const remaining = promo.minSubtotal! - subtotal;
    return (
      <p className="mt-4 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
        Te faltan <strong>{formatPriceFromCents(remaining)}</strong> para conseguir {promo.giftName}
      </p>
    );
  }

  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
      <span>
        🎁 ¡Promoción aplicada! <strong>{promo.giftName}</strong> incluido
      </span>
      <span className="shrink-0 font-semibold">0,00 €</span>
    </div>
  );
}
