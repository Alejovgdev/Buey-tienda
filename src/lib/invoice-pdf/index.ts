import 'server-only';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { safeErrorCode } from '@/lib/safe-error-code';
import { INVOICE_PDF_COLUMNS, toInvoicePdfData, type InvoiceRow } from './invoice-data';
import { ensureInvoicePdf, type InvoicePdfFile } from './storage';

export type InvoiceAttachmentOutcome =
  | { ok: true; attachment: InvoicePdfFile; invoiceNumber: string }
  | { ok: false; error: string };

/**
 * PDF de la factura simplificada de un pedido, listo para adjuntar. Lo lee
 * de Storage o lo genera y sube. Nunca lanza: si falla, el email de
 * confirmación se envía sin adjunto.
 */
export async function prepareInvoiceAttachment(orderId: string): Promise<InvoiceAttachmentOutcome> {
  try {
    const { data, error } = await supabaseAdmin
      .from('invoices')
      .select(INVOICE_PDF_COLUMNS)
      .eq('order_id', orderId)
      .eq('invoice_type', 'SIMPLIFIED')
      .maybeSingle<InvoiceRow>();
    if (error) throw error;
    if (!data) return { ok: false, error: 'FACTURA_NO_ENCONTRADA' };

    const invoice = toInvoicePdfData(data);
    const attachment = await ensureInvoicePdf(supabaseAdmin, invoice);
    return { ok: true, attachment, invoiceNumber: invoice.invoiceNumber };
  } catch (err) {
    console.error('[facturas] No se pudo preparar el PDF de la factura', {
      orderId,
      errorCode: safeErrorCode(err),
    });
    return { ok: false, error: 'ERROR_PDF' };
  }
}
