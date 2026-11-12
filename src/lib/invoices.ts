import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { safeErrorCode } from './safe-error-code';

// Paso 4. Emisión de la factura simplificada de un pedido pagado.
//
// Toda la lógica (número sin huecos, copia de datos, idempotencia) vive en la
// función SQL issue_simplified_invoice (migración 0025). Aquí solo se llama y
// se traduce el resultado. Nunca lanza: un fallo de factura no puede romper la
// confirmación del pago.

export type InvoiceIssueOutcome =
  | { ok: true; invoiceNumber: string; alreadyIssued: boolean }
  | { ok: false; error: string };

type IssueInvoiceRpcResult = {
  ok?: unknown;
  already_issued?: unknown;
  invoice_number?: unknown;
  error?: unknown;
};

export async function issueSimplifiedInvoice(orderId: string): Promise<InvoiceIssueOutcome> {
  try {
    const { data, error } = await supabaseAdmin.rpc('issue_simplified_invoice', { p_order_id: orderId });
    if (error) throw error;

    const result = (data ?? {}) as IssueInvoiceRpcResult;
    if (result.ok === true && typeof result.invoice_number === 'string') {
      return {
        ok: true,
        invoiceNumber: result.invoice_number,
        alreadyIssued: result.already_issued === true,
      };
    }
    if (result.ok === false && typeof result.error === 'string') {
      return { ok: false, error: result.error };
    }
    return { ok: false, error: 'RESPUESTA_NO_VALIDA' };
  } catch (err) {
    console.error('[facturas] No se pudo emitir la factura simplificada', {
      orderId,
      errorCode: safeErrorCode(err),
    });
    return { ok: false, error: 'ERROR_INTERNO' };
  }
}
