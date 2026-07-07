'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function OrderNotesForm({ orderId, initialNotes }: { orderId: string; initialNotes: string | null }) {
  const router = useRouter();
  const [notes, setNotes] = useState(initialNotes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSaved(false);

    try {
      const response = await fetch(`/api/admin/pedidos/${orderId}/notas`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error ?? 'No se pudo guardar la nota');
        return;
      }

      setSaved(true);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <textarea
        value={notes}
        onChange={(event) => {
          setNotes(event.target.value);
          setSaved(false);
        }}
        rows={4}
        placeholder="Notas para el equipo (transporte manual, incidencias, etc.)"
        className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900 focus:border-gray-500 focus:outline-none"
      />
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {saving ? 'Guardando…' : 'Guardar nota'}
        </button>
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!error && saved && <p className="text-sm text-green-700">Guardado.</p>}
      </div>
    </div>
  );
}
