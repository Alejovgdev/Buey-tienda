'use client';

import { useEffect } from 'react';

export default function CommerceHistoryRefresh() {
  useEffect(() => {
    // Next conserva páginas al usar atrás/adelante, incluso siendo dinámicas.
    // En esos casos se hace una nueva carga únicamente del catálogo/checkout.
    // No se refrescan pestañas abiertas ni rutas del restaurante.
    const refresh = () => {
      const path = window.location.pathname;
      if (path === '/checkout' || path === '/tienda' || path.startsWith('/tienda/')) window.location.reload();
    };
    const restore = (event: PageTransitionEvent) => { if (event.persisted) refresh(); };
    window.addEventListener('popstate', refresh);
    window.addEventListener('pageshow', restore);
    return () => {
      window.removeEventListener('popstate', refresh);
      window.removeEventListener('pageshow', restore);
    };
  }, []);
  return null;
}
