'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatPriceFromCents } from '@/lib/format-price';
import { CORRECTIVE_REASON_MAX, parseEurosToCents, type CorrectiveKind } from '@/lib/corrective-invoice';

// Paso 8. Emisión de una factura rectificativa (serie R) desde la ficha del
// pedido. Dos opciones: «Devolver todo» (lo que quede por rectificar) o
// «Devolver una parte» (un importe). El motivo es obligatorio.
//
// El requestId se crea al abrir el formulario y se reutiliza en los
// reintentos: un doble clic o un reintento tras un error de conexión
// devuelven la misma factura en vez de crear otra.

export type CorrectiveFormData = {
  originalNumber: string;
  remaining: number;
  items: { description: string; lineTotal: number }[];
  shippingCost: number;
};

const REDSYS_REMINDER = 'Esto NO devuelve el dinero: haz la devolución a mano en el TPV de Redsys.';

const PLACEHOLDERS: Record<CorrectiveKind, string> = {
  PARTIAL: 'Producto y motivo, p. ej.: Chuletón 1 kg, llegó con el vacío roto',
  TOTAL: 'p. ej.: Pedido cancelado antes del envío',
};

function newRequestId(): string {
  return crypto.randomUUID();
}

export default function CorrectiveInvoiceForm({ orderId, data }: { orderId: string; data: CorrectiveFormData }) {
  const router = useRouter();
  const busyRef = useRef(false);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<CorrectiveKind>('PARTIAL');
  const [amountText, setAmountText] = useState('');
  const [reason, setReason] = useState('');
  const [requestId, setRequestId] = useState(newRequestId);
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  async function submit() {
    if (busyRef.current) return;
    setFeedback(null);

    const text = reason.trim();
    if (text === '') {
      setFeedback({ kind: 'error', text: 'Escribe el motivo.' });
      return;
    }
    let amount: number | null = null;
    if (kind === 'PARTIAL') {
      amount = parseEurosToCents(amountText);
      if (amount === null) {
        setFeedback({ kind: 'error', text: 'Escribe un importe válido, por ejemplo 12,50.' });
        return;
      }
      if (amount > data.remaining) {
        setFeedback({
          kind: 'error',
          text: `El importe supera lo que queda por devolver (${formatPriceFromCents(data.remaining)}).`,
        });
        return;
      }
    }

    const refund = kind === 'TOTAL' ? data.remaining : (amount as number);
    const question =
      `¿Emitir una factura rectificativa por ${formatPriceFromCents(-refund)} que rectifica a ${data.originalNumber}? ` +
      `Se le asignará un número definitivo (serie R).\n\n${REDSYS_REMINDER}`;
    if (!window.confirm(question)) return;

    busyRef.current = true;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/pedidos/${orderId}/rectificativa`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, amount, reason: text, requestId }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) {
        setFeedback({ kind: 'error', text: result?.error ?? 'No se pudo emitir la factura rectificativa' });
        return;
      }
      setFeedback({
        kind: 'ok',
        text:
          `Factura rectificativa ${String(result.invoiceNumber)} emitida por ${formatPriceFromCents(Number(result.total))}. ` +
          'Recuerda devolver el dinero en el TPV de Redsys. Puedes enviarla al cliente desde la lista de facturas.',
      });
      setOpen(false);
      setAmountText('');
      setReason('');
      setRequestId(newRequestId());
      router.refresh();
    } catch {
      setFeedback({ kind: 'error', text: 'Error de conexión. Vuelve a pulsar «Emitir rectificativa»: no se duplicará.' });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  const buttonClass = 'rounded-md px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div className="space-y-2">
      {!open ? (
        <button
          type="button"
          onClick={() => {
            setOpen(true);
            setFeedback(null);
          }}
          className={`${buttonClass} border border-gray-300 bg-white text-gray-900 hover:bg-gray-50`}
        >
          Emitir rectificativa
        </button>
      ) : (
        <div className="space-y-3 rounded-md border border-gray-300 bg-gray-50 p-3">
          <p className="text-sm text-gray-700">
            Rectifica a <strong>{data.originalNumber}</strong>. Queda por devolver{' '}
            <strong>{formatPriceFromCents(data.remaining)}</strong>.
          </p>

          <fieldset className="space-y-1 text-sm text-gray-900">
            <label className="flex items-center gap-2">
              <input type="radio" name="corrective-kind" checked={kind === 'PARTIAL'} onChange={() => setKind('PARTIAL')} />
              Devolver una parte
            </label>
            <label className="flex items-center gap-2">
              <input type="radio" name="corrective-kind" checked={kind === 'TOTAL'} onChange={() => setKind('TOTAL')} />
              Devolver todo ({formatPriceFromCents(data.remaining)}, envío incluido)
            </label>
          </fieldset>

          {kind === 'PARTIAL' && (
            <div className="space-y-2">
              <label className="block text-sm text-gray-900">
                Importe a devolver (€, IVA incluido)
                <input
                  type="text"
                  inputMode="decimal"
                  value={amountText}
                  onChange={(event) => setAmountText(event.target.value)}
                  placeholder="12,50"
                  className="mt-1 block w-32 rounded-md border border-gray-300 bg-white px-2 py-1 text-gray-900"
                />
              </label>
              <div className="text-xs text-gray-600">
                <p className="font-semibold">Como ayuda, precios del pedido:</p>
                <ul>
                  {data.items.map((item, index) => (
                    <li key={index}>
                      {item.description}: {formatPriceFromCents(item.lineTotal)}
                    </li>
                  ))}
                  {data.shippingCost > 0 && <li>Gastos de envío: {formatPriceFromCents(data.shippingCost)}</li>}
                </ul>
              </div>
            </div>
          )}

          <label className="block text-sm text-gray-900">
            Motivo (obligatorio)
            <textarea
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder={PLACEHOLDERS[kind]}
              maxLength={CORRECTIVE_REASON_MAX}
              rows={2}
              className="mt-1 block w-full rounded-md border border-gray-300 bg-white px-2 py-1 text-gray-900"
            />
          </label>

          <p className="text-sm font-medium text-amber-800">{REDSYS_REMINDER}</p>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={submit}
              disabled={busy}
              className={`${buttonClass} bg-gray-900 text-white hover:bg-gray-800`}
            >
              {busy ? 'Emitiendo…' : 'Emitir rectificativa'}
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={busy}
              className={`${buttonClass} border border-gray-300 bg-white text-gray-900 hover:bg-gray-50`}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {feedback && (
        <p className={feedback.kind === 'ok' ? 'text-sm text-green-700' : 'text-sm text-red-600'}>{feedback.text}</p>
      )}
    </div>
  );
}
