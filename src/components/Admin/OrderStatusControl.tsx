'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import OrderStatusBadge from './OrderStatusBadge';
import { ORDER_STATUS_LABELS, isUnpaidStatus, type OrderStatus } from '@/lib/admin/order-status';

// Texto común de las confirmaciones sobre pedidos sin pagar.
export const CHECK_REDSYS_WARNING = 'Antes de continuar, comprueba en el TPV de Redsys que este pedido no se ha cobrado.';

function confirmationFor(status: string, next: OrderStatus, orderNumber: string): string | null {
  // Paso 6. Resolver la revisión emite la factura: crea un número definitivo.
  if (status === 'NEEDS_REVIEW' && next === 'PREPARING') {
    return 'Al pasar el pedido a Preparando se emitirá su factura simplificada con un número definitivo. ¿Continuar?';
  }
  if (isUnpaidStatus(status) && next === 'CANCELLED') {
    return `¿Cancelar el pedido ${orderNumber}? ${CHECK_REDSYS_WARNING}`;
  }
  if (next === 'SHIPPED') {
    return `¿Marcar el pedido ${orderNumber} como Enviado? Después ya no se podrá cambiar su estado. No se envía ningún email al cliente.`;
  }
  return null;
}

// Las transiciones disponibles las calcula el servidor (availableTransitions):
// incluyen la espera de 24 h de los pedidos sin pagar. `hint` explica por qué
// no hay ninguna cuando hay que esperar.
export default function OrderStatusControl({
  orderId,
  orderNumber,
  status,
  transitions,
  hint,
}: {
  orderId: string;
  orderNumber: string;
  status: string;
  transitions: OrderStatus[];
  hint?: string | null;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<OrderStatus | ''>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);


  async function handleApply() {
    if (!selected) return;
    const question = confirmationFor(status, selected, orderNumber);
    if (question && !window.confirm(question)) return;
    setSaving(true);
    setError(null);
    setNotice(null);

    try {
      const response = await fetch(`/api/admin/pedidos/${orderId}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: selected }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error ?? 'No se pudo cambiar el estado');
        return;
      }

      const data = await response.json().catch(() => null);
      if (data?.invoice) {
        setNotice(
          data.invoice.ok
            ? { kind: 'ok', text: `Factura ${data.invoice.invoiceNumber} emitida.` }
            : { kind: 'error', text: 'El estado se ha cambiado, pero la factura no se ha emitido. Revisa la sección Factura.' }
        );
      }
      setSelected('');
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <OrderStatusBadge status={status} />

      {transitions.length > 0 && (
        <div className="flex items-center gap-2">
          <select
            value={selected}
            onChange={(event) => setSelected(event.target.value as OrderStatus | '')}
            className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm text-gray-900"
          >
            <option value="">Cambiar estado…</option>
            {transitions.map((next) => (
              <option key={next} value={next}>
                {ORDER_STATUS_LABELS[next]}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={handleApply}
            disabled={!selected || saving}
            className="rounded-md bg-gray-900 px-3 py-1 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Aplicar'}
          </button>
        </div>
      )}

      {transitions.length === 0 && hint && <p className="text-sm text-gray-500">{hint}</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {notice && (
        <p className={notice.kind === 'ok' ? 'text-sm text-green-700' : 'text-sm text-red-600'}>{notice.text}</p>
      )}
    </div>
  );
}
