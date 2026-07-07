// src/app/sobre-nosotros/page.tsx

import HeroSectionSobreNosotros from '@/components/SobreNosotros/HeroSectionSobreNosotros';
import MuseoCarne from '@/components/SobreNosotros/MuseoCarne';
import HistoriaYValores from '@/components/SobreNosotros/HistoriaYValores';
import Equipo from '@/components/SobreNosotros/Esquipo';
import GoogleReviews from '@/components/SobreNosotros/GoogleReviews';

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

