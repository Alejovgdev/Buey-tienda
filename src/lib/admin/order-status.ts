// Fase 7. Estados y transiciones según docs/tienda-online-mvp.md, secciones 8 y 17.
export const ORDER_STATUSES = [
  'PENDING_PAYMENT',
  'PAID',
  'PREPARING',
  'SHIPPED',
  'CANCELLED',
  'PAYMENT_FAILED',
  'STOCK_ERROR',
  'NEEDS_REVIEW',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export function isValidOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'Pendiente de pago',
  PAID: 'Pagado',
  PREPARING: 'Preparando',
  SHIPPED: 'Enviado',
  CANCELLED: 'Cancelado',
  PAYMENT_FAILED: 'Pago fallido',
  STOCK_ERROR: 'Error de stock',
  NEEDS_REVIEW: 'Revisión manual',
};

// Colores según la sección 17 del documento.
export const ORDER_STATUS_BADGE_CLASSES: Record<OrderStatus, string> = {
  PENDING_PAYMENT: 'bg-gray-200 text-gray-700',
  PAID: 'bg-green-100 text-green-800',
  PREPARING: 'bg-blue-100 text-blue-800',
  SHIPPED: 'bg-teal-100 text-teal-800',
  CANCELLED: 'bg-red-100 text-red-800',
  PAYMENT_FAILED: 'bg-red-200 text-red-900',
  STOCK_ERROR: 'bg-orange-100 text-orange-800',
  NEEDS_REVIEW: 'bg-orange-200 text-orange-900',
};

// Transiciones permitidas desde el panel admin (sección 8 del documento).
// SHIPPED y CANCELLED son finales. PENDING_PAYMENT y PAYMENT_FAILED solo se
// pueden cancelar a mano pasadas UNPAID_GRACE_HOURS desde la creación (antes
// los resuelve la notificación de Redsys): ver canTransitionNow.
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: ['CANCELLED'],
  PAID: ['PREPARING', 'CANCELLED'],
  PREPARING: ['SHIPPED', 'CANCELLED'],
  SHIPPED: [],
  CANCELLED: [],
  PAYMENT_FAILED: ['CANCELLED'],
  STOCK_ERROR: ['NEEDS_REVIEW', 'CANCELLED'],
  NEEDS_REVIEW: ['PREPARING', 'CANCELLED'],
};

// Paso 6. Estados en los que se puede emitir la factura simplificada desde el
// panel. La función SQL lo vuelve a comprobar (migración 0027).
const INVOICEABLE_STATUSES: readonly string[] = ['PAID', 'PREPARING', 'SHIPPED'];

export function isInvoiceableStatus(status: string): boolean {
  return INVOICEABLE_STATUSES.includes(status);
}

export function isValidTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[from].includes(to);
}

// Pedidos no terminados (sin pago confirmado). Pasadas 24 h desde su creación
// el panel permite cancelarlos y enviar un recordatorio al cliente.
export const UNPAID_STATUSES: readonly OrderStatus[] = ['PENDING_PAYMENT', 'PAYMENT_FAILED'];
export const UNPAID_GRACE_HOURS = 24;

export function isUnpaidStatus(status: string): boolean {
  return (UNPAID_STATUSES as readonly string[]).includes(status);
}

/** true si el pedido sin pagar tiene ya más de UNPAID_GRACE_HOURS. */
export function isUnpaidOrderStale(status: string, createdAt: string, now: Date = new Date()): boolean {
  const created = Date.parse(createdAt);
  if (!isUnpaidStatus(status) || Number.isNaN(created)) return false;
  return now.getTime() - created >= UNPAID_GRACE_HOURS * 60 * 60 * 1000;
}

/** Transiciones posibles ahora mismo (aplica la espera de 24 h a los no pagados). */
export function availableTransitions(status: string, createdAt: string, now: Date = new Date()): OrderStatus[] {
  if (!isValidOrderStatus(status)) return [];
  if (isUnpaidStatus(status) && !isUnpaidOrderStale(status, createdAt, now)) return [];
  return ORDER_STATUS_TRANSITIONS[status];
}
