import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-session';
import { loadInvoiceWithPdf } from '@/lib/invoices-admin';
import { sendInvoiceEmail } from '@/lib/email/send-invoice-email';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { safeErrorCode } from '@/lib/safe-error-code';

interface RouteParams {
  params: Promise<{ id: string }>;
}

type OrderContactRow = { id: string; order_number: string; customer_name: string; customer_email: string };

// Paso 6. Reenvío de una factura al cliente. El destinatario es siempre el
// email guardado en el pedido: la petición no puede elegir otro.
export async function POST(_request: Request, { params }: RouteParams) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { id } = await params;
  let invoice;
  try {
    invoice = await loadInvoiceWithPdf(id);
  } catch (err) {
    console.error('[admin/facturas/reenviar] No se pudo preparar el PDF', { invoiceId: id, errorCode: safeErrorCode(err) });
    return NextResponse.json({ error: 'No se pudo preparar el PDF de la factura' }, { status: 500 });
  }
  if (!invoice) {
    return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });
  }

  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select('id, order_number, customer_name, customer_email')
    .eq('id', invoice.orderId)
    .maybeSingle<OrderContactRow>();
  if (orderError || !order) {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
  }

  try {
    await sendInvoiceEmail({
      to: order.customer_email,
      customerName: order.customer_name,
      orderNumber: order.order_number,
      invoiceNumber: invoice.invoiceNumber,
      invoiceType: invoice.invoiceType,
      pdf: { filename: invoice.pdf.filename, content: invoice.pdf.content },
    });
  } catch (err) {
    console.error('[admin/facturas/reenviar] No se pudo enviar el email', { invoiceId: id, errorCode: safeErrorCode(err) });
    return NextResponse.json({ error: 'No se pudo enviar el email' }, { status: 502 });
  }

  // El email ya ha salido: un fallo del histórico no se presenta como fallo del envío.
  const { error: historyError } = await supabaseAdmin.from('order_status_history').insert({
    order_id: order.id,
    event_type: 'FACTURA_REENVIADA',
    notes: `${invoice.invoiceNumber} → ${order.customer_email}`,
    metadata: { invoice_number: invoice.invoiceNumber, email: order.customer_email },
  });
  if (historyError) {
    console.error('[admin/facturas/reenviar] Email enviado, pero no se guardó en el histórico', {
      invoiceId: id, errorCode: safeErrorCode(historyError),
    });
  }

  return NextResponse.json({ ok: true, invoiceNumber: invoice.invoiceNumber, email: order.customer_email });
}
