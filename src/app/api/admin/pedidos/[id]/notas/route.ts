import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-session';
import { supabaseAdmin } from '@/lib/supabase-admin';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Fase 7, Unidad 5. No cubierta por el matcher del middleware (/admin/:path*,
// no /api/admin/:path*) — la sesión se verifica aquí, no solo en el cliente.
export async function PATCH(request: Request, { params }: RouteParams) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const notes = typeof body?.notes === 'string' ? body.notes.trim() : null;

  if (notes === null) {
    return NextResponse.json({ error: 'Nota no válida' }, { status: 400 });
  }

  const { data: order } = await supabaseAdmin.from('orders').select('id').eq('id', id).maybeSingle<{ id: string }>();

  if (!order) {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
  }

  const { error: updateError } = await supabaseAdmin
    .from('orders')
    .update({ admin_notes: notes, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (updateError) {
    return NextResponse.json({ error: 'No se pudo guardar la nota' }, { status: 500 });
  }

  await supabaseAdmin.from('order_status_history').insert({
    order_id: id,
    event_type: 'NOTA_INTERNA_AÑADIDA',
    notes,
  });

  return NextResponse.json({ ok: true });
}
