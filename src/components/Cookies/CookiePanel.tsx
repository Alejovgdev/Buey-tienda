'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useConsent, type ConsentCategories } from '@/contexts/ConsentContext';

interface CategoryRowProps {
  title: string;
  description: string;
  locked?: boolean;
  checked: boolean;
  onChange?: (value: boolean) => void;
}

function CategoryRow({ title, description, locked, checked, onChange }: CategoryRowProps) {
  return (
    <div className="flex items-start justify-between gap-4 py-5 border-b border-white/[0.07] last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          {locked && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/25 font-medium tracking-wide">
              Siempre activas
            </span>
          )}
        </div>
        <p className="text-xs text-gray-400 leading-5">{description}</p>
      </div>

      <div className="shrink-0 mt-0.5">
        {locked ? (
          <div
            aria-hidden="true"
            className="relative inline-flex h-6 w-11 items-center rounded-full bg-amber-500/40 cursor-not-allowed"
          >
            <span className="inline-block h-4 w-4 rounded-full bg-amber-400 shadow translate-x-6" />
          </div>
        ) : (
          <button
            role="switch"
            aria-checked={checked}
            aria-label={`${checked ? 'Desactivar' : 'Activar'} cookies de ${title.toLowerCase()}`}
            onClick={() => onChange?.(!checked)}
            className={`
              relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200
              focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0f0f0f]
              ${checked ? 'bg-amber-500' : 'bg-gray-700'}
            `}
          >
            <span
              className={`
                inline-block h-4 w-4 rounded-full bg-white shadow transition-transform duration-200
                ${checked ? 'translate-x-6' : 'translate-x-1'}
              `}
            />
          </button>
        )}
      </div>
    </div>
  );
}

export default function CookiePanel() {
  const { isPanelOpen, closePanel, consent, acceptAll, rejectAll, saveCategories } =
    useConsent();
  const [local, setLocal] = useState<ConsentCategories>(consent);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // Sync local state when panel opens or external consent changes
  useEffect(() => {
    if (isPanelOpen) {
      setLocal(consent);
      setTimeout(() => closeButtonRef.current?.focus(), 50);
    }
  }, [isPanelOpen, consent]);

  // Escape to close
  useEffect(() => {
    if (!isPanelOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closePanel();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [isPanelOpen, closePanel]);

  // Lock body scroll
  useEffect(() => {
    if (isPanelOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isPanelOpen]);

  if (!isPanelOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-[9999] bg-black/70 backdrop-blur-sm"
        onClick={closePanel}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Configuración de cookies"
        className="
          fixed z-[10000]
          inset-x-4 bottom-4 top-4
          md:inset-auto md:left-1/2 md:top-1/2
          md:-translate-x-1/2 md:-translate-y-1/2
          md:w-full md:max-w-lg md:max-h-[90vh]
          flex flex-col
          bg-[#0f0f0f] border border-gray-800 rounded-2xl shadow-2xl overflow-hidden
        "
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800 shrink-0">
          <h2 className="text-sm font-bold text-amber-500 uppercase tracking-widest">
            Configuración de cookies
          </h2>
          <button
            ref={closeButtonRef}
            onClick={closePanel}
            aria-label="Cerrar panel de configuración de cookies"
            className="
              text-gray-400 hover:text-white transition-colors
              p-1.5 rounded-lg
              focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500
            "
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="flex-1 overflow-y-auto px-6">
          <p className="text-sm text-gray-400 leading-6 pt-4 pb-2">
            Elige qué tipos de cookies quieres permitir. Las necesarias son siempre activas
            porque son imprescindibles para el funcionamiento del sitio.{' '}
            <Link
              href="/politica-de-cookies"
              className="text-amber-500 hover:text-amber-400 underline underline-offset-2 transition-colors"
              onClick={closePanel}
            >
              Más información
            </Link>
          </p>

          <div className="divide-y divide-white/[0.07]">
            <CategoryRow
              title="Necesarias"
              description="Imprescindibles para el funcionamiento básico del sitio web. Incluyen la cookie que guarda tu elección de privacidad para que no volvamos a preguntarte en cada visita."
              locked
              checked
            />
            <CategoryRow
              title="Funcionales"
              description="Permiten cargar el mapa interactivo de Google Maps en la sección de contacto para mostrarte cómo llegar al restaurante. Sin estas cookies, el mapa no se muestra (puedes usar el enlace a Google Maps igualmente)."
              checked={local.funcional}
              onChange={(v) => setLocal((c) => ({ ...c, funcional: v }))}
            />
            <CategoryRow
              title="Análisis"
              description="Nos ayudan a entender cómo se navega por el sitio web, qué páginas se visitan más y desde qué dispositivos, mediante Vercel Analytics. Esta información es anónima y se usa únicamente para mejorar el sitio."
              checked={local.analisis}
              onChange={(v) => setLocal((c) => ({ ...c, analisis: v }))}
            />
          </div>
        </div>

        {/* Footer con botones */}
        <div className="shrink-0 px-6 py-4 border-t border-gray-800 flex flex-col sm:flex-row gap-2">
          <button
            onClick={rejectAll}
            className="
              flex-1 px-4 py-2.5 rounded-full text-sm font-semibold
              border border-gray-600 text-gray-300
              hover:border-gray-400 hover:text-white
              transition-colors duration-200
              focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500
            "
          >
            Rechazar todo
          </button>
          <button
            onClick={() => saveCategories(local)}
            className="
              flex-1 px-4 py-2.5 rounded-full text-sm font-semibold
              border border-amber-700/70 text-amber-400
              hover:border-amber-500 hover:text-amber-300
              transition-colors duration-200
              focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500
            "
          >
            Guardar selección
          </button>
          <button
            onClick={acceptAll}
            className="
              flex-1 px-4 py-2.5 rounded-full text-sm font-semibold
              bg-amber-500 text-[#1a1410]
              hover:bg-amber-400
              transition-colors duration-200
              focus:outline-none focus-visible:ring-2 focus-visible:ring-amber-500
            "
          >
            Aceptar todo
          </button>
        </div>
      </div>
    </>
  );
}
