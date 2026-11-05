'use client';

import { useEffect, useRef, useState } from 'react';
import { useCart } from '@/contexts/CartContext';
import {
  RESULT_MESSAGES,
  startConfirmationPolling,
  type ConfirmationState,
} from './confirmacion-polling';

interface ConfirmacionPollingProps {
  orderNumber: string;
}

export function ConfirmacionEstado({
  orderNumber,
  state,
}: ConfirmacionPollingProps & { state: ConfirmationState }) {
  let title: string;
  let detail: string;
  const confirmed = state.kind === 'result'
    && (state.status === 'PAID' || state.status === 'PREPARING');

  if (state.kind === 'result') {
    ({ title, detail } = RESULT_MESSAGES[state.status]);
  } else if (state.kind === 'waiting') {
    title = 'Pedido recibido, confirmando el pago…';
    detail = state.delayed
      ? 'La confirmación está tardando más de lo habitual. No repitas el pago: podría haberse cobrado. Si tienes dudas, contacta con nosotros.'
      : 'Estamos consultando el estado de tu pedido. No repitas el pago mientras lo comprobamos.';
  } else {
    title = state.kind === 'not-found'
      ? 'No hemos encontrado tu pedido'
      : state.kind === 'timeout'
        ? 'La confirmación está tardando más de lo habitual'
        : 'No hemos podido confirmar el estado de tu pedido';
    detail = 'No podemos confirmar ahora el resultado del pago. Podría haberse cobrado: no repitas el pago. Contacta con nosotros indicando el número de pedido.';
  }

  return (
    <div
      role="status"
      aria-live="polite"
      className={`rounded-2xl border px-6 py-10 text-center ${confirmed
        ? 'border-emerald-500/30 bg-emerald-500/10'
        : 'border-white/10 bg-white/5'}`}
    >
      <p className="text-2xl font-bold text-white">{title}</p>
      <p className="mt-2 font-semibold text-white">Pedido {orderNumber}</p>
      <p className="mt-4 text-white/70">{detail}</p>
    </div>
  );
}

function ConfirmacionPedido({ orderNumber }: ConfirmacionPollingProps) {
  const { clearCart } = useCart();
  const [state, setState] = useState<ConfirmationState>({ kind: 'waiting', delayed: false });
  const clearedRef = useRef(false);

  useEffect(() => startConfirmationPolling(orderNumber, (next) => {
    setState(next);
    if (next.kind === 'result' && (next.status === 'PAID' || next.status === 'PREPARING')) {
      if (!clearedRef.current) {
        clearedRef.current = true;
        clearCart();
      }
    }
  }), [orderNumber, clearCart]);

  return <ConfirmacionEstado orderNumber={orderNumber} state={state} />;
}

export default function ConfirmacionPolling({ orderNumber }: ConfirmacionPollingProps) {
  return <ConfirmacionPedido key={orderNumber} orderNumber={orderNumber} />;
}
