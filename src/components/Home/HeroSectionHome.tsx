// components/Home/HeroSectionHome.tsx
'use client';


import Link from 'next/link';
import Button from '../ui/Button';


export default function HeroSectionHome() {
  return (
    <section className="relative w-full flex items-center justify-start overflow-hidden" style={{ height: 'calc(100vh - 80px)' }}>
      {/* Video de fondo */}
      <div className="absolute top-0 left-0 w-full h-full z-0">
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          className="absolute inset-0 w-full h-full object-cover"
        >
          <source src="/hero.mp4" type="video/mp4" />
        </video>
        {/* Overlay oscuro */}
        <div className="absolute inset-0 bg-black/50" />
      </div>


      {/* Contenido - Textos y botones */}
      <div className="relative z-10 w-full flex flex-col justify-between md:justify-start items-start space-y-0 md:space-y-6 max-w-xl px-4 md:px-0 md:pl-20 h-full py-6 md:py-8">
        {/* Textos arriba */}
        <div className="space-y-3 md:space-y-6 pt-6 md:pt-12">
          <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-extrabold text-white leading-tight">
            No hablamos de <br />
            comida rápida
            <br />
            <span className="text-amber-500">…hablamos de <br />
            alta cocina</span>
          </h1>


          <p className="text-sm sm:text-base md:text-lg text-gray-200 max-w-md md:hidden">
            Carne madurada, ingredientes locales y un sabor que trasciende.
          </p>
        </div>


        {/* Párrafo en el medio (solo desktop) */}
        <p className="hidden md:block text-sm sm:text-base md:text-lg text-gray-200 max-w-md">
          Carne madurada, ingredientes locales y un sabor que trasciende.
        </p>


        {/* Botones abajo */}
        <div className="flex gap-3 md:gap-4 pb-6 md:pb-8 -translate-y-4">
          <Link href="/carta">
            <Button
              variant="secondary"
              className="px-6 md:px-8 py-2 md:py-3 text-sm md:text-base font-semibold rounded-full"
            >
              Nuestra Carta
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}