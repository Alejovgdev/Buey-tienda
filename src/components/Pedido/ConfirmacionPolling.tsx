'use client';

import { useEffect, useRef, useState } from 'react';
import { useCart } from '@/contexts/CartContext';
import type { OrderStatusResponse } from '@/types/checkout';

interface ConfirmacionPollingProps {
  orderNumber: string;
}

const POLL_INTERVAL_MS = 2000;
const WAIT_MESSAGE_AFTER_MS = 30000;

export default function ConfirmacionPolling({ orderNumber }: ConfirmacionPollingProps) {
  const { clearCart } = useCart();
  const [status, setStatus] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [showWaitMessage, setShowWaitMessage] = useState(false);
  const clearedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const startedAt = Date.now();

    async function poll() {
      try {
        const response = await fetch(
          `/api/pedidos/estado?order=${encodeURIComponent(orderNumber)}`
        );

        if (response.status === 404) {
          if (!cancelled) setNotFound(true);
          return;
        }

        const data = (await response.json()) as OrderStatusResponse;
        if (cancelled) return;

        setStatus(data.status);

        if (data.status === 'PAID') {
          if (!clearedRef.current) {
            clearedRef.current = true;
            clearCart();
          }
          return; // deja de hacer polling, ya está confirmado
        }

        if (Date.now() - startedAt >= WAIT_MESSAGE_AFTER_MS) {
          setShowWaitMessage(true);
        }
      } catch {
        // fallo de red puntual - se reintenta en el siguiente tick, sin
        // mostrar error alarmante al cliente.
      }
    }

    poll();
    const interval = setInterval(poll, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [orderNumber, clearCart]);

  if (notFound) {
    return (
      <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-6 py-8 text-center text-red-200">
        No hemos encontrado el pedido {orderNumber}. Si has completado un pago, contacta con
        nosotros indicando este número de referencia.
      </div>
    );
  }

  if (status === 'PAID') {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-6 py-10 text-center">
        <p className="text-2xl font-bold text-white">¡Gracias por tu pedido!</p>
        <p className="mt-2 text-white/70">
          Tu pedido <span className="font-semibold text-emerald-300">{orderNumber}</span> ha
          sido confirmado. Te enviaremos un email con los detalles.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-6 py-10 text-center">
      <p className="text-lg font-semibold text-white">
        Pedido {orderNumber} recibido, confirmando el pago…
      </p>
      {showWaitMessage && (
        <p className="mt-4 text-sm text-white/60">
          Está tardando más de lo habitual. Tu pedido sigue procesándose — si tienes cualquier
          duda, contacta con nosotros indicando el número de pedido {orderNumber}.
        </p>
      )}
    </div>
  );
}
