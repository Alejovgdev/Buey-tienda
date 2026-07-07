export function formatPriceFromCents(cents: number): string {
  return `${(cents / 100).toFixed(2).replace('.', ',')} €`;
}
