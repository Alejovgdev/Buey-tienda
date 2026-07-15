'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface MarkOrderLabeledButtonProps {
  orderId: string;
  disabled: boolean;
  disabledReason?: string;
}

// Confirmación explícita, nunca automática (docs/FOOD_LABEL_ADMIN_DESIGN.md,
// §5.10) — no cambia orders.status, solo registra labeled_at/labeled_by.
export default function MarkOrderLabeledButton({ orderId, disabled, disabledReason }: MarkOrderLabeledButtonProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (!window.confirm('¿Confirmas que el pedido está completamente preparado y etiquetado?')) return;
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/pedidos/${orderId}/preparado`, { method: 'POST' });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error ?? 'No se pudo marcar como preparado');
        return;
      }
      router.push(`/admin/pedidos/${orderId}`);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || loading}
        title={disabled ? disabledReason : undefined}
        className="rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading ? 'Guardando…' : 'Marcar pedido como preparado'}
      </button>
      {disabled && disabledReason && <p className="mt-1 text-xs text-gray-500">{disabledReason}</p>}
      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
