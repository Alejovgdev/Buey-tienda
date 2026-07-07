import type { Metadata } from 'next';

// Fase 7. El admin es una herramienta interna: tema claro y denso, distinto
// del tema oscuro de marketing del resto del sitio (ver src/app/globals.css),
// priorizando legibilidad de tablas y datos sobre estética.
export const metadata: Metadata = {
  title: 'Panel admin | El Buey Madurado',
  robots: { index: false, follow: false },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-gray-100 text-gray-900">{children}</div>;
}
