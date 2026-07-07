import { formatPriceFromCents } from '@/lib/format-price';
import { calculateShippingCost } from '@/lib/shipping';
import type { CartItem } from '@/types/cart';
import PromocionBanner from './PromocionBanner';

interface CartSummaryProps {
  items: CartItem[];
}

export default function CartSummary({ items }: CartSummaryProps) {
  const subtotal = items.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const shippingCost = calculateShippingCost(subtotal);
  const total = subtotal + shippingCost;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-lg font-bold text-white">Resumen</h2>

      <PromocionBanner subtotal={subtotal} />

      <dl className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between text-white/70">
          <dt>Subtotal</dt>
          <dd>{formatPriceFromCents(subtotal)}</dd>
        </div>
        <div className="flex justify-between text-white/70">
          <dt>Gastos de envío</dt>
          <dd>{shippingCost === 0 ? 'Gratis' : formatPriceFromCents(shippingCost)}</dd>
        </div>
      </dl>

      <div className="mt-4 flex justify-between border-t border-white/10 pt-4 text-base font-bold text-white">
        <span>Total estimado</span>
        <span>{formatPriceFromCents(total)}</span>
      </div>

      <p className="mt-3 text-xs text-white/40">
        Total orientativo. El importe final se confirma en el pago.
      </p>
    </div>
  );
}
