'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { Tables } from '@/supabase/types';
import {
  resolveLabelValuesFromProductLabel,
  type LabelProfileRules,
  type OperatorData,
  type ResolvedLabelValues,
} from '@/lib/labels/label-snapshot';
import { getLabelValidationIssues } from '@/lib/labels/label-validation';
import { LABEL_STATUS_LABELS, type LabelStatus } from '@/lib/labels/constants';
import { formatLabelDate } from '@/lib/labels/label-date';

type ProductLabelRow = Tables<'product_labels'>;

const STATUS_BADGE_CLASSES: Record<LabelStatus, string> = {
  PENDING: 'bg-gray-200 text-gray-700',
  READY: 'bg-blue-100 text-blue-800',
  PRINTED: 'bg-green-100 text-green-800',
  REPRINTED: 'bg-amber-100 text-amber-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

function statusLabel(status: string): string {
  return (LABEL_STATUS_LABELS as Record<string, string>)[status] ?? status;
}

function statusBadgeClass(status: string): string {
  return (STATUS_BADGE_CLASSES as Record<string, string>)[status] ?? 'bg-gray-200 text-gray-700';
}

interface LabelLineCardProps {
  orderId: string;
  orderItemId: string;
  productName: string;
  variantName: string;
  quantity: number;
  isGift: boolean;
  profile: LabelProfileRules | null;
  operatorData: OperatorData;
  lineValues: ResolvedLabelValues;
  suggestedCount: number;
  labels: ProductLabelRow[];
}

// Una línea de pedido = una tarjeta. Genera N etiquetas (una por envase) y,
// una vez generadas, lista cada envase con sus propias acciones — ver
// docs/FOOD_LABEL_ADMIN_DESIGN.md, §5.2-§5.4 y §8.
export default function LabelLineCard({
  orderId,
  orderItemId,
  productName,
  variantName,
  quantity,
  isGift,
  profile,
  operatorData,
  lineValues,
  suggestedCount,
  labels,
}: LabelLineCardProps) {
  const router = useRouter();
  const activeLabels = labels.filter((label) => label.status !== 'CANCELLED');
  const cancelledCount = labels.length - activeLabels.length;
  const [desiredCount, setDesiredCount] = useState(Math.max(suggestedCount, activeLabels.length, 1));
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const lineIssues = profile ? getLabelValidationIssues(lineValues, profile, ['product_config']) : [];
  const hasBlockingLineIssues = lineIssues.some((issue) => issue.blocksPrinting);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/pedidos/${orderId}/etiquetas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderItemId, desiredCount }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error ?? 'No se pudieron generar las etiquetas');
        return;
      }
      router.refresh();
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="rounded-lg border border-gray-200 p-4">
      <div className="mb-2">
        <p className="font-semibold text-gray-900">
          {isGift && (
            <span className="mr-1" aria-hidden="true">
              🎁
            </span>
          )}
          {productName} — {variantName} × {quantity}
        </p>
        {!profile && (
          <p className="text-sm font-medium text-orange-700">
            Sin perfil de etiquetado asignado — configúralo en Configuración de etiquetas antes de generar etiquetas.
          </p>
        )}
      </div>

      {lineIssues.length > 0 && (
        <ul className="mb-3 space-y-1 rounded-md bg-orange-50 p-2 text-sm text-orange-800">
          {lineIssues.map((issue) => (
            <li key={issue.field}>{issue.message}</li>
          ))}
        </ul>
      )}

      {activeLabels.length === 0 ? (
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-sm text-gray-700">
            Envases a preparar{' '}
            <input
              type="number"
              min={1}
              value={desiredCount}
              onChange={(e) => setDesiredCount(Math.max(1, Number(e.target.value) || 1))}
              className="ml-1 w-20 rounded-md border border-gray-300 px-2 py-1 text-gray-900"
            />
          </label>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating || !profile || hasBlockingLineIssues}
            className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {generating ? 'Generando…' : `Generar ${desiredCount} etiqueta(s)`}
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {activeLabels.map((label) => (
            <LabelPackageRow key={label.id} orderId={orderId} label={label} profile={profile} operatorData={operatorData} />
          ))}

          <div className="flex flex-wrap items-center gap-2 border-t border-gray-100 pt-2">
            <label className="text-sm text-gray-700">
              Añadir hasta un total de{' '}
              <input
                type="number"
                min={activeLabels.length + 1}
                value={desiredCount}
                onChange={(e) => setDesiredCount(Math.max(1, Number(e.target.value) || 1))}
                className="ml-1 w-20 rounded-md border border-gray-300 px-2 py-1 text-gray-900"
              />{' '}
              envases
            </label>
            <button
              type="button"
              onClick={handleGenerate}
              disabled={generating || desiredCount <= activeLabels.length}
              className="rounded-md border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {generating ? 'Generando…' : 'Añadir envases'}
            </button>
          </div>
        </div>
      )}

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

      {cancelledCount > 0 && (
        <p className="mt-2 text-xs text-gray-400">
          {cancelledCount} etiqueta(s) anulada(s) en esta línea (histórico conservado, no cuentan para el total).
        </p>
      )}
    </div>
  );
}

