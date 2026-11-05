'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCart } from '@/contexts/CartContext';
import type { CustomerData } from '@/lib/checkout-schema';
import type { CheckoutReview, CreateSessionError, CreateSessionSuccess } from '@/types/checkout';
import CheckoutForm from './CheckoutForm';
import OrderSummary from './OrderSummary';
import RedsysAutoSubmitForm from './RedsysAutoSubmitForm';

type Status = 'idle' | 'submitting' | 'error' | 'redirecting';

export default function CheckoutView() {
  const { items, isLoaded } = useCart();
  const router = useRouter();
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<CreateSessionError | null>(null);
  const [reviewed, setReviewed] = useState<{ key: string; data: CheckoutReview } | null>(null);
  const [reviewing, setReviewing] = useState(true);
  const [retry, setRetry] = useState(0);
  const [priceNotice, setPriceNotice] = useState<string | null>(null);
  const [session, setSession] = useState<CreateSessionSuccess | null>(null);
  const reviewKey = JSON.stringify(items.map(item => ({
    variantId: item.variantId, productSlug: item.productSlug,
    quantity: item.quantity, expectedUnitPrice: item.unitPrice,
  })));
  const review = reviewed?.key === reviewKey ? reviewed.data : null;

  useEffect(() => {
    if (!isLoaded || items.length === 0) return;
    const controller = new AbortController();
    setReviewing(true);
    setReviewed(null);
    setError(null);
    setPriceNotice(null);
    fetch('/api/checkout/review', {
      method: 'POST', cache: 'no-store', signal: controller.signal,
      headers: { 'Content-Type': 'application/json' }, body: `{"items":${reviewKey}}`,
    }).then(async response => {
      const data = await response.json() as CheckoutReview | CreateSessionError;
      if (controller.signal.aborted) return;
      if (!response.ok || 'error' in data) {
        setError('error' in data ? data : { error: 'ERROR_INTERNO', message: 'No se pudo comprobar el carrito.' });
        return;
      }
      setReviewed({ key: reviewKey, data });
      if (data.pricesChanged) setPriceNotice('Los precios han cambiado desde que añadiste los productos. Revisa el total actualizado antes de pagar.');
    }).catch(() => {
      if (!controller.signal.aborted) setError({ error: 'ERROR_INTERNO', message: 'No se pudo comprobar el carrito. Vuelve a intentarlo antes de pagar.' });
    }).finally(() => {
      if (!controller.signal.aborted) setReviewing(false);
    });
    return () => controller.abort();
    // La clave contiene todas las líneas y precios vistos; cambia también al editar cantidades.
  }, [isLoaded, reviewKey, retry, items.length]);

  useEffect(() => {
    if (isLoaded && items.length === 0 && status === 'idle') {
      router.replace('/carrito');
    }
  }, [isLoaded, items.length, status, router]);

  async function handleSubmit(customer: CustomerData) {
    if (!review || reviewing || status === 'submitting') return;
    setStatus('submitting');
    setError(null);

    try {
      const response = await fetch('/api/checkout/create-session', {
        method: 'POST',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer,
          items: review.items.map((item) => ({
            variantId: item.variantId, productSlug: item.productSlug,
            quantity: item.quantity, expectedUnitPrice: item.unitPrice,
          })),
          expectedTotal: review.total,
        }),
      });

      const data = (await response.json()) as CreateSessionSuccess | CreateSessionError;

      if (!response.ok || 'error' in data) {
        if ('error' in data && data.error === 'PRECIOS_ACTUALIZADOS') {
          setReviewed({ key: reviewKey, data: data.review });
          setPriceNotice(data.message);
        } else {
          setReviewed(null);
          setError('error' in data ? data : { error: 'ERROR_INTERNO', message: 'No se pudo procesar el pedido. Inténtalo de nuevo.' });
        }
        setStatus('error');
        return;
      }

      setSession(data);
      setStatus('redirecting');
    } catch {
      setError({ error: 'ERROR_INTERNO', message: 'No se pudo conectar con el servidor. Inténtalo de nuevo.' });
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
    <div>
      {reviewing && <p role="status" className="mb-6 text-white/70">Comprobando precios y disponibilidad…</p>}
      {priceNotice && <p role="status" className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-amber-200">{priceNotice}</p>}
      {error && (
        <div role="alert" className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
          <p>{error.message}</p>
          {error.error === 'STOCK_INSUFICIENTE' && <ul className="mt-2 list-disc pl-5">
            {error.items.map(item => <li key={item.variantId}>
              {item.productName} {item.variantName}: {item.availableStock > 0
                ? `puedes pedir hasta ${item.availableStock} unidades.` : 'ya no está disponible; elimínalo del carrito.'}
            </li>)}
          </ul>}
          <div className="mt-3 flex flex-wrap gap-4">
            <Link href="/carrito" className="underline">Revisar carrito</Link>
            <button type="button" className="underline" onClick={() => { setRetry(value => value + 1); router.refresh(); }} disabled={reviewing}>Volver a comprobar</button>
          </div>
        </div>
      )}
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_360px]">
        <CheckoutForm
          disabled={reviewing || !review}
          submitting={status === 'submitting'}
          errorMessage={null}
          onSubmit={handleSubmit}
        />
        {review && <OrderSummary items={review.items} />}
      </div>
    </div>
  );
}
