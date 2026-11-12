import type { Tables } from '@/supabase/types';

// Paso 5. Datos del PDF, sacados SOLO de la copia guardada en la fila de la
// factura (invoices), nunca del pedido o del catálogo actuales.

export type InvoicePdfLine = {
  type: string;
  description: string;
  quantity: number;
  lineTotal: number;
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
};

export type InvoiceRow = Pick<
  Tables<'invoices'>,
  'invoice_number' | 'year' | 'issue_date' | 'operation_date' | 'issuer_legal_name' |
  'issuer_tax_id' | 'lines' | 'vat_breakdown' | 'total'
>;

export const INVOICE_PDF_COLUMNS =
  'invoice_number, year, issue_date, operation_date, issuer_legal_name, issuer_tax_id, lines, vat_breakdown, total';

function asRecordArray(value: unknown, field: string): Record<string, unknown>[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'object' || item === null)) {
    throw new Error(`Factura con ${field} no válido`);
  }
  return value as Record<string, unknown>[];
}

/** Convierte la fila guardada en los datos del PDF. Lanza si la copia está incompleta. */
export function toInvoicePdfData(row: InvoiceRow): InvoicePdfData {
  const lines = asRecordArray(row.lines, 'lines').map((line) => {
    const lineTotal = Number(line.line_total);
    const quantity = Number(line.quantity);
    if (typeof line.description !== 'string' || !Number.isSafeInteger(lineTotal) || !Number.isSafeInteger(quantity)) {
      throw new Error('Factura con una línea no válida');
    }
    return { type: String(line.type ?? ''), description: line.description, quantity, lineTotal };
  });
  if (lines.length === 0) throw new Error('Factura sin líneas');

  const vatRates = asRecordArray(row.vat_breakdown, 'vat_breakdown')
    .map((item) => Number(item.vat_rate))
    .filter((rate) => Number.isFinite(rate))
    .sort((a, b) => a - b);

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