function LabelPackageRow({
  orderId,
  label,
  profile,
  operatorData,
}: {
  orderId: string;
  label: ProductLabelRow;
  profile: LabelProfileRules | null;
  operatorData: OperatorData;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    weightGrams: label.weight_grams ?? ('' as number | ''),
    lote: label.lote ?? '',
    elaborationDate: label.elaboration_date ?? '',
    packagingDate: label.packaging_date ?? '',
    expiryDate: label.expiry_date ?? '',
    bestBeforeDate: label.best_before_date ?? '',
    unitsInPackage: label.units_in_package,
    beefTraceabilityInfo: label.beef_traceability_info ?? '',
    countryOfOrigin: label.country_of_origin ?? '',
  });
  const [saving, setSaving] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const values = profile ? resolveLabelValuesFromProductLabel(label, operatorData) : null;
  const issues = profile && values ? getLabelValidationIssues(values, profile) : [];
  const blockingIssues = issues.filter((issue) => issue.blocksPrinting);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/etiquetas/${label.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          weightGrams: form.weightGrams === '' ? null : Number(form.weightGrams),
          lote: form.lote || undefined,
          elaborationDate: form.elaborationDate || null,
          packagingDate: form.packagingDate || null,
          expiryDate: form.expiryDate || null,
          bestBeforeDate: form.bestBeforeDate || null,
          unitsInPackage: form.unitsInPackage,
          beefTraceabilityInfo: form.beefTraceabilityInfo || null,
          countryOfOrigin: form.countryOfOrigin || null,
        }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error ?? 'No se pudo guardar');
        return;
      }
      setEditing(false);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  async function handleCancel() {
    const reason = window.prompt('Motivo de la anulación de este envase:');
    if (!reason) return;
    setCancelling(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/etiquetas/${label.id}/anular`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error ?? 'No se pudo anular');
        return;
      }
      router.refresh();
    } finally {
      setCancelling(false);
    }
  }

  return (
    <div className="rounded-md border border-gray-100 bg-gray-50 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm">
          <span className="font-medium text-gray-800">
            Envase {label.package_sequence} de {label.package_count_for_line}
          </span>{' '}
          <span className={`ml-1 rounded px-2 py-0.5 text-xs font-medium ${statusBadgeClass(label.status)}`}>
            {statusLabel(label.status)}
          </span>
          <span className="ml-2 text-gray-500">
            Lote {label.lote || '—'} · {label.weight_grams ? `${label.weight_grams} g` : 'sin peso'} · Cad.{' '}
            {formatLabelDate(label.expiry_date || label.best_before_date)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-3 text-sm">
          <button type="button" onClick={() => setEditing((value) => !value)} className="text-blue-700 hover:underline">
            {editing ? 'Cerrar' : 'Editar'}
          </button>
          <Link href={`/admin/pedidos/${orderId}/etiquetas/${label.id}/vista-previa`} className="text-blue-700 hover:underline">
            Vista previa
          </Link>
          <Link
            href={`/admin/pedidos/${orderId}/etiquetas/imprimir?ids=${label.id}`}
            className="font-medium text-gray-900 hover:underline"
          >
            Imprimir
          </Link>
          <button type="button" onClick={handleCancel} disabled={cancelling} className="text-red-600 hover:underline disabled:opacity-50">
            Anular
          </button>
        </div>
      </div>

      {blockingIssues.length > 0 && (
        <ul className="mt-2 space-y-0.5 text-xs text-orange-700">
          {blockingIssues.map((issue) => (
            <li key={issue.field}>⚠ {issue.message}</li>
          ))}
        </ul>
      )}

      {editing && (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-0.5 block text-gray-600">Peso real (g)</span>
            <input
              type="number"
              value={form.weightGrams}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, weightGrams: e.target.value === '' ? '' : Number(e.target.value) }))
              }
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-gray-900"
            />
          </label>
          <label className="text-sm">
            <span className="mb-0.5 block text-gray-600">Lote</span>
            <input
              type="text"
              value={form.lote}
              onChange={(e) => setForm((prev) => ({ ...prev, lote: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-gray-900"
            />
          </label>
          <label className="text-sm">
            <span className="mb-0.5 block text-gray-600">Fecha de elaboración</span>
            <input
              type="date"
              value={form.elaborationDate}
              onChange={(e) => setForm((prev) => ({ ...prev, elaborationDate: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-gray-900"
            />
          </label>
          <label className="text-sm">
            <span className="mb-0.5 block text-gray-600">Fecha de envasado</span>
            <input
              type="date"
              value={form.packagingDate}
              onChange={(e) => setForm((prev) => ({ ...prev, packagingDate: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-gray-900"
            />
          </label>
          {profile?.dateType === 'BEST_BEFORE' ? (
            <label className="text-sm">
              <span className="mb-0.5 block text-gray-600">Consumo preferente</span>
              <input
                type="date"
                value={form.bestBeforeDate}
                onChange={(e) => setForm((prev) => ({ ...prev, bestBeforeDate: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-2 py-1 text-gray-900"
              />
            </label>
          ) : (
            <label className="text-sm">
              <span className="mb-0.5 block text-gray-600">Fecha de caducidad</span>
              <input
                type="date"
                value={form.expiryDate}
                onChange={(e) => setForm((prev) => ({ ...prev, expiryDate: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-2 py-1 text-gray-900"
              />
            </label>
          )}
          <label className="text-sm">
            <span className="mb-0.5 block text-gray-600">Unidades en este envase</span>
            <input
              type="number"
              min={1}
              value={form.unitsInPackage}
              onChange={(e) =>
                setForm((prev) => ({ ...prev, unitsInPackage: Math.max(1, Number(e.target.value) || 1) }))
              }
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-gray-900"
            />
          </label>
          {profile?.requiresBeefTraceability && (
            <label className="text-sm sm:col-span-2">
              <span className="mb-0.5 block text-gray-600">Trazabilidad de vacuno</span>
              <input
                type="text"
                value={form.beefTraceabilityInfo}
                onChange={(e) => setForm((prev) => ({ ...prev, beefTraceabilityInfo: e.target.value }))}
                className="w-full rounded-md border border-gray-300 px-2 py-1 text-gray-900"
              />
            </label>
          )}
          <label className="text-sm">
            <span className="mb-0.5 block text-gray-600">País/lugar de origen</span>
            <input
              type="text"
              value={form.countryOfOrigin}
              onChange={(e) => setForm((prev) => ({ ...prev, countryOfOrigin: e.target.value }))}
              className="w-full rounded-md border border-gray-300 px-2 py-1 text-gray-900"
            />
          </label>

          <div className="sm:col-span-2">
            {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              {saving ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      {!editing && error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
