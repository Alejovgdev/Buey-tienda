'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatPriceFromCents } from '@/lib/format-price';

// Paso 6. Sección "Factura" de la ficha del pedido: lista de facturas con
// descarga y reenvío, y emisión manual si el pedido pagado se quedó sin ella.
// Las dos acciones que escriben piden confirmación y bloquean todos los
// botones mientras trabajan (un doble clic no duplica envíos ni números).

export type OrderInvoiceItem = {
  id: string;
  invoiceNumber: string;
  typeLabel: string;
  statusLabel: string;
  status: string;
  issueDate: string;
  total: number;
};

type Feedback = { kind: 'ok' | 'error'; text: string } | null;

function formatIssueDate(date: string): string {
  const [year, month, day] = date.split('-');
  return `${day}/${month}/${year}`;
}

export default function OrderInvoices({
  orderId,
  orderNumber,
  customerEmail,
  invoices,
  canIssue,
}: {
  orderId: string;
  orderNumber: string;
  customerEmail: string;
  invoices: OrderInvoiceItem[];
  canIssue: boolean;
}) {
  const router = useRouter();
  const busyRef = useRef(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function run(key: string, question: string, url: string, onOk: (data: Record<string, unknown>) => string) {
    if (busyRef.current) return;
    if (!window.confirm(question)) return;

    busyRef.current = true;
    setBusy(key);
    setFeedback(null);
    try {
      const response = await fetch(url, { method: 'POST' });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setFeedback({ kind: 'error', text: data?.error ?? 'No se pudo completar la acción' });
        return;
      }
      setFeedback({ kind: 'ok', text: onOk(data ?? {}) });
      router.refresh();
    } catch {
      setFeedback({ kind: 'error', text: 'Error de conexión. Revisa el histórico antes de reintentar.' });
    } finally {
      busyRef.current = false;
      setBusy(null);
    }
  }

  const resend = (invoice: OrderInvoiceItem) =>
    run(
      `resend:${invoice.id}`,
      `¿Enviar la factura ${invoice.invoiceNumber} a ${customerEmail}?`,
      `/api/admin/facturas/${invoice.id}/reenviar`,
      () => `Factura ${invoice.invoiceNumber} enviada a ${customerEmail}.`
    );

  const issue = () =>
    run(
      'issue',
      `¿Emitir la factura simplificada del pedido ${orderNumber}? Se le asignará un número de factura definitivo.`,
      `/api/admin/pedidos/${orderId}/factura`,
      (data) =>
        data.alreadyIssued
          ? `El pedido ya tenía la factura ${String(data.invoiceNumber)}.`
          : `Factura ${String(data.invoiceNumber)} emitida.`
    );

  const disabled = busy !== null;
  const buttonClass =
    'rounded-md px-3 py-1.5 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-50';

  return (
    <div className="space-y-3">
      {invoices.length === 0 ? (
        <p className="text-sm text-gray-500">Este pedido no tiene factura.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {invoices.map((invoice) => (
            <li key={invoice.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div>
                <p className="font-semibold text-gray-900">
                  {invoice.invoiceNumber}
                  <span className="ml-2 text-sm font-normal text-gray-600">{invoice.typeLabel}</span>
                  <span
                    className={
                      'ml-2 rounded px-2 py-0.5 text-xs font-bold ' +
                      (invoice.status === 'EMITIDA' ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-700')
                    }
                  >
                    {invoice.statusLabel}
                  </span>
                </p>
                <p className="text-sm text-gray-600">
                  {formatIssueDate(invoice.issueDate)} · {formatPriceFromCents(invoice.total)}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <a
                  href={`/api/admin/facturas/${invoice.id}/pdf`}
                  aria-disabled={disabled}
                  className={`${buttonClass} border border-gray-300 bg-white text-gray-900 hover:bg-gray-50 ${disabled ? 'pointer-events-none opacity-50' : ''}`}
                >
                  Descargar PDF
                </a>
                <button
                  type="button"
                  onClick={() => resend(invoice)}
                  disabled={disabled}
                  className={`${buttonClass} bg-gray-900 text-white hover:bg-gray-800`}
                >
                  {busy === `resend:${invoice.id}` ? 'Enviando…' : 'Reenviar al cliente'}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {canIssue && (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3">
          <p className="text-sm text-amber-900">
            El pedido está pagado pero no tiene factura simplificada.
          </p>
          <button
            type="button"
            onClick={issue}
            disabled={disabled}
            className={`${buttonClass} mt-2 bg-amber-700 text-white hover:bg-amber-800`}
          >
            {busy === 'issue' ? 'Emitiendo…' : 'Emitir factura'}
          </button>
        </div>
      )}

      {feedback && (
        <p className={feedback.kind === 'ok' ? 'text-sm text-green-700' : 'text-sm text-red-600'}>{feedback.text}</p>
      )}
    </div>
  );
}
