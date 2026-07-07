'use client';

import { useConsent } from '@/contexts/ConsentContext';

const MAPS_EMBED_SRC =
  'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d193.823107430763!2d-0.5263494328058195!3d38.988622750395706!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0xd61a3a2f5215229%3A0x7ecfefdab1c14599!2sRestaurante%20el%20buey%20madurado!5e0!3m2!1ses!2ses!4v1767974032149!5m2!1ses!2ses';

const MAPS_LINK = 'https://maps.app.goo.gl/PFgL2Ww84fGHULMp6';

export default function ConditionalMap() {
  const { consent, isLoaded, openPanel } = useConsent();

  if (!isLoaded) {
    return (
      <div
        className="w-full h-full bg-[#0f0f0f] animate-pulse rounded-xl"
        aria-hidden="true"
      />
    );
  }

  if (!consent.funcional) {
    return (
      <div className="w-full h-full bg-[#0f0f0f] flex flex-col items-center justify-center gap-4 p-6 text-center">
        <svg
          className="w-10 h-10 text-gray-600"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z"
          />
        </svg>
        <div>
          <p className="text-sm font-semibold text-gray-300">Mapa no cargado</p>
          <p className="text-xs text-gray-500 mt-1 max-w-[200px] leading-4">
            Activa las cookies funcionales para ver el mapa interactivo.
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <button
            onClick={openPanel}
            className="
              px-4 py-2 text-xs font-semibold rounded-full
              bg-amber-500 text-[#1a1410] hover:bg-amber-400
              transition-colors duration-200
              focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500
            "
          >
            Gestionar cookies
          </button>
          <a
            href={MAPS_LINK}
            target="_blank"
            rel="noreferrer"
            className="
              px-4 py-2 text-xs font-semibold rounded-full
              border border-gray-600 text-gray-300
              hover:border-gray-400 hover:text-white
              transition-colors duration-200
            "
          >
            Ver en Maps →
          </a>
        </div>
      </div>
    );
  }

  return (
    <iframe
      src={MAPS_EMBED_SRC}
      className="w-full h-full"
      style={{ border: 0 }}
      allowFullScreen
      loading="lazy"
      referrerPolicy="no-referrer-when-downgrade"
      title="Mapa Restaurante El Buey Madurado"
    />
  );
}
