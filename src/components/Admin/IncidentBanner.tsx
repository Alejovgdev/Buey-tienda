import { formatDateTime } from '@/lib/admin/format-datetime';
import { formatPriceFromCents } from '@/lib/format-price';
import { getMetadataField, getMetadataString, type IncidentSeverity } from '@/lib/admin/incidents';
import type { Json } from '@/supabase/types';

export type IncidentEvent = {
  id: string;
  eventType: string;
  severity: IncidentSeverity;
  metadata: Json | null;
  createdAt: string;
};

const SEVERITY_STYLES: Record<IncidentSeverity, { container: string; label: string; labelClasses: string }> = {
  critical: {
    container: 'border-2 border-red-600 bg-red-50',
    label: 'REVISIÓN MANUAL REQUERIDA',
    labelClasses: 'bg-red-600 text-white',
  },
  action_required: {
    container: 'border-2 border-amber-500 bg-amber-50',
    label: 'ACCIÓN OBLIGATORIA',
    labelClasses: 'bg-amber-500 text-white',
  },
  info: {
    container: 'border border-sky-400 bg-sky-50',
    label: 'INFORMATIVO',
    labelClasses: 'bg-sky-500 text-white',
  },
};

function formatCentsField(value: Json | undefined): string {
  if (typeof value === 'number') return formatPriceFromCents(value);
  if (typeof value === 'string' && /^-?\d+$/.test(value)) return formatPriceFromCents(Number(value));
  return '—';
}

// Fase 7, Unidad 4. Consume la instrumentación de order_status_history de la
// Fase 5 (docs/pendientes-panel-admin.md) y le da a cada evento el
// tratamiento que su urgencia real exige — nunca una línea más del timeline.
function IncidentContent({ incident, giftNames }: { incident: IncidentEvent; giftNames: Map<string, string> }) {
  if (incident.eventType === 'IMPORTE_INCOHERENTE') {
    const dsAmount = getMetadataField(incident.metadata, 'ds_amount');
    const orderTotal = getMetadataField(incident.metadata, 'order_total');
    return (
      <>
        <p className="font-semibold text-gray-900">
          El importe notificado por Redsys no coincide con el total del pedido. Puede tratarse de un error o de una
          manipulación de la notificación de pago — no dar este pedido por bueno sin revisarlo a mano.
        </p>
        <p className="mt-1 text-sm text-gray-700">
          Importe recibido de Redsys: <strong>{formatCentsField(dsAmount)}</strong> · Total del pedido:{' '}
          <strong>{formatCentsField(orderTotal)}</strong>
        </p>
      </>
    );
  }

  if (incident.eventType === 'PAYMENTS_INSERT_ERROR') {
    const dsOrder = getMetadataString(incident.metadata, 'ds_order');
    const dsAuthorization = getMetadataString(incident.metadata, 'ds_authorization');
    const errorMessage = getMetadataString(incident.metadata, 'error');
    return (
      <>
        <p className="font-semibold text-gray-900">
          El pago se cobró y el stock ya se descontó, pero el registro en <code>payments</code> no se pudo guardar.
          Revisa manualmente contra la liquidación de Redsys antes de dar este pedido por conciliado.
        </p>
        <p className="mt-1 text-sm text-gray-700">
          Ds_Order: <strong>{dsOrder ?? '—'}</strong> · Autorización Redsys: <strong>{dsAuthorization ?? '—'}</strong>
          {errorMessage && (
            <>
              {' · Error: '}
              <strong>{errorMessage}</strong>
            </>
          )}
        </p>
      </>
    );
  }

  if (incident.eventType === 'PROMOCION_NO_APLICADA') {
    const giftVariantId = getMetadataString(incident.metadata, 'gift_variant_id');
    const giftName = (giftVariantId && giftNames.get(giftVariantId)) || 'el regalo de la promoción';
    return (
      <>
        <p className="font-semibold text-gray-900">
          Tarea pendiente: hay que hacerle llegar el regalo a este cliente sí o sí, no es una gestión opcional.
        </p>
        <p className="mt-1 text-sm text-gray-700">
          El pedido se cobró correctamente y el email de confirmación ya le prometió con normalidad{' '}
          <strong>{giftName}</strong>, pero no había stock al confirmar el pago. Contacta al cliente o repón una
          unidad para enviársela.
        </p>
      </>
    );
  }

  if (incident.eventType === 'REGALO_ENTREGADO_SIN_CANJE_CONTADO') {
    const giftVariantId = getMetadataString(incident.metadata, 'gift_variant_id');
    const giftName = (giftVariantId && giftNames.get(giftVariantId)) || 'un regalo de la promoción';
    return (
      <>
        <p className="font-semibold text-gray-900">
          Se entregó <strong>{giftName}</strong>, pero no contó dentro del cupo oficial de la promoción.
        </p>
        <p className="mt-1 text-sm text-gray-700">
          No requiere ninguna acción — es solo para llevar la cuenta real de regalos entregados bajo tráfico
          concurrente.
        </p>
      </>
    );
  }

  return null;
}

export default function IncidentBanner({
  incidents,
  giftNames,
}: {
  incidents: IncidentEvent[];
  giftNames: Map<string, string>;
}) {
  if (incidents.length === 0) return null;

  return (
    <section className="space-y-3">
      <h3 className="text-sm font-bold uppercase tracking-wide text-gray-500">Incidencias</h3>
      {incidents.map((incident) => {
        const style = SEVERITY_STYLES[incident.severity];
        return (
          <div key={incident.id} className={`rounded-lg p-4 ${style.container}`}>
            <span className={`inline-block rounded px-2 py-0.5 text-xs font-extrabold ${style.labelClasses}`}>
              {style.label}
            </span>
            <div className="mt-2">
              <IncidentContent incident={incident} giftNames={giftNames} />
            </div>
            <p className="mt-2 text-xs text-gray-500">{formatDateTime(incident.createdAt)}</p>
          </div>
        );
      })}
    </section>
  );
}
