// Solo las rutas de catálogo: HTML y consultas actuales en cada petición.
// React.cache en tienda.ts deduplica dentro de esa petición, no entre visitas.
export const dynamic = 'force-dynamic';

export default function TiendaLayout({ children }: { children: React.ReactNode }) {
  return children;
}
