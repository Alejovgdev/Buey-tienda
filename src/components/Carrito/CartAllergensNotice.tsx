import { formatAllergenLabel } from '@/lib/format-allergen';
import type { CartItem } from '@/types/cart';

interface CartAllergensNoticeProps {
  items: CartItem[];
}

export default function CartAllergensNotice({ items }: CartAllergensNoticeProps) {
  const withAllergens = items.filter((item) => item.allergens.length > 0);

  if (withAllergens.length === 0) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-white/60">
        Alérgenos en tu pedido
      </h3>

      <div className="mt-3 space-y-3">
        {withAllergens.map((item) => (
          <div key={item.variantId}>
            <p className="text-sm font-medium text-white/80">{item.productName}</p>
            <ul className="mt-1 flex flex-wrap gap-2">
              {item.allergens.map((allergen) => (
                <li
                  key={allergen}
                  className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300"
                >
                  {formatAllergenLabel(allergen)}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
