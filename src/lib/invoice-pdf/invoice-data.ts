import type { Tables } from '@/supabase/types';

// Paso 5. Datos del PDF, sacados SOLO de la copia guardada en la fila de la
// factura (invoices), nunca del pedido o del catálogo actuales.

export type InvoicePdfLine = {
  type: string;
  description: string;
  quantity: number;
  lineTotal: number;
};

/** Rectificativa (paso 8): factura a la que rectifica y motivo. */
export type InvoicePdfCorrection = {
  reason: string;
  rectifiedInvoiceNumber: string;
  rectifiedIssueDate: string;  // YYYY-MM-DD
};

export type InvoicePdfData = {
  invoiceNumber: string;
  year: number;
  issueDate: string;      // YYYY-MM-DD
  operationDate: string;  // YYYY-MM-DD
  issuerLegalName: string;
  issuerTaxId: string;
  lines: InvoicePdfLine[];
  vatRates: number[];
  total: number;
  /** Solo en las rectificativas. */
  correction: InvoicePdfCorrection | null;
};

export type InvoiceRow = Pick<
  Tables<'invoices'>,
  'invoice_number' | 'year' | 'issue_date' | 'operation_date' | 'issuer_legal_name' |
  'issuer_tax_id' | 'lines' | 'vat_breakdown' | 'total'
> & Partial<Pick<Tables<'invoices'>, 'invoice_type' | 'correction_reason' | 'rectifies_invoice_id'>>;

/** Número y fecha de la factura rectificada (se lee de su propia fila, que es inmutable). */
export type RectifiedInvoiceRef = Pick<Tables<'invoices'>, 'invoice_number' | 'issue_date'>;

export const INVOICE_PDF_COLUMNS =
  'invoice_number, year, issue_date, operation_date, issuer_legal_name, issuer_tax_id, lines, vat_breakdown, total, invoice_type, correction_reason, rectifies_invoice_id';

function asRecordArray(value: unknown, field: string): Record<string, unknown>[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'object' || item === null)) {
    throw new Error(`Factura con ${field} no válido`);
  }
  return value as Record<string, unknown>[];
}

/**
 * Convierte la fila guardada en los datos del PDF. Lanza si la copia está
 * incompleta. Una rectificativa necesita además la referencia de la factura
 * que rectifica.
 */
export function toInvoicePdfData(row: InvoiceRow, rectified: RectifiedInvoiceRef | null = null): InvoicePdfData {
  const lines = asRecordArray(row.lines, 'lines').map((line) => {
    const lineTotal = Number(line.line_total);
    const quantity = Number(line.quantity);
    if (typeof line.description !== 'string' || !Number.isSafeInteger(lineTotal) || !Number.isSafeInteger(quantity)) {
      throw new Error('Factura con una línea no válida');
    }
    // Rectificativas: la línea guardada es «Devolución parcial: <motivo>», pero
    // el PDF muestra el motivo una sola vez, en su bloque. Solo cambia cómo se
    // pinta; la copia guardada no se toca.
    const description =
      line.type === 'CORRECTION' && line.description.startsWith('Devolución parcial')
        ? 'Devolución parcial'
        : line.description;
    return { type: String(line.type ?? ''), description, quantity, lineTotal };
  });
  if (lines.length === 0) throw new Error('Factura sin líneas');

  const vatRates = asRecordArray(row.vat_breakdown, 'vat_breakdown')
    .map((item) => Number(item.vat_rate))
    .filter((rate) => Number.isFinite(rate))
    .sort((a, b) => a - b);

  let correction: InvoicePdfCorrection | null = null;
  if (row.invoice_type === 'CORRECTIVE') {
    if (!row.correction_reason || !rectified) throw new Error('Rectificativa sin motivo o sin factura rectificada');
    correction = {
      reason: row.correction_reason,
      rectifiedInvoiceNumber: rectified.invoice_number,
      rectifiedIssueDate: rectified.issue_date,
    };
  }

  return {
    invoiceNumber: row.invoice_number,
    year: row.year,
    issueDate: row.issue_date,
    operationDate: row.operation_date,
    issuerLegalName: row.issuer_legal_name,
    issuerTaxId: row.issuer_tax_id,
    lines,
    vatRates,
    total: row.total,
    correction,
  };
}

export const INVOICE_BUCKET = 'invoices';

export function invoicePdfFileName(invoiceNumber: string): string {
  return `Factura-${invoiceNumber}.pdf`;
}

/** Ruta en el almacén: una carpeta por año. */
export function invoicePdfPath(data: Pick<InvoicePdfData, 'year' | 'invoiceNumber'>): string {
  return `${data.year}/${invoicePdfFileName(data.invoiceNumber)}`;
}
