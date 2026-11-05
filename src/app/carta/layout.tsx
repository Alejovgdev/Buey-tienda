import type { Metadata } from 'next';

// La página de la carta es un componente cliente y no puede exportar metadata,
// así que el título y la descripción se definen aquí.
export const metadata: Metadata = {
  title: 'Carta | El Buey Madurado',
  description:
    'Consulta la carta de El Buey Madurado en Xàtiva: entrantes, chuletones de larga maduración, burgers de autor, kebabs, postres y bodega.',
};

export default function CartaLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
