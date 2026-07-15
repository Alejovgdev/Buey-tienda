'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';

interface PrintResult {
  id: string;
  ok: boolean;
  error?: string;
}

interface PrintLabelsClientProps {
  orderId: string;
  labelIds: string[];
  children: ReactNode;
}

type Phase = 'preparing' | 'awaiting_confirmation' | 'registering' | 'done' | 'skipped';

// window.print() SIEMPRE muestra el diálogo del navegador — no hay impresión
// silenciosa sin software adicional (docs/FOOD_LABEL_ADMIN_DESIGN.md, §12).
// Tras cerrarse ese diálogo (evento afterprint) se pregunta explícitamente si
// la impresión salió bien antes de registrar nada: cancelar el diálogo no
// debe poder marcar una etiqueta como impresa.
export default function PrintLabelsClient({ orderId, labelIds, children }: PrintLabelsClientProps) {
  const [phase, setPhase] = useState<Phase>('preparing');
  const [results, setResults] = useState<PrintResult[] | null>(null);
  const [registerError, setRegisterError] = useState<string | null>(null);

  useEffect(() => {
    function handleAfterPrint() {
      setPhase((current) => (current === 'preparing' ? 'awaiting_confirmation' : current));
    }
    window.addEventListener('afterprint', handleAfterPrint);
    const timer = setTimeout(() => window.print(), 300);
    return () => {
      window.removeEventListener('afterprint', handleAfterPrint);
      clearTimeout(timer);
    };
  }, []);

  async function handleConfirmPrinted() {
    setPhase('registering');
    setRegisterError(null);
    try {
      const response = await fetch('/api/admin/etiquetas/imprimir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: labelIds }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setRegisterError(data?.error ?? 'No se pudo registrar la impresión');
        setPhase('awaiting_confirmation');
        return;
      }
      setResults(data.results ?? []);
      setPhase('done');
    } catch {
      setRegisterError('No se pudo registrar la impresión');
      setPhase('awaiting_confirmation');
    }
  }

  return (
    <div>
      <div className="no-print sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 p-3">
        <Link href={`/admin/pedidos/${orderId}/etiquetar`} className="text-sm text-blue-700 hover:underline">
          ← Volver a Preparar y etiquetar
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
        >
          Imprimir
        </button>
      </div>

      {children}

      {phase === 'awaiting_confirmation' && (
        <div className="no-print fixed inset-x-0 bottom-0 z-20 border-t border-gray-300 bg-white p-4 shadow-lg">
          <p className="mb-2 text-sm font-medium text-gray-800">¿Se ha impreso correctamente?</p>
          {registerError && <p className="mb-2 text-sm text-red-600">{registerError}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleConfirmPrinted}
              className="rounded-md bg-green-700 px-4 py-2 text-sm font-semibold text-white hover:bg-green-800"
            >
              Sí, registrar impresión
            </button>
            <button
              type="button"
              onClick={() => setPhase('skipped')}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              No registrar
            </button>
          </div>
        </div>
      )}

      {phase === 'registering' && (
        <div className="no-print fixed inset-x-0 bottom-0 z-20 border-t border-gray-300 bg-white p-4 shadow-lg">
          <p className="text-sm text-gray-600">Registrando…</p>
        </div>
      )}

      {phase === 'done' && results && (
        <div className="no-print fixed inset-x-0 bottom-0 z-20 border-t border-gray-300 bg-white p-4 shadow-lg">
          <p className="mb-1 text-sm font-medium text-gray-800">
            {results.filter((result) => result.ok).length} de {results.length} etiqueta(s) registrada(s).
          </p>
          {results.some((result) => !result.ok) && (
            <ul className="mb-2 space-y-0.5 text-xs text-red-700">
              {results
                .filter((result) => !result.ok)
                .map((result) => (
                  <li key={result.id}>{result.error}</li>
                ))}
            </ul>
          )}
          <Link href={`/admin/pedidos/${orderId}/etiquetar`} className="text-sm text-blue-700 hover:underline">
            Volver a Preparar y etiquetar
          </Link>
        </div>
      )}

      {phase === 'skipped' && (
        <div className="no-print fixed inset-x-0 bottom-0 z-20 border-t border-gray-300 bg-white p-4 shadow-lg">
          <p className="mb-2 text-sm text-gray-600">No se ha registrado ninguna impresión.</p>
          <Link href={`/admin/pedidos/${orderId}/etiquetar`} className="text-sm text-blue-700 hover:underline">
            Volver a Preparar y etiquetar
          </Link>
        </div>
      )}
    </div>
  );
}
