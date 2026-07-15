import { NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/admin-session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { cancelLabelSchema } from '@/lib/labels/label-preparation-schema';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Anula una etiqueta (envase que no se llega a usar: sobra, se contó mal,
// etc.) sin borrar la fila — conserva el histórico. Requiere motivo. Una
// etiqueta anulada no vuelve a poder editarse ni imprimirse.
export async function POST(request: Request, { params }: RouteParams) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = cancelLabelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos no válidos', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { data: label } = await supabaseAdmin
    .from('product_labels')
    .select('id, status')
    .eq('id', id)
    .maybeSingle<{ id: string; status: string }>();

  if (!label) {
    return NextResponse.json({ error: 'Etiqueta no encontrada' }, { status: 404 });
  }
  if (label.status === 'CANCELLED') {
    return NextResponse.json({ ok: true });
  }

  const { error } = await supabaseAdmin
    .from('product_labels')
    .update({
      status: 'CANCELLED',
      cancelled_at: new Date().toISOString(),
      cancelled_reason: parsed.data.reason,
      updated_by: session.workerName,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: 'No se pudo anular la etiqueta' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
