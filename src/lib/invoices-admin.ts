import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { INVOICE_PDF_COLUMNS, toInvoicePdfData, type InvoiceRow } from './invoice-pdf/invoice-data';
import { ensureInvoicePdf, type InvoicePdfFile } from './invoice-pdf/storage';
import { issueSimplifiedInvoice, type InvoiceIssueOutcome } from './invoices';
import { safeErrorCode } from './safe-error-code';
import type { Json } from '@/supabase/types';

// Paso 6. Facturas en la ficha del pedido del panel de administración.
// Solo lo usan Server Components y API Routes que ya han comprobado la
// sesión de admin.

export type InvoiceType = 'SIMPLIFIED' | 'FULL' | 'CORRECTIVE';
export type InvoiceStatus = 'EMITIDA' | 'SUSTITUIDA' | 'RECTIFICADA';

export const INVOICE_TYPE_LABELS: Record<InvoiceType, string> = {
  SIMPLIFIED: 'Simplificada',
  FULL: 'Completa',
  CORRECTIVE: 'Rectificativa',
};

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  EMITIDA: 'Emitida',
  SUSTITUIDA: 'Sustituida',
  RECTIFICADA: 'Rectificada',
};

export type OrderInvoiceSummary = {
  id: string;
  invoiceNumber: string;
  invoiceType: InvoiceType;
  status: InvoiceStatus;
  issueDate: string;
  total: number;
};

type InvoiceListRow = {
  id: string;
  invoice_number: string;
  invoice_type: string;
  status: string;
  issue_date: string;
  total: number;
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** Facturas del pedido, de la más antigua a la más reciente, con su estado calculado. */
export async function listOrderInvoices(orderId: string): Promise<OrderInvoiceSummary[]> {
  const { data, error } = await supabaseAdmin
    .from('invoices_with_status')
    .select('id, invoice_number, invoice_type, status, issue_date, total')
    .eq('order_id', orderId)
    .order('issued_at', { ascending: true })
    .returns<InvoiceListRow[]>();
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id,
    invoiceNumber: row.invoice_number,
    invoiceType: row.invoice_type as InvoiceType,
    status: row.status as InvoiceStatus,
    issueDate: row.issue_date,
    total: row.total,
  }));
}

export type AdminIssueOrigin = 'admin' | 'revision';

/**
 * Emite la simplificada desde el panel y lo apunta en el histórico:
 * FACTURA_EMITIDA si se ha creado ahora, FACTURA_ERROR si no se ha podido.
 * - 'admin': botón "Emitir factura".
 * - 'revision': al pasar un pedido de Revisión manual a Preparando.
 * Nunca lanza (issueSimplifiedInvoice tampoco).
 */
export async function issueInvoiceFromAdmin(orderId: string, origin: AdminIssueOrigin): Promise<InvoiceIssueOutcome> {
  const outcome = await issueSimplifiedInvoice(orderId);

  let event: { event_type: string; notes?: string; metadata: Json } | null = null;
  if (outcome.ok && !outcome.alreadyIssued) {
    event = {
      event_type: 'FACTURA_EMITIDA',
      notes: `${outcome.invoiceNumber} (${origin === 'admin' ? 'emitida desde el panel' : 'emitida al resolver la revisión'})`,
      metadata: { invoice_number: outcome.invoiceNumber, origen: origin },
    };
  } else if (!outcome.ok && outcome.error !== 'PEDIDO_NO_ENCONTRADO') {
    event = { event_type: 'FACTURA_ERROR', metadata: { error: outcome.error, origen: origin } };
  }

  if (event) {
    const { error } = await supabaseAdmin.from('order_status_history').insert({ order_id: orderId, ...event });
    if (error) {
      console.error('[facturas] No se guardó en el histórico', { orderId, errorCode: safeErrorCode(error) });
    }
  }
  return outcome;
}

export type InvoiceWithPdf = {
  id: string;
  orderId: string;
  invoiceType: InvoiceType;
  invoiceNumber: string;
  pdf: InvoicePdfFile;
};

type InvoiceByIdRow = InvoiceRow & { id: string; order_id: string; invoice_type: string };

/**
 * Factura por id con su PDF: lo lee de Storage o, si no está, lo genera desde
 * la copia guardada y lo sube sin sobrescribir (paso 5). null si no existe.
 */
export async function loadInvoiceWithPdf(invoiceId: string): Promise<InvoiceWithPdf | null> {
  if (!isUuid(invoiceId)) return null;

  const { data, error } = await supabaseAdmin
    .from('invoices')
    .select(`id, order_id, invoice_type, ${INVOICE_PDF_COLUMNS}`)
    .eq('id', invoiceId)
    .maybeSingle<InvoiceByIdRow>();
  if (error) throw error;
  if (!data) return null;

  const pdf = await ensureInvoicePdf(supabaseAdmin, toInvoicePdfData(data));
  return {
    id: data.id,
    orderId: data.order_id,
    invoiceType: data.invoice_type as InvoiceType,
    invoiceNumber: data.invoice_number,
    pdf,
  };
}
