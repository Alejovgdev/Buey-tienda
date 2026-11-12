import Reservas from '@/components/Reservas/reservas';
import { createPageMetadata } from '@/lib/seo';

export const metadata = createPageMetadata({
  path: '/reservas',
  title: 'Reservar mesa en Xàtiva | El Buey Madurado',
  description: 'Reserva tu mesa en El Buey Madurado, restaurante de carne madurada en Xàtiva, mediante nuestro formulario de reservas.',
});

export default function ReservasPage() {
  return (
    <>
      <Reservas />
    </>
  );
}
