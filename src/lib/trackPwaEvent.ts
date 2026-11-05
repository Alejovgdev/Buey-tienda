/**
 * Apaño para el plan Hobby de Vercel, que no admite eventos personalizados:
 * cada acción de la ventana de instalar la app se registra como una visita a
 * una ruta virtual /_evento/pwa-<evento>-<platform>, que se ve en el panel de
 * Vercel Analytics filtrando por /_evento.
 *
 * Si pasamos a Pro, cambiar el pageview() por track('pwa_<evento>', { platform })
 * de '@vercel/analytics'.
 */
import { pageview } from '@vercel/analytics';

export type PwaEvent = 'shown' | 'yes' | 'no' | 'cancelled' | 'opened-as-app';

export function trackPwaEvent(
  evento: PwaEvent,
  platform: 'ios' | 'android',
  analyticsAccepted: boolean
): void {
  if (!analyticsAccepted) return;
  try {
    const path = `/_evento/pwa-${evento}-${platform}`;
    // Si <Analytics /> aún no se ha montado, pageview() no hace nada
    pageview({ route: path, path });
  } catch {}
}
