// Las columnas DATE de Supabase llegan como "YYYY-MM-DD". Se reformatean con
// manipulación de texto, no con Date/Intl, para no arriesgar un desplazamiento
// de un día por zona horaria en una fecha que no lleva hora.
export function formatLabelDate(value: string | null | undefined): string {
  if (!value) return '—';
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return value;
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

export function todayIsoDate(): string {
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
}
