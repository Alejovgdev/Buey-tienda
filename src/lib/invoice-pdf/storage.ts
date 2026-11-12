import type { SupabaseClient } from '@supabase/supabase-js';
import { INVOICE_BUCKET, invoicePdfFileName, invoicePdfPath, type InvoicePdfData } from './invoice-data';
import { renderInvoicePdf } from './render';

// Paso 5. PDF de la factura en el almacén privado `invoices`.
//
// - Si ya existe, se descarga y se reutiliza: nunca se vuelve a generar ni se
//   sobrescribe (upload con upsert: false).
// - Si no existe, se genera desde la copia guardada y se sube.
// - Si dos procesos lo suben a la vez, gana el primero y el segundo usa el suyo.
//
// Recibe el cliente de Supabase como parámetro para poder usarse desde la
// aplicación (supabaseAdmin) y desde scripts.

export type InvoicePdfFile = { filename: string; content: Buffer; created: boolean };

type StorageClient = Pick<SupabaseClient, 'storage'>;

async function download(client: StorageClient, path: string): Promise<Buffer> {
  const { data, error } = await client.storage.from(INVOICE_BUCKET).download(path);
  if (error || !data) throw error ?? new Error('Descarga de factura vacía');
  return Buffer.from(await data.arrayBuffer());
}

async function exists(client: StorageClient, path: string): Promise<boolean> {
  // exists() devuelve data:false para 400/404 y lanza para el resto de errores.
  const { data } = await client.storage.from(INVOICE_BUCKET).exists(path);
  return data === true;
}

export async function ensureInvoicePdf(
  client: StorageClient,
  invoice: InvoicePdfData,
  render: (data: InvoicePdfData) => Promise<Buffer> = renderInvoicePdf
): Promise<InvoicePdfFile> {
  const path = invoicePdfPath(invoice);
  const filename = invoicePdfFileName(invoice.invoiceNumber);

  if (await exists(client, path)) {
    return { filename, content: await download(client, path), created: false };
  }

  const content = await render(invoice);
  const { error } = await client.storage.from(INVOICE_BUCKET).upload(path, content, {
    contentType: 'application/pdf',
    upsert: false,
  });
  if (error) {
    // Otro proceso pudo subirlo entre la comprobación y la subida.
    if (await exists(client, path)) {
      return { filename, content: await download(client, path), created: false };
    }
    throw error;
  }
  return { filename, content, created: true };
}
