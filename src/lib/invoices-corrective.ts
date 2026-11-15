import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { safeErrorCode } from './safe-error-code';
import type { CorrectiveRequest } from './corrective-invoice';

// Paso 8. Emisión de una factura rectificativa desde el panel.
//
// Toda la lógica (número sin huecos en la serie R, tope, cálculo de base e
// IVA, evento en el historial) vive en la función SQL
// issue_corrective_invoice (migración 0029), en una sola transacción. Aquí
// solo se llama y se traduce el resultado. Nunca lanza.

export type CorrectiveIssueOutcome =
  | { ok: true; invoiceId: string; invoiceNumber: string; total: number; alreadyIssued: boolean }
  | { ok: false; error: string; remaining?: number };

export const CORRECTIVE_ERROR_MESSAGES: Record<string, string> = {
  PEDIDO_NO_ENCONTRADO: 'Pedido no encontrado',
  SIN_FACTURA: 'El pedido no tiene factura que rectificar',
  NADA_QUE_DEVOLVER: 'Ya se ha rectificado todo el importe de la factura',
  IMPORTE_NO_VALIDO: 'Escribe un importe válido',
  IMPORTE_SUPERA_FACTURA: 'El importe supera lo que queda por devolver de la factura',
  VARIOS_TIPOS_IVA: 'La factura tiene varios tipos de IVA: solo se puede «Devolver todo»',
  MOTIVO_NO_VALIDO: 'Escribe el motivo (máximo 300 caracteres)',
  TIPO_NO_VALIDO: 'Elige «Devolver todo» o «Devolver una parte»',
  PETICION_NO_VALIDA: 'Petición no válida. Recarga la página y vuelve a intentarlo.',
  DATOS_EMPRESA_INCOMPLETOS: 'Faltan los datos fiscales de la empresa en la configuración',
};

type RpcResult = {
  ok?: unknown;
  already_issued?: unknown;
  invoice_id?: unknown;
  invoice_number?: unknown;
  total?: unknown;
  error?: unknown;
  remaining?: unknown;
};

export async function issueCorrectiveInvoice(orderId: string, request: CorrectiveRequest): Promise<CorrectiveIssueOutcome> {
  try {
    const { data, error } = await supabaseAdmin.rpc('issue_corrective_invoice', {
      p_order_id: orderId,
      p_kind: request.kind,
      // La función acepta null para la total; el tipo generado no lo refleja.
      p_amount: request.amount as number,
      p_reason: request.reason,
      p_request_id: request.requestId,
    });
    if (error) throw error;

    const result = (data ?? {}) as RpcResult;
    if (
      result.ok === true &&
      typeof result.invoice_id === 'string' &&
      typeof result.invoice_number === 'string' &&
      typeof result.total === 'number'
    ) {
      return {
        ok: true,
        invoiceId: result.invoice_id,
        invoiceNumber: result.invoice_number,
        total: result.total,
        alreadyIssued: result.already_issued === true,
      };
    }
    if (result.ok === false && typeof result.error === 'string') {
      return typeof result.remaining === 'number'
        ? { ok: false, error: result.error, remaining: result.remaining }
        : { ok: false, error: result.error };
    }
    return { ok: false, error: 'RESPUESTA_NO_VALIDA' };
  } catch (err) {
    console.error('[facturas] No se pudo emitir la rectificativa', { orderId, errorCode: safeErrorCode(err) });
    return { ok: false, error: 'ERROR_INTERNO' };
  }
}
