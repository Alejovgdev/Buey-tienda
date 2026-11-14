import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-session';
import { loadInvoiceWithPdf } from '@/lib/invoices-admin';
import { safeErrorCode } from '@/lib/safe-error-code';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Paso 6. Descarga del PDF de una factura. /api/admin/* no está cubierto por
// el middleware: la sesión se comprueba aquí antes de tocar nada. El almacén
// es privado, así que el PDF nunca tiene URL pública: lo sirve esta respuesta.
export async function GET(_request: Request, { params }: RouteParams) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { id } = await params;
  try {
    const invoice = await loadInvoiceWithPdf(id);
    if (!invoice) {
      return NextResponse.json({ error: 'Factura no encontrada' }, { status: 404 });
    }

    return new Response(new Uint8Array(invoice.pdf.content), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${invoice.pdf.filename}"`,
        'Cache-Control': 'private, no-store',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch (err) {
    console.error('[admin/facturas/pdf] No se pudo obtener el PDF', { invoiceId: id, errorCode: safeErrorCode(err) });
    return NextResponse.json({ error: 'No se pudo obtener el PDF de la factura' }, { status: 500 });
  }
}
