'use client';

export default function CatalogError({ reset }: { reset: () => void }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16" role="alert">
      <h1 className="text-3xl font-extrabold text-white">No se ha podido cargar el catálogo</h1>
      <p className="mt-4 text-white/70">Se ha producido un problema temporal. Inténtalo de nuevo más tarde.</p>
      <button type="button" onClick={reset} className="mt-6 rounded-full bg-amber-500 px-6 py-3 font-semibold text-[#1a1410]">
        Volver a intentar
      </button>
    </div>
  );
}
