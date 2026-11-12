// src/app/sobre-nosotros/page.tsx

import HeroSectionSobreNosotros from '@/components/SobreNosotros/HeroSectionSobreNosotros';
import MuseoCarne from '@/components/SobreNosotros/MuseoCarne';
import HistoriaYValores from '@/components/SobreNosotros/HistoriaYValores';
import Equipo from '@/components/SobreNosotros/Esquipo';
import GoogleReviews from '@/components/SobreNosotros/GoogleReviews';
import { createPageMetadata } from '@/lib/seo';

export const metadata = createPageMetadata({
  path: '/sobre-nosotros',
  title: 'Sobre nuestro restaurante en Xàtiva | El Buey Madurado',
  description: 'Conoce la historia, los propietarios y la filosofía de El Buey Madurado, nuestro restaurante especializado en carne madurada en Xàtiva.',
});

export default function SobreNosotrosPage() {
  return (
    <main className="bg-black overflow-x-hidden">
      <HeroSectionSobreNosotros />
      <HistoriaYValores />
      <MuseoCarne />
      <Equipo />
      <GoogleReviews/>
    </main>
  );
}

