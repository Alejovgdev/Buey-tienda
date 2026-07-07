'use client';

import { useConsent } from '@/contexts/ConsentContext';

export default function CookiePanelTrigger() {
  const { openPanel } = useConsent();

  return (
    <button
      onClick={openPanel}
      className="
        mt-1 mb-4 inline-flex items-center gap-2
        px-5 py-2.5 rounded-full text-sm font-semibold
        border border-amber-700/70 text-amber-400
        hover:border-amber-500 hover:text-amber-300
        transition-colors duration-200
        focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500
      "
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        className="w-4 h-4"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M10.5 6h9.75M10.5 6a1.5 1.5 0 11-3 0m3 0a1.5 1.5 0 10-3 0M3.75 6H7.5m3 12h9.75m-9.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-3.75 0H7.5m9-6h3.75m-3.75 0a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m-9.75 0h9.75"
        />
      </svg>
      Abrir configuración de cookies
    </button>
  );
}
