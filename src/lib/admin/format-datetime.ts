// Misma zona horaria y estilo que el email interno al restaurante
// (src/emails/InternalOrderNotificationEmail.tsx), para que las horas del
// panel admin coincidan con las que ya ve el restaurante en el email.
export function formatDateTime(isoString: string): string {
  return new Date(isoString).toLocaleString('es-ES', {
    timeZone: 'Europe/Madrid',
    dateStyle: 'short',
    timeStyle: 'short',
  });
}
