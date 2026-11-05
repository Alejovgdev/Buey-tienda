import type { OrderStatusResponse } from '@/types/checkout';

export const POLL_INTERVAL_MS = 2000;
export const WAIT_MESSAGE_AFTER_MS = 30000;
export const MAX_POLL_ATTEMPTS = 30;
export const MAX_WAIT_MS = 60000;

export const RESULT_MESSAGES = {
  PAID: {
    title: '¡Gracias por tu pedido!',
    detail: 'Tu pago está confirmado. Te enviaremos un email con los detalles.',
  },
  PREPARING: {
    title: 'Estamos preparando tu pedido',
    detail: 'Tu pedido está confirmado y ya hemos empezado a prepararlo.',
  },
  PAYMENT_FAILED: {
    title: 'El pago no se ha completado',
    detail: 'Hemos recibido un resultado de pago fallido. Si ves un cargo o tienes dudas, contacta con nosotros antes de volver a pagar.',
  },
  CANCELLED: {
    title: 'Tu pedido está cancelado',
    detail: 'Si se ha realizado un cargo, contacta con nosotros para revisar su estado. No repitas el pago de este pedido.',
  },
  STOCK_ERROR: {
    title: 'Hay una incidencia de disponibilidad en tu pedido',
    detail: 'El pago podría haberse cobrado. Necesitamos revisar tu pedido; contacta con nosotros y no repitas el pago.',
  },
  NEEDS_REVIEW: {
    title: 'Tu pedido necesita revisión',
    detail: 'Necesitamos comprobar el estado de tu pedido y del pago. Contacta con nosotros y no repitas el pago: podría haberse cobrado.',
  },
} as const;

type ResultStatus = keyof typeof RESULT_MESSAGES;

export type ConfirmationState =
  | { kind: 'waiting'; delayed: boolean }
  | { kind: 'result'; status: ResultStatus }
  | { kind: 'not-found' | 'timeout' | 'unavailable' };

function isResultStatus(status: unknown): status is ResultStatus {
  return typeof status === 'string' && Object.prototype.hasOwnProperty.call(RESULT_MESSAGES, status);
}

// Solo consulta el estado. El cierre se usa también como cleanup del efecto:
// cancela temporizadores y la petición, e ignora respuestas que lleguen tarde.
export function startConfirmationPolling(
  orderNumber: string,
  onState: (state: ConfirmationState) => void,
): () => void {
  let stopped = false;
  let attempts = 0;
  let nextPoll: ReturnType<typeof setTimeout> | undefined;
  const controller = new AbortController();

  function stop() {
    stopped = true;
    clearTimeout(nextPoll);
    clearTimeout(waitTimer);
    clearTimeout(deadlineTimer);
    controller.abort();
  }

  function finish(state: ConfirmationState) {
    if (stopped) return;
    stop();
    onState(state);
  }

  const waitTimer = setTimeout(() => {
    if (!stopped) onState({ kind: 'waiting', delayed: true });
  }, WAIT_MESSAGE_AFTER_MS);
  // El plazo también se cumple si fetch o response.json no llegan a resolver.
  const deadlineTimer = setTimeout(() => finish({ kind: 'timeout' }), MAX_WAIT_MS);

  async function poll() {
    attempts += 1;
    try {
      const response = await fetch(
        `/api/pedidos/estado?order=${encodeURIComponent(orderNumber)}`,
        { signal: controller.signal, cache: 'no-store' },
      );
      if (stopped) return;
      if (response.status === 404) {
        finish({ kind: 'not-found' });
        return;
      }
      if (!response.ok) throw new Error('No se pudo consultar el pedido');

      const data: Partial<OrderStatusResponse> | null = await response.json();
      if (stopped) return;
      if (data?.orderNumber !== orderNumber) {
        finish({ kind: 'unavailable' });
        return;
      }
      if (isResultStatus(data.status)) {
        finish({ kind: 'result', status: data.status });
        return;
      }
      if (data.status !== 'PENDING_PAYMENT') {
        finish({ kind: 'unavailable' });
        return;
      }
    } catch {
      // Los errores transitorios se reintentan dentro de los mismos límites.
    }
    if (stopped) return;
    if (attempts >= MAX_POLL_ATTEMPTS) {
      finish({ kind: 'timeout' });
      return;
    }
    // Programar después de resolver evita consultas simultáneas.
    nextPoll = setTimeout(() => { void poll(); }, POLL_INTERVAL_MS);
  }

  onState({ kind: 'waiting', delayed: false });
  void poll();
  return stop;
}
