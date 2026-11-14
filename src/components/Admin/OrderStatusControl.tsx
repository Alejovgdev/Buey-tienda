'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import OrderStatusBadge from './OrderStatusBadge';
import { ORDER_STATUS_LABELS, ORDER_STATUS_TRANSITIONS, isValidOrderStatus, type OrderStatus } from '@/lib/admin/order-status';

export default function OrderStatusControl({ orderId, status }: { orderId: string; status: string }) {
  const router = useRouter();
  const [selected, setSelected] = useState<OrderStatus | ''>('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const currentStatus = isValidOrderStatus(status) ? status : null;
  const transitions = currentStatus ? ORDER_STATUS_TRANSITIONS[currentStatus] : [];

  async function handleApply() {
    if (!selected) return;
    // Paso 6. Resolver la revisión emite la factura: crea un número definitivo.
    if (
      status === 'NEEDS_REVIEW' &&
      selected === 'PREPARING' &&
      !window.confirm('Al pasar el pedido a Preparando se emitirá su factura simplificada con un número definitivo. ¿Continuar?')
    ) {
      return;
    }
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

      {error && <p className="text-sm text-red-600">{error}</p>}
      {notice && (
        <p className={notice.kind === 'ok' ? 'text-sm text-green-700' : 'text-sm text-red-600'}>{notice.text}</p>
      )}
    </div>
  );
}
