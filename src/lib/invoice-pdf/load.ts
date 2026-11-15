import type { SupabaseClient } from '@supabase/supabase-js';
import { toInvoicePdfData, type InvoicePdfData, type InvoiceRow, type RectifiedInvoiceRef } from './invoice-data';

// Paso 8. Datos del PDF de cualquier factura. Para una rectificativa lee
// también el número y la fecha de la factura que rectifica.
//
// Recibe el cliente como parámetro para usarse desde la aplicación y desde
// scripts (igual que storage.ts).

export async function loadInvoicePdfData(client: Pick<SupabaseClient, 'from'>, row: InvoiceRow): Promise<InvoicePdfData> {
  if (row.invoice_type !== 'CORRECTIVE' || !row.rectifies_invoice_id) return toInvoicePdfData(row);

  const { data, error } = await client
    .from('invoices')
    .select('invoice_number, issue_date')
    .eq('id', row.rectifies_invoice_id)
    .maybeSingle<RectifiedInvoiceRef>();
  if (error) throw error;
  return toInvoicePdfData(row, data);
}
