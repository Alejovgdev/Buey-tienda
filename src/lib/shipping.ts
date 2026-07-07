const FREE_SHIPPING_THRESHOLD = 15000;
const SHIPPING_COST = 1000;

/** Céntimos. Regla de negocio de la sección 25: gratis a partir de 150,00 € (umbral inclusivo). */
export function calculateShippingCost(subtotal: number): number {
  return subtotal >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_COST;
}
