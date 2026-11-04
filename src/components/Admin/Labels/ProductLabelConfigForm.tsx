'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import type { ProductLabelConfigInput } from '@/lib/labels/product-label-config-schema';
import { FOOD_LABELING_ENABLED } from '@/lib/admin/features';

export interface ProductLabelConfigFormProps {
  productId: string;
  initial: ProductLabelConfigInput;
  profiles: { id: string; name: string }[];
}

// Datos alimentarios compartidos y configuración interna de etiquetas cuando
// el módulo está habilitado. Precio, stock, imágenes y categorías se siguen
// gestionando donde ya se gestionaban.
export default function ProductLabelConfigForm({ productId, initial, profiles }: ProductLabelConfigFormProps) {
  const router = useRouter();
  const [form, setForm] = useState(initial);
  const [allergensText, setAllergensText] = useState(initial.allergens.join(', '));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);

    const { labelProfileId, labelDisplayName, usualUnitsPerPackage, suggestedPackageCount, ...sharedFields } = form;
    const payload = {
      ...sharedFields,
      ...(FOOD_LABELING_ENABLED ? { labelProfileId, labelDisplayName, usualUnitsPerPackage, suggestedPackageCount } : {}),
      allergens: allergensText
        .split(',')
        .map((value) => value.trim().toLowerCase())
        .filter(Boolean),
    };

    try {
      const response = await fetch(`/api/admin/configuracion/etiquetas/productos/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error ?? 'No se pudo guardar');
        return;
      }
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {FOOD_LABELING_ENABLED && <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Perfil de etiquetado</span>
          <select
            value={form.labelProfileId ?? ''}
            onChange={(e) => setForm((prev) => ({ ...prev, labelProfileId: e.target.value || null }))}
            className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-gray-900"
          >
            <option value="">Sin perfil asignado</option>
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </select>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">
            Denominación de etiqueta <span className="font-normal text-gray-400">(si difiere del nombre comercial)</span>
          </span>
          <input
            type="text"
            value={form.labelDisplayName ?? ''}
            onChange={(e) => setForm((prev) => ({ ...prev, labelDisplayName: e.target.value || null }))}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
          />
        </label>
      </div>}

      <div className={FOOD_LABELING_ENABLED ? 'grid gap-3 sm:grid-cols-3' : 'grid gap-3'}>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">País/lugar de origen</span>
          <input
            type="text"
            value={form.countryOfOrigin ?? ''}
            onChange={(e) => setForm((prev) => ({ ...prev, countryOfOrigin: e.target.value || null }))}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
          />
        </label>
        {FOOD_LABELING_ENABLED && <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Unidades habituales por envase</span>
          <input
            type="number"
            min={1}
            value={form.usualUnitsPerPackage}
            onChange={(e) => setForm((prev) => ({ ...prev, usualUnitsPerPackage: Number(e.target.value) || 1 }))}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
          />
        </label>}
        {FOOD_LABELING_ENABLED && <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Envases sugeridos por unidad vendida</span>
          <input
            type="number"
            min={1}
            value={form.suggestedPackageCount}
            onChange={(e) => setForm((prev) => ({ ...prev, suggestedPackageCount: Number(e.target.value) || 1 }))}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
          />
        </label>}
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-gray-700">Ingredientes</span>
        <textarea
          value={form.ingredients ?? ''}
          onChange={(e) => setForm((prev) => ({ ...prev, ingredients: e.target.value || null }))}
          rows={2}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Alérgenos (separados por comas)</span>
          <input
            type="text"
            value={allergensText}
            onChange={(e) => setAllergensText(e.target.value)}
            placeholder="gluten, leche, huevo"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Notas de alérgenos</span>
          <input
            type="text"
            value={form.allergensNotes ?? ''}
            onChange={(e) => setForm((prev) => ({ ...prev, allergensNotes: e.target.value || null }))}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
          />
        </label>
      </div>

      <label className="block text-sm">
        <span className="mb-1 block font-medium text-gray-700">Condiciones de conservación</span>
        <input
          type="text"
          value={form.storageConditions ?? ''}
          onChange={(e) => setForm((prev) => ({ ...prev, storageConditions: e.target.value || null }))}
          placeholder={FOOD_LABELING_ENABLED ? 'Vacío por defecto del perfil si se deja en blanco' : undefined}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
        />
      </label>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Instrucciones de uso</span>
          <input
            type="text"
            value={form.prepInstructions ?? ''}
            onChange={(e) => setForm((prev) => ({ ...prev, prepInstructions: e.target.value || null }))}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Modo de cocinado</span>
          <input
            type="text"
            value={form.cookingMethod ?? ''}
            onChange={(e) => setForm((prev) => ({ ...prev, cookingMethod: e.target.value || null }))}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-gray-900"
          />
        </label>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
      >
        {saving ? 'Guardando…' : 'Guardar configuración'}
      </button>
    </form>
  );
}
