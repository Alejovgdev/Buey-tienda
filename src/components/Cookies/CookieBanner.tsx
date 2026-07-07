'use client';

import Link from 'next/link';
import { useConsent } from '@/contexts/ConsentContext';

export default function CookieBanner() {
  const { isLoaded, decided, acceptAll, rejectAll, openPanel } = useConsent();

  if (!isLoaded || decided) return null;

  return (
    <div
      role="dialog"
      aria-label="Aviso de cookies"
      aria-modal="false"
      className="fixed inset-x-0 bottom-0 z-[9998] bg-[#0d0d0d] border-t border-amber-900/40 shadow-[0_-4px_40px_rgba(0,0,0,0.7)]"
    >
      <div className="max-w-6xl mx-auto px-5 py-5 md:px-8 md:py-5 flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
        {/* Texto informativo */}
        <p className="flex-1 text-sm text-gray-300 leading-6">
          Usamos cookies propias y de terceros para garantizar el funcionamiento del sitio,
          mostrar el mapa de localización y analizar el tráfico de manera anónima.
          Puede aceptarlas, rechazarlas o configurarlas individualmente.{' '}
          <Link
            href="/politica-de-cookies"
            className="text-amber-500 hover:text-amber-400 underline underline-offset-2 transition-colors"
          >
            Política de cookies
          </Link>
        </p>

        {/* Botones — igual prominencia visual conforme AEPD */}
        <div className="flex flex-col sm:flex-row gap-2.5 shrink-0">
          <button
            onClick={rejectAll}
            className="
              px-5 py-2.5 rounded-full text-sm font-semibold
              border border-gray-600 text-gray-300
              hover:border-gray-400 hover:text-white
              transition-colors duration-200
              focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0d0d]
            "
          >
            Rechazar todo
          </button>
          <button
            onClick={openPanel}
            className="
              px-5 py-2.5 rounded-full text-sm font-semibold
              border border-amber-700/70 text-amber-400
              hover:border-amber-500 hover:text-amber-300
              transition-colors duration-200
              focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0d0d]
            "
          >
            Configurar
          </button>
          <button
            onClick={acceptAll}
            className="
              px-5 py-2.5 rounded-full text-sm font-semibold
              bg-amber-500 text-[#1a1410]
              hover:bg-amber-400
              transition-colors duration-200
              focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0d0d]
            "
          >
            Aceptar todo
          </button>
        </div>
      </div>
    </div>
  );
}
