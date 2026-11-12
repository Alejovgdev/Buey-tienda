import { renderToBuffer } from '@react-pdf/renderer';
import { InvoiceDocument } from './InvoiceDocument';
import type { InvoicePdfData } from './invoice-data';

/** Genera el PDF de una factura a partir de su copia guardada. */
export async function renderInvoicePdf(data: InvoicePdfData): Promise<Buffer> {
  return renderToBuffer(<InvoiceDocument invoice={data} />);
}
