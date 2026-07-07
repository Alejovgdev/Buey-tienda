import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { isValidOrderStatus, isValidTransition } from '@/lib/admin/order-status';

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
  const newStatus = body?.status;

  if (typeof newStatus !== 'string' || !isValidOrderStatus(newStatus)) {
    return NextResponse.json({ error: 'Estado no válido' }, { status: 400 });
  }

  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select('id, status')
    .eq('id', id)
    .maybeSingle<{ id: string; status: string }>();

  if (orderError || !order) {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
  }

  const currentStatus = order.status;

  if (!isValidOrderStatus(currentStatus) || !isValidTransition(currentStatus, newStatus)) {
    return NextResponse.json(
      { error: `Transición no permitida: ${currentStatus} → ${newStatus}` },
      { status: 409 }
    );
  }

  const { error: updateError } = await supabaseAdmin
    .from('orders')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', id);

  if (updateError) {
    return NextResponse.json({ error: 'No se pudo actualizar el pedido' }, { status: 500 });
  }

  await supabaseAdmin.from('order_status_history').insert({
    order_id: id,
    event_type: 'ESTADO_CAMBIADO',
    previous_status: currentStatus,
    new_status: newStatus,
  });

  return NextResponse.json({ ok: true, status: newStatus });
}
