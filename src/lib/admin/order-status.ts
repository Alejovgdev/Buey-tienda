// Fase 7. Estados y transiciones según docs/tienda-online-mvp.md, secciones 8 y 17.
export const ORDER_STATUSES = [
  'PENDING_PAYMENT',
  'PAID',
  'PREPARING',
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
  CANCELLED: 'bg-red-100 text-red-800',
  PAYMENT_FAILED: 'bg-red-200 text-red-900',
  STOCK_ERROR: 'bg-orange-100 text-orange-800',
  NEEDS_REVIEW: 'bg-orange-200 text-orange-900',
};

// Transiciones permitidas desde el panel admin (sección 8 del documento).
// PENDING_PAYMENT y PAYMENT_FAILED no tienen transición manual: los resuelve
// siempre la notificación de Redsys, nunca el admin a mano.
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  PENDING_PAYMENT: [],
  PAID: ['PREPARING', 'CANCELLED'],
  PREPARING: ['CANCELLED'],
  CANCELLED: [],
  PAYMENT_FAILED: [],
  STOCK_ERROR: ['NEEDS_REVIEW', 'CANCELLED'],
  NEEDS_REVIEW: ['PREPARING', 'CANCELLED'],
};

// Paso 6. Estados en los que se puede emitir la factura simplificada desde el
// panel. La función SQL lo vuelve a comprobar (migración 0027).
const INVOICEABLE_STATUSES: readonly string[] = ['PAID', 'PREPARING'];

export function isInvoiceableStatus(status: string): boolean {
  return INVOICEABLE_STATUSES.includes(status);
}

export function isValidTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ORDER_STATUS_TRANSITIONS[from].includes(to);
}
