'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { MATRIX_FIELD_KEYS, type LabelProfileFormInput } from '@/lib/labels/label-profile-form';
import { LABEL_FIELD_LABELS } from '@/lib/labels/label-fields';
import { DATE_TYPES } from '@/lib/labels/constants';

const DATE_TYPE_LABELS: Record<(typeof DATE_TYPES)[number], string> = {
  EXPIRY: 'Fecha de caducidad (seguridad alimentaria)',
  BEST_BEFORE: 'Consumo preferente (calidad)',
};

interface LabelProfileFormProps {
  mode: 'create' | 'edit';
  profileId?: string;
  initial: LabelProfileFormInput;
}

// Formulario compacto de un perfil de etiquetado: una fila de checkboxes por
// campo del catálogo (Visible/Obligatorio/Bloquea impresión) en vez de 5
// listas separadas — ver docs/FOOD_LABEL_ADMIN_DESIGN.md, §9, y el informe de
// implementación para la justificación de esta simplificación.
export default function LabelProfileForm({ mode, profileId, initial }: LabelProfileFormProps) {
  const router = useRouter();
  const [form, setForm] = useState<LabelProfileFormInput>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function setCell(field: string, patch: Partial<{ visible: boolean; required: boolean; blocking: boolean }>) {
    setForm((prev) => {
      const current = prev.matrix[field] ?? { visible: false, required: false, blocking: false };
      const next = { ...current, ...patch };
      if (!next.visible) {
        next.required = false;
        next.blocking = false;
      }
      if (!next.required) next.blocking = false;
      return { ...prev, matrix: { ...prev.matrix, [field]: next } };
    });
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const url =
      mode === 'create'
        ? '/api/admin/configuracion/etiquetas/perfiles'
        : `/api/admin/configuracion/etiquetas/perfiles/${profileId}`;

    try {
      const response = await fetch(url, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error ?? 'No se pudo guardar el perfil');
        return;
      }
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const dateFieldKey = form.dateType === 'EXPIRY' ? 'expiry_date' : 'best_before_date';
  const visibleMatrixFields = MATRIX_FIELD_KEYS.filter(
    (key) => key !== (form.dateType === 'EXPIRY' ? 'best_before_date' : 'expiry_date')
  );

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Clave interna</span>
          <input
            type="text"
            value={form.key}
            onChange={(e) => setForm((prev) => ({ ...prev, key: e.target.value }))}
            placeholder="carne_vacuno"
            disabled={mode === 'edit'}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900 disabled:bg-gray-100"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Nombre</span>
          <input
            type="text"
            value={form.name}
            onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
          />
        </label>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={form.isActive}
          onChange={(e) => setForm((prev) => ({ ...prev, isActive: e.target.checked }))}
        />
        Perfil activo (disponible para asignar a productos)
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Tipo de fecha</span>
          <select
            value={form.dateType}
            onChange={(e) => setForm((prev) => ({ ...prev, dateType: e.target.value as 'EXPIRY' | 'BEST_BEFORE' }))}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900"
          >
            {DATE_TYPES.map((type) => (
              <option key={type} value={type}>
                {DATE_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">
            Vida útil sugerida (días) <span className="font-normal text-gray-400">(opcional, solo sugerencia)</span>
          </span>
          <input
            type="number"
            min={1}
            value={form.suggestedShelfLifeDays ?? ''}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                suggestedShelfLifeDays: e.target.value ? Number(e.target.value) : null,
              }))
            }
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
          />
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-gray-700">Conservación por defecto</span>
        <textarea
          value={form.defaultStorageText ?? ''}
          onChange={(e) => setForm((prev) => ({ ...prev, defaultStorageText: e.target.value || null }))}
          rows={2}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-gray-700">Texto fijo adicional</span>
        <input
          type="text"
          value={form.fixedNote ?? ''}
          onChange={(e) => setForm((prev) => ({ ...prev, fixedNote: e.target.value || null }))}
          placeholder='p. ej. "Ultracongelado — no volver a congelar"'
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
        />
      </label>

      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.requiresWeight}
            onChange={(e) => setForm((prev) => ({ ...prev, requiresWeight: e.target.checked }))}
          />
          Requiere peso real
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.requiresLot}
            onChange={(e) => setForm((prev) => ({ ...prev, requiresLot: e.target.checked }))}
          />
          Requiere lote
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.requiresBeefTraceability}
            onChange={(e) => setForm((prev) => ({ ...prev, requiresBeefTraceability: e.target.checked }))}
          />
          Requiere trazabilidad de vacuno
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.requiresHealthMark}
            onChange={(e) => setForm((prev) => ({ ...prev, requiresHealthMark: e.target.checked }))}
          />
          Requiere marca sanitaria / RGSEAA
        </label>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-gray-700">Campos de la etiqueta</p>
        <div className="overflow-x-auto rounded-md border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Campo</th>
                <th className="px-3 py-2 text-center font-medium text-gray-600">Visible</th>
                <th className="px-3 py-2 text-center font-medium text-gray-600">Obligatorio</th>
                <th className="px-3 py-2 text-center font-medium text-gray-600">Bloquea impresión</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visibleMatrixFields.map((field) => {
                const cell = form.matrix[field] ?? { visible: false, required: false, blocking: false };
                const label = field === dateFieldKey ? LABEL_FIELD_LABELS[field] : LABEL_FIELD_LABELS[field];
                return (
                  <tr key={field}>
                    <td className="px-3 py-1.5 text-gray-800">{label}</td>
                    <td className="px-3 py-1.5 text-center">
                      <input
                        type="checkbox"
                        checked={cell.visible}
                        onChange={(e) => setCell(field, { visible: e.target.checked })}
                      />
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <input
                        type="checkbox"
                        checked={cell.required}
                        disabled={!cell.visible}
                        onChange={(e) => setCell(field, { required: e.target.checked })}
                      />
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <input
                        type="checkbox"
                        checked={cell.blocking}
                        disabled={!cell.required}
                        onChange={(e) => setCell(field, { blocking: e.target.checked })}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          El orden de impresión sigue el orden de este catálogo; no hay reordenación manual en esta versión.
        </p>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {saving ? 'Guardando…' : mode === 'create' ? 'Crear perfil' : 'Guardar perfil'}
      </button>
    </form>
  );
}
