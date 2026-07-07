import type { Metadata } from 'next';
import NewsletterExperience from '@/components/Sorteo/SorteoExperience';

export const metadata: Metadata = {
  title: 'Newsletter de descuentos | El Buey Madurado',
  description:
    'Suscríbete a la newsletter de El Buey Madurado y recibe descuentos, promociones y novedades especiales en tu email.',
};

export default function NewsletterPage() {
  return <NewsletterExperience />;
}
