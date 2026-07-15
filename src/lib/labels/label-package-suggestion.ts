// Número de envases sugerido para una línea de pedido (docs/FOOD_LABEL_ADMIN_DESIGN.md, §8).
// Valor de partida editable por el trabajador antes de generar las
// etiquetas — nunca se genera nada sin que lo confirme.
export function suggestPackageCount(quantity: number, suggestedPackageCountPerUnit: number): number {
  const perUnit = Number.isFinite(suggestedPackageCountPerUnit) && suggestedPackageCountPerUnit > 0
    ? Math.floor(suggestedPackageCountPerUnit)
    : 1;
  const qty = Number.isFinite(quantity) && quantity > 0 ? Math.floor(quantity) : 1;
  return Math.max(1, qty * perUnit);
}
