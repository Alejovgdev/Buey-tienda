'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export interface OperatorConfigFormValues {
  legalName: string;
  taxId: string;
  address: string;
  country: string;
  healthRegistryCode: string;
  identificationMark: string;
}

// Datos globales del operador alimentario. healthRegistryCode/identificationMark
// son opcionales a propósito — no bloquean nada por sí solos, cada perfil de
// etiquetado decide si los exige (docs/FOOD_LABEL_ADMIN_DESIGN.md, §17).
export default function OperatorConfigForm({ initial }: { initial: OperatorConfigFormValues }) {
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function setField<K extends keyof OperatorConfigFormValues>(key: K, value: OperatorConfigFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/configuracion/etiquetas/operador', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          legalName: values.legalName || null,
          taxId: values.taxId || null,
          address: values.address || null,
          country: values.country,
          healthRegistryCode: values.healthRegistryCode || null,
          identificationMark: values.identificationMark || null,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error ?? 'No se pudo guardar');
        return;
      }
      setSaved(true);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Razón social</span>
          <input
            type="text"
            value={values.legalName}
            onChange={(e) => setField('legalName', e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">NIF</span>
          <input
            type="text"
            value={values.taxId}
            onChange={(e) => setField('taxId', e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
          />
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-gray-700">Dirección</span>
        <input
          type="text"
          value={values.address}
          onChange={(e) => setField('address', e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">
            Registro sanitario / RGSEAA <span className="font-normal text-gray-400">(opcional)</span>
          </span>
          <input
            type="text"
            value={values.healthRegistryCode}
            onChange={(e) => setField('healthRegistryCode', e.target.value)}
            placeholder="Solo si algún perfil lo requiere"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">
            Marca de identificación / nº autorización <span className="font-normal text-gray-400">(opcional)</span>
          </span>
          <input
            type="text"
            value={values.identificationMark}
            onChange={(e) => setField('identificationMark', e.target.value)}
            placeholder='p. ej. "ES 12.345/V CE"'
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
          />
        </label>
      </div>

      <p className="text-xs text-gray-500">
        Estos dos últimos datos nunca se imprimen por defecto: solo aparecen en las etiquetas de los perfiles que
        tengan activado &quot;Requiere marca sanitaria&quot;.
      </p>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {saved && !error && <p className="text-sm text-green-700">Guardado.</p>}

      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {saving ? 'Guardando…' : 'Guardar datos del operador'}
      </button>
    </form>
  );
}
