import { getEventLabel } from '@/lib/admin/event-labels';
import { formatDateTime } from '@/lib/admin/format-datetime';
import { ORDER_STATUS_LABELS, isValidOrderStatus } from '@/lib/admin/order-status';
import { getMetadataString } from '@/lib/admin/incidents';
import type { Json } from '@/supabase/types';

export type TimelineEvent = {
  id: string;
  event_type: string;
  previous_status: string | null;
  new_status: string | null;
  notes: string | null;
  created_at: string;
  metadata?: Json | null;
};

// Paso 6. Los eventos de factura del cobro no llevan notas: se muestra el
// número (o el código de error) guardado en metadata.
function invoiceDetail(event: TimelineEvent): string | null {
  if (!event.event_type.startsWith('FACTURA_')) return null;
  return getMetadataString(event.metadata ?? null, 'invoice_number') ?? getMetadataString(event.metadata ?? null, 'error');
}

function statusLabel(status: string | null): string {
  if (!status) return '';
  return isValidOrderStatus(status) ? ORDER_STATUS_LABELS[status] : status;
}

// Fase 7, Unidad 3. order_status_history es inmutable y se muestra completo
// y en orden cronológico (sección 18 del MVP) — el tratamiento destacado de
// los eventos de incidencia (Unidad 4) se añade aparte, no sustituye a esto.
export default function OrderTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-gray-500">Sin eventos registrados.</p>;
  }

  return (
    <ol className="space-y-2">
      {events.map((event) => (
        <li key={event.id} className="flex flex-col gap-0.5 text-sm sm:flex-row sm:gap-3">
          <span className="flex-shrink-0 text-gray-400 sm:w-32">{formatDateTime(event.created_at)}</span>
          <div>
            <p className="text-gray-800">
              {getEventLabel(event.event_type)}
              {event.event_type === 'ESTADO_CAMBIADO' && event.previous_status && event.new_status && (
                <span className="text-gray-500">
                  {' — '}
                  {statusLabel(event.previous_status)} → {statusLabel(event.new_status)}
                </span>
              )}
            </p>
            {event.notes ? (
              <p className="whitespace-pre-wrap text-gray-600">{event.notes}</p>
            ) : (
              invoiceDetail(event) && <p className="text-gray-600">{invoiceDetail(event)}</p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
