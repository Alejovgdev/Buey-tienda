import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-session';
import { issueInvoiceFromAdmin, isUuid } from '@/lib/invoices-admin';
import { isInvoiceableStatus } from '@/lib/admin/order-status';
import { supabaseAdmin } from '@/lib/supabase-admin';

interface RouteParams {
  params: Promise<{ id: string }>;
}

const ISSUE_ERROR_MESSAGES: Record<string, string> = {
  PEDIDO_NO_ENCONTRADO: 'Pedido no encontrado',
  PEDIDO_NO_PAGADO: 'El pedido no tiene un pago confirmado por su importe',
  PEDIDO_EN_REVISION: 'El pedido está pendiente de revisión: resuélvelo antes de facturar',
  PEDIDO_SIN_IVA: 'El pedido no tiene guardado el IVA y no se puede facturar por esta vía',
  DATOS_EMPRESA_INCOMPLETOS: 'Faltan los datos fiscales de la empresa en la configuración',
  TOTALES_INCOHERENTES: 'Los totales del pedido no cuadran',
};

// Paso 6. Emisión manual de la factura simplificada de un pedido pagado que
// se quedó sin ella (FACTURA_ERROR). issue_simplified_invoice es idempotente:
// si la factura ya existe la devuelve y no crea otro número.
export async function POST(_request: Request, { params }: RouteParams) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: ISSUE_ERROR_MESSAGES.PEDIDO_NO_ENCONTRADO }, { status: 404 });
  }

  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select('id, status')
    .eq('id', id)
    .maybeSingle<{ id: string; status: string }>();
  if (orderError || !order) {
    return NextResponse.json({ error: ISSUE_ERROR_MESSAGES.PEDIDO_NO_ENCONTRADO }, { status: 404 });
  }
  // Primera barrera (la función SQL tiene la suya): no se crea ningún número
  // ni se apunta nada si el pedido no está Pagado o Preparando.
  if (!isInvoiceableStatus(order.status)) {
    return NextResponse.json(
      { error: 'Solo se puede emitir la factura de un pedido Pagado o Preparando', code: 'ESTADO_NO_FACTURABLE' },
      { status: 409 }
    );
  }

  const outcome = await issueInvoiceFromAdmin(id, 'admin');
  if (outcome.ok) {
    return NextResponse.json({ ok: true, invoiceNumber: outcome.invoiceNumber, alreadyIssued: outcome.alreadyIssued });
  }
  if (outcome.error === 'PEDIDO_NO_ENCONTRADO') {
    return NextResponse.json({ error: ISSUE_ERROR_MESSAGES.PEDIDO_NO_ENCONTRADO }, { status: 404 });
  }
  const message = ISSUE_ERROR_MESSAGES[outcome.error] ?? 'No se pudo emitir la factura';
  return NextResponse.json({ error: message, code: outcome.error }, { status: outcome.error === 'ERROR_INTERNO' ? 500 : 409 });
}
