import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getAdminSession } from '@/lib/admin-session';
import { prepareBoxLabelSchema } from '@/lib/box-label/schema';
import { BoxLabelError, prepareBoxLabel } from '@/lib/box-label/server';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getAdminSession();
  if (!session) return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
  const body = prepareBoxLabelSchema.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: 'Selección de regalos no válida' }, { status: 400 });
  try {
    return NextResponse.json(await prepareBoxLabel(id, session, body.data.includedGiftIds), { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof BoxLabelError ? error.message : 'No se pudo preparar la etiqueta de caja' },
      { status: error instanceof BoxLabelError ? error.status : 500 });
  }
}
