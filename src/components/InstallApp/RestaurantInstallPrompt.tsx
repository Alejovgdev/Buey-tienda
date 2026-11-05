'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';

const InstallAppPrompt = dynamic(() => import('./InstallAppPrompt'));
const RESTAURANT_ROUTES = new Set([
  '/', '/carta', '/reservas', '/sobre-nosotros', '/contacto', '/sorteo',
]);

export default function RestaurantInstallPrompt() {
  const pathname = usePathname();

  // Desmontar también cancela los temporizadores y cierra el aviso si se
  // navega desde el restaurante a compra, administración u otra ruta.
  if (!RESTAURANT_ROUTES.has(pathname)) return null;

  return <InstallAppPrompt />;
}
