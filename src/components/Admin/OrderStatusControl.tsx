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

  const currentStatus = isValidOrderStatus(status) ? status : null;
  const transitions = currentStatus ? ORDER_STATUS_TRANSITIONS[currentStatus] : [];

  async function handleApply() {
    if (!selected) return;
    setSaving(true);
    setError(null);

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
    </div>
  );
}
