import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';
import Link from 'next/link';
import { getAdminSession } from '@/lib/admin-session';
import { BoxLabelError, prepareBoxLabel } from '@/lib/box-label/server';
import BoxLabelClient from '@/components/Admin/BoxLabel/BoxLabelClient';

export const dynamic = 'force-dynamic';

export default async function BoxLabelPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) redirect('/admin/login');
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  try {
    const preview = await prepareBoxLabel(id, session);
    return <BoxLabelClient orderId={id} initial={preview} />;
  } catch (error) {
    if (error instanceof BoxLabelError && error.status === 404) notFound();
    return <div className="mx-auto max-w-3xl space-y-4 p-6">
      <Link href={`/admin/pedidos/${id}`} className="text-blue-700 underline">← Volver al pedido</Link>
      <h1 className="text-xl font-bold">Etiqueta de caja</h1>
      <p role="alert">{error instanceof BoxLabelError ? error.message : 'No se pudo cargar la etiqueta de caja'}</p>
    </div>;
  }
}
