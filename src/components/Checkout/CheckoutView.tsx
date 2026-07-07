'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/contexts/CartContext';
import type { CustomerData } from '@/lib/checkout-schema';
import type { CreateSessionError, CreateSessionSuccess } from '@/types/checkout';
import CheckoutForm from './CheckoutForm';
import OrderSummary from './OrderSummary';
import RedsysAutoSubmitForm from './RedsysAutoSubmitForm';

interface CheckoutViewProps {
  acceptingOrders: boolean;
}

type Status = 'idle' | 'submitting' | 'error' | 'redirecting';

export default function CheckoutView({ acceptingOrders }: CheckoutViewProps) {
  const { items, isLoaded } = useCart();
  const router = useRouter();
  const [status, setStatus] = useState<Status>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [session, setSession] = useState<CreateSessionSuccess | null>(null);

  useEffect(() => {
    if (isLoaded && items.length === 0 && status === 'idle') {
      router.replace('/carrito');
    }
  }, [isLoaded, items.length, status, router]);

  async function handleSubmit(customer: CustomerData) {
    setStatus('submitting');
    setErrorMessage(null);

    try {
      const response = await fetch('/api/checkout/create-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer,
          items: items.map((item) => ({ variantId: item.variantId, quantity: item.quantity })),
        }),
      });

      const data = (await response.json()) as CreateSessionSuccess | CreateSessionError;

      if (!response.ok || 'error' in data) {
        setErrorMessage(
          'message' in data
            ? data.message
            : 'No se pudo procesar el pedido. Inténtalo de nuevo.'
        );
        setStatus('error');
        return;
      }

      setSession(data);
      setStatus('redirecting');
    } catch {
      setErrorMessage('No se pudo conectar con el servidor. Inténtalo de nuevo.');
      setStatus('error');
    }
  }

  if (!isLoaded) {
    return <div className="mx-auto max-w-4xl px-4 py-24 text-center text-white/40">Cargando…</div>;
  }

  if (status === 'redirecting' && session) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <p className="text-lg font-semibold text-white">
          Pedido {session.orderNumber} creado. Redirigiendo a la pasarela de pago segura…
        </p>
        <RedsysAutoSubmitForm payload={session.redsys} />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_360px]">
      <CheckoutForm
        disabled={!acceptingOrders}
        submitting={status === 'submitting'}
        errorMessage={status === 'error' ? errorMessage : null}
        onSubmit={handleSubmit}
      />
      <OrderSummary items={items} />
    </div>
  );
}
