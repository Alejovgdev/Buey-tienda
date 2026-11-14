// Fase 7, Unidad 3. Traduce los event_type técnicos de order_status_history
// a texto humano para el timeline del detalle de pedido (sección 18 del MVP).
const EVENT_TYPE_LABELS: Record<string, string> = {
  PEDIDO_CREADO: 'Pedido creado',
  REDSYS_PAYLOAD_GENERADO: 'Payload de Redsys generado',
  PAGO_CONFIRMADO: 'Pago confirmado',
  PAGO_FALLIDO: 'Pago fallido',
  STOCK_DESCONTADO: 'Stock descontado',
  STOCK_ERROR: 'Error de stock al confirmar el pago',
  PROMOCION_APLICADA: 'Promoción aplicada',
  REGALO_AÑADIDO: 'Regalo añadido al pedido',
  PROMOCION_NO_APLICADA: 'Promoción no aplicada',
  REGALO_ENTREGADO_SIN_CANJE_CONTADO: 'Regalo entregado sin contar como canje oficial',
  IMPORTE_INCOHERENTE: 'Importe incoherente detectado',
  PAYMENTS_INSERT_ERROR: 'Error al registrar el pago (payments)',
  EMAIL_CLIENTE_ENVIADO: 'Email de confirmación enviado al cliente',
  EMAIL_CLIENTE_ERROR: 'Error al enviar el email al cliente',
  EMAIL_INTERNO_ENVIADO: 'Email interno enviado al restaurante',
  EMAIL_INTERNO_ERROR: 'Error al enviar el email interno',
  ESTADO_CAMBIADO: 'Estado cambiado',
  NOTA_INTERNA_AÑADIDA: 'Nota interna añadida',
  PEDIDO_ETIQUETADO: 'Pedido marcado como preparado/etiquetado',
  FACTURA_EMITIDA: 'Factura emitida',
  FACTURA_ERROR: 'Error al emitir la factura',
  FACTURA_PDF_ERROR: 'Error al generar el PDF de la factura',
  FACTURA_REENVIADA: 'Factura reenviada al cliente',
};

export function getEventLabel(eventType: string): string {
  return EVENT_TYPE_LABELS[eventType] ?? eventType;
}
