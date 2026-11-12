import { createPageMetadata } from '@/lib/seo';
import RestaurantJsonLd from '@/components/Seo/RestaurantJsonLd';

export const metadata = createPageMetadata({
  path: '/contacto',
  title: 'Contacto y ubicación en Xàtiva | El Buey Madurado',
  description: 'Encuentra El Buey Madurado en Calle Reina, 41, Xàtiva. Consulta nuestra ubicación y contacta por teléfono, WhatsApp o correo electrónico.',
});

export default function ContactoLayout({ children }: { children: React.ReactNode }) {
  return <><RestaurantJsonLd />{children}</>;
}
