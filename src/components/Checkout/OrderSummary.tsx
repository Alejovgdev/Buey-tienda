import { formatPriceFromCents } from '@/lib/format-price';
import { calculateShippingCost } from '@/lib/shipping';
import type { CartItem } from '@/types/cart';
import PromocionBanner from '@/components/Carrito/PromocionBanner';

interface OrderSummaryProps {
  items: CartItem[];
}

export default function OrderSummary({ items }: OrderSummaryProps) {
  const subtotal = items.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const shippingCost = calculateShippingCost(subtotal);
  const total = subtotal + shippingCost;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <h2 className="text-lg font-bold text-white">Tu pedido</h2>

      <div className="mt-4 space-y-3 border-b border-white/10 pb-4">
        {items.map((item) => (
          <div key={item.variantId} className="flex justify-between gap-3 text-sm">
            <span className="text-white/70">
              {item.productName} <span className="text-white/40">— {item.variantName}</span>{' '}
              <span className="text-white/40">× {item.quantity}</span>
            </span>
            <span className="shrink-0 font-medium text-white">
              {formatPriceFromCents(item.unitPrice * item.quantity)}
            </span>
          </div>
        ))}
      </div>

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
        <span>Total revisado</span>
        <span>{formatPriceFromCents(total)}</span>
      </div>

      <p className="mt-3 text-xs text-white/40">
        Precios y disponibilidad comprobados. Se vuelven a validar al pulsar «Pagar con tarjeta».
      </p>
    </div>
  );
}
