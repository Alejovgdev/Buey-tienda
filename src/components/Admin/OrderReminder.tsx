'use client';

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CHECK_REDSYS_WARNING } from './OrderStatusControl';

// Botón "Enviar recordatorio al cliente" de un pedido sin pagar con más de
// 24 h. Se envía una sola vez: tras el envío la página deja de mostrarlo (y
// el servidor rechaza un segundo envío). Bloqueado mientras trabaja.
export default function OrderReminder({
  orderId,
  orderNumber,
  customerEmail,
}: {
  orderId: string;
  orderNumber: string;
  customerEmail: string;
}) {
  const router = useRouter();
  const busyRef = useRef(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  async function handleSend() {
    if (busyRef.current) return;
    const question =
      `¿Enviar el recordatorio del pedido ${orderNumber} a ${customerEmail}? Solo se puede enviar una vez. ` +
      CHECK_REDSYS_WARNING;
    if (!window.confirm(question)) return;

    busyRef.current = true;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/admin/pedidos/${orderId}/recordatorio`, { method: 'POST' });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setMessage({ kind: 'error', text: data?.error ?? 'No se pudo enviar el recordatorio' });
        return;
      }
      setMessage({ kind: 'ok', text: `Recordatorio enviado a ${customerEmail}.` });
      router.refresh();
    } catch {
      setMessage({ kind: 'error', text: 'Error de conexión. Revisa el histórico antes de reintentar.' });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  return (
    <div>
      <p className="text-sm text-gray-700">
        El cliente no terminó el pago. Puedes enviarle un recordatorio (una sola vez).
      </p>
      <button
        type="button"
        onClick={handleSend}
        disabled={busy}
        className="mt-2 rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? 'Enviando…' : 'Enviar recordatorio al cliente'}
      </button>
      {message && (
        <p className={message.kind === 'ok' ? 'mt-2 text-sm text-green-700' : 'mt-2 text-sm text-red-600'}>
          {message.text}
        </p>
      )}
    </div>
  );
}
