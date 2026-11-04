const FREE_SHIPPING_THRESHOLD = 15000;
const SHIPPING_COST = 1000;

/** Céntimos. Regla de negocio de la sección 25: gratis a partir de 150,00 € (umbral inclusivo). */
export function calculateShippingCost(subtotal: number): number {
  return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
}

// ---------------------------------------------------------------------------
// Paso 6. Copy de envíos: una sola fuente para las tres vistas que lo muestran
// (ShippingNotice en la tienda, el formulario de checkout y el email de
// confirmación). Antes estaba escrito a mano en cada sitio y los tres decían
// cosas distintas, ninguna igual al contrato.
//
// La fuente de verdad es docs/legal/condiciones-generales-contratacion.md §3.2:
//   - Envíos exclusivamente a España Peninsular (excluidas Baleares, Canarias,
//     Ceuta y Melilla).
//   - Repartos de martes a viernes; excluidos lunes, sábados, domingos y festivos.
//   - Plazo estimado de 24 a 48 horas laborables DESDE LA SALIDA del pedido de
//     nuestras instalaciones — no desde que se hace el pedido ni desde el pago.
//
// Los textos se componen de los fragmentos de abajo para que no puedan volver a
// divergir entre sí. Si cambia el contrato, se cambia aquí y punto.
//
// Cuidado al editar: el contrato NO dice qué pasa con los pedidos hechos en fin
// de semana, así que aquí tampoco se afirma nada al respecto.
// ---------------------------------------------------------------------------

/** Ámbito territorial (§3.2, "Ámbito Territorial de Envío"). */
const SHIPPING_AREA = 'España peninsular';

/** Días de reparto (§3.2, "Plazos de entrega"). */
const DELIVERY_DAYS = 'de martes a viernes';

/** Plazo y, sobre todo, desde cuándo cuenta (§3.2, "Plazos de entrega"). */
const DELIVERY_WINDOW =
  '24 a 48 horas laborables desde que el pedido sale de nuestras instalaciones';

/**
 * Las tres tarjetas de ShippingNotice. El orden es el de la interfaz:
 * dónde llegamos, cuánto tarda y qué días se reparte.
 */
export const SHIPPING_INFO = {
  area: {
    title: 'Solo península',
    text: `Enviamos únicamente a ${SHIPPING_AREA}. No llegamos a Baleares, Canarias, Ceuta ni Melilla.`,
  },
  eta: {
    title: 'Entrega en 24-48 h',
    text: `Plazo estimado de ${DELIVERY_WINDOW}.`,
  },
  days: {
    title: 'Reparto de martes a viernes',
    text: `SEUR Frío reparte ${DELIVERY_DAYS} en transporte refrigerado. No hay reparto los lunes, fines de semana ni festivos.`,
  },
} as const;

/** Versión de un párrafo, para el formulario de checkout. */
export const SHIPPING_SUMMARY =
  `Enviamos únicamente a ${SHIPPING_AREA}. El reparto se realiza ${DELIVERY_DAYS}, ` +
  `con un plazo estimado de ${DELIVERY_WINDOW}.`;

/** Versión de una frase, para el email de confirmación del pedido. */
export const SHIPPING_ETA_SENTENCE =
  `Tiempo estimado de entrega: ${DELIVERY_WINDOW}. Repartimos ${DELIVERY_DAYS}.`;
