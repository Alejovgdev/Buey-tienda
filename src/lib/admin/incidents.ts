import type { Json } from '@/supabase/types';

// Fase 7, Unidad 4. Clasifica los eventos de order_status_history que
// docs/pendientes-panel-admin.md exige mostrar de forma imposible de pasar
// por alto — no todo evento "raro" entra aquí, solo estos tres, cada uno con
// su propia urgencia:
//   - critical: requiere revisión manual antes de dar el pedido por bueno.
//   - action_required: el pedido ya está PAID y es correcto, pero el
//     restaurante tiene una tarea pendiente obligatoria (entregar un regalo
//     prometido por email que no había en stock al confirmar el pago).
//   - info: no requiere ninguna acción, solo lleva la cuenta real de canjes.
export type IncidentSeverity = 'critical' | 'action_required' | 'info';

export const INCIDENT_EVENT_TYPES = [
  'IMPORTE_INCOHERENTE',
  'PAYMENTS_INSERT_ERROR',
  'PROMOCION_NO_APLICADA',
  'REGALO_ENTREGADO_SIN_CANJE_CONTADO',
] as const;

export type OrderIncident = {
  id: string;
  eventType: string;
  severity: IncidentSeverity;
  createdAt: string;
  metadata: Json | null;
};

export function getMetadataField(metadata: Json | null, field: string): Json | undefined {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return undefined;
  return metadata[field];
}

export function getMetadataString(metadata: Json | null, field: string): string | null {
  const value = getMetadataField(metadata, field);
  return typeof value === 'string' ? value : null;
}

// PROMOCION_NO_APLICADA también se registra con reason "AGOTADA", que es
// operativa normal (la promoción tenía cupo limitado y se agotó antes de
// este pedido) y no debe destacarse como incidencia — solo el caso en que el
// regalo se prometió por email y no había stock al confirmar el pago.
export function classifyIncidentEvent(eventType: string, metadata: Json | null): IncidentSeverity | null {
  if (eventType === 'IMPORTE_INCOHERENTE') return 'critical';

  if (eventType === 'PAYMENTS_INSERT_ERROR') return 'critical';

  if (eventType === 'PROMOCION_NO_APLICADA') {
    return getMetadataField(metadata, 'reason') === 'SIN_STOCK_REGALO_EN_CONFIRMACION' ? 'action_required' : null;
  }

  if (eventType === 'REGALO_ENTREGADO_SIN_CANJE_CONTADO') return 'info';

  return null;
}

const SEVERITY_RANK: Record<IncidentSeverity, number> = {
  critical: 3,
  action_required: 2,
  info: 1,
};

export function highestSeverity(severities: IncidentSeverity[]): IncidentSeverity | null {
  return severities.reduce<IncidentSeverity | null>((highest, current) => {
    if (!highest || SEVERITY_RANK[current] > SEVERITY_RANK[highest]) return current;
    return highest;
  }, null);
}
