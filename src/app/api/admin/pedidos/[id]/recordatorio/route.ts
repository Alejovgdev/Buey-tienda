import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-session';
import { UNPAID_GRACE_HOURS, UNPAID_STATUSES, isUnpaidOrderStale } from '@/lib/admin/order-status';
import { isUuid } from '@/lib/invoices-admin';
import { sendPaymentReminder } from '@/lib/email/send-order-alerts';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { safeErrorCode } from '@/lib/safe-error-code';

interface RouteParams {
  params: Promise<{ id: string }>;
}

type ReminderOrderRow = {
  id: string;
  order_number: string;
  status: string;
  created_at: string;
  customer_name: string;
  customer_email: string;
  payment_reminder_sent_at: string | null;
};

type ReminderItemRow = { product_name_snapshot: string; variant_name_snapshot: string; quantity: number };

// Recordatorio de pedido no terminado (Pendiente de pago o Pago fallido con
// más de 24 h). UNA sola vez por pedido: antes de enviar se marca
// orders.payment_reminder_sent_at con un UPDATE condicionado a que siga
// vacío, así dos clics simultáneos no pueden enviar dos emails. Si el envío
// falla se desmarca para poder reintentarlo.
export async function POST(_request: Request, { params }: RouteParams) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
  }

  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select('id, order_number, status, created_at, customer_name, customer_email, payment_reminder_sent_at')
    .eq('id', id)
    .maybeSingle<ReminderOrderRow>();
  if (orderError || !order) {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
  }
  if (order.payment_reminder_sent_at) {
    return NextResponse.json({ error: 'El recordatorio de este pedido ya se envió' }, { status: 409 });
  }
  if (!isUnpaidOrderStale(order.status, order.created_at)) {
    return NextResponse.json(
      { error: `Solo se puede enviar a pedidos sin pagar con más de ${UNPAID_GRACE_HOURS} horas` },
      { status: 409 }
    );
  }

  const { data: items, error: itemsError } = await supabaseAdmin
    .from('order_items')
    .select('product_name_snapshot, variant_name_snapshot, quantity')
    .eq('order_id', id)
    .eq('item_type', 'PRODUCT')
    .returns<ReminderItemRow[]>();
  if (itemsError || !items || items.length === 0) {
    return NextResponse.json({ error: 'No se pudieron leer los productos del pedido' }, { status: 500 });
  }

  // Marca de "enviado" antes de enviar: solo una petición puede ponerla.
  const claimedAt = new Date().toISOString();
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from('orders')
    .update({ payment_reminder_sent_at: claimedAt })
    .eq('id', id)
    .is('payment_reminder_sent_at', null)
    .in('status', UNPAID_STATUSES as unknown as string[])
    .select('id')
    .maybeSingle<{ id: string }>();
  if (claimError) {
    return NextResponse.json({ error: 'No se pudo preparar el envío' }, { status: 500 });
  }
  if (!claimed) {
    return NextResponse.json({ error: 'El recordatorio ya se envió o el pedido ha cambiado. Recarga la página.' }, { status: 409 });
  }

  try {
    await sendPaymentReminder({
      to: order.customer_email,
      customerName: order.customer_name,
      orderNumber: order.order_number,
      items: items.map((item) => ({
        productName: item.product_name_snapshot,
        variantName: item.variant_name_snapshot,
        quantity: item.quantity,
      })),
    });
  } catch (err) {
    console.error('[admin/recordatorio] No se pudo enviar', { orderId: id, errorCode: safeErrorCode(err) });
    // Desmarcar solo la marca que puso esta petición.
    await supabaseAdmin
      .from('orders')
      .update({ payment_reminder_sent_at: null })
      .eq('id', id)
      .eq('payment_reminder_sent_at', claimedAt);
    await supabaseAdmin.from('order_status_history').insert({
      order_id: id,
      event_type: 'RECORDATORIO_ERROR',
      metadata: { email: order.customer_email },
    });
    return NextResponse.json({ error: 'No se pudo enviar el email. Puedes volver a intentarlo.' }, { status: 502 });
  }

  const { error: historyError } = await supabaseAdmin.from('order_status_history').insert({
    order_id: id,
    event_type: 'RECORDATORIO_ENVIADO',
    notes: `Enviado a ${order.customer_email}`,
    metadata: { email: order.customer_email },
  });
  if (historyError) {
    console.error('[admin/recordatorio] Enviado, pero no se guardó en el histórico', {
      orderId: id, errorCode: safeErrorCode(historyError),
    });
  }

  return NextResponse.json({ ok: true, email: order.customer_email });
}
