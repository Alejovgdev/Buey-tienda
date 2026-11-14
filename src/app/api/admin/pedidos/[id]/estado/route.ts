import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import {
  UNPAID_GRACE_HOURS,
  isUnpaidOrderStale,
  isUnpaidStatus,
  isValidOrderStatus,
  isValidTransition,
} from '@/lib/admin/order-status';
import { issueInvoiceFromAdmin } from '@/lib/invoices-admin';

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
    .select('id, status, created_at')
    .eq('id', id)
    .maybeSingle<{ id: string; status: string; created_at: string }>();

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

  // Un pedido sin pagar solo se puede cancelar pasado el plazo: antes puede
  // llegar todavía la notificación de Redsys.
  if (isUnpaidStatus(currentStatus) && !isUnpaidOrderStale(currentStatus, order.created_at)) {
    return NextResponse.json(
      { error: `Un pedido sin pagar solo se puede cancelar pasadas ${UNPAID_GRACE_HOURS} horas desde su creación` },
      { status: 409 }
    );
  }

  // Solo si el estado sigue siendo el leído: si entretanto ha llegado un pago
  // (o lo ha cambiado otra persona), no se pisa.
  const { data: updated, error: updateError } = await supabaseAdmin
    .from('orders')
    .update({ status: newStatus, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', currentStatus)
    .select('id')
    .maybeSingle<{ id: string }>();

  if (updateError) {
    return NextResponse.json({ error: 'No se pudo actualizar el pedido' }, { status: 500 });
  }
  if (!updated) {
    return NextResponse.json(
      { error: 'El pedido ha cambiado mientras tanto. Recarga la página y vuelve a intentarlo.' },
      { status: 409 }
    );
  }

  await supabaseAdmin.from('order_status_history').insert({
    order_id: id,
    event_type: 'ESTADO_CAMBIADO',
    previous_status: currentStatus,
    new_status: newStatus,
  });

  // Paso 6. Un pedido cobrado que se quedó en revisión (Error de stock) no
  // tiene factura: se emite al resolverlo. El cambio de estado ya está hecho;
  // si la factura falla queda FACTURA_ERROR y el botón "Emitir factura".
  if (currentStatus === 'NEEDS_REVIEW' && newStatus === 'PREPARING') {
    const invoice = await issueInvoiceFromAdmin(id, 'revision');
    return NextResponse.json({
      ok: true,
      status: newStatus,
      invoice: invoice.ok ? { ok: true, invoiceNumber: invoice.invoiceNumber } : { ok: false, error: invoice.error },
    });
  }

  return NextResponse.json({ ok: true, status: newStatus });
}
