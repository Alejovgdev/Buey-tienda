import type { Metadata } from 'next';
import ConfirmacionPolling from '@/components/Pedido/ConfirmacionPolling';

export const metadata: Metadata = {
  title: 'Confirmando tu pedido | El Buey Madurado',
  description: 'Estamos confirmando el pago de tu pedido.',
  robots: { index: false, follow: true },
};

interface ConfirmacionPageProps {
  searchParams: Promise<{ order?: string }>;
}

// Fase 4, Unidad 4. Limitación conocida y esperada de esta fase: como la
// notificación real de Redsys (Fase 5) todavía no existe, ningún pedido
// llegará a PAID de forma realista aquí — solo se puede probar forzando el
// estado a mano en BD. No es un bug de esta unidad, es el límite de alcance.
export default async function ConfirmacionPage({ searchParams }: ConfirmacionPageProps) {
  const { order } = await searchParams;

  if (!order) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="text-2xl font-bold text-white">Pedido no especificado</h1>
        <p className="mt-3 text-white/60">Falta el número de pedido en la URL.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-16 md:py-24">
      <ConfirmacionPolling orderNumber={order} />
    </div>
  );
}
