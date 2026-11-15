import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-session';
import { isUuid } from '@/lib/invoices-admin';
import { parseCorrectiveRequest } from '@/lib/corrective-invoice';
import { CORRECTIVE_ERROR_MESSAGES, issueCorrectiveInvoice } from '@/lib/invoices-corrective';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Paso 8. Emisión de una factura rectificativa (serie R) desde la ficha del
// pedido. No devuelve el dinero: la devolución se hace a mano en el TPV de
// Redsys. El mismo requestId devuelve la misma factura (doble clic).
export async function POST(request: Request, { params }: RouteParams) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: CORRECTIVE_ERROR_MESSAGES.PEDIDO_NO_ENCONTRADO }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = parseCorrectiveRequest(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const outcome = await issueCorrectiveInvoice(id, parsed.value);
  if (outcome.ok) {
    return NextResponse.json({
      ok: true,
      invoiceId: outcome.invoiceId,
      invoiceNumber: outcome.invoiceNumber,
      total: outcome.total,
      alreadyIssued: outcome.alreadyIssued,
    });
  }
  if (outcome.error === 'PEDIDO_NO_ENCONTRADO') {
    return NextResponse.json({ error: CORRECTIVE_ERROR_MESSAGES.PEDIDO_NO_ENCONTRADO }, { status: 404 });
  }
  const message = CORRECTIVE_ERROR_MESSAGES[outcome.error] ?? 'No se pudo emitir la factura rectificativa';
  const status = outcome.error === 'ERROR_INTERNO' || outcome.error === 'RESPUESTA_NO_VALIDA' ? 500 : 409;
  return NextResponse.json({ error: message, code: outcome.error, remaining: outcome.remaining }, { status });
}
