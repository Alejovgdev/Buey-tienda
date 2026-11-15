// Paso 5. Herramienta de pruebas y reintento para el PDF de las facturas.
//
//   npx tsx --import ./scripts/lib/stub-server-only.mjs scripts/factura-pdf.tsx --local <T2026-0001> <carpeta>
//     Genera el PDF desde la copia guardada en la factura y lo escribe en <carpeta>.
//     Solo lee la base de datos; no toca Storage ni envía nada.
//
//   npx tsx --import ./scripts/lib/stub-server-only.mjs scripts/factura-pdf.tsx --reenviar <BM-2026-00001>
//     Busca el PDF en Storage o lo genera y lo sube (sin sobrescribir), y envía
//     el email «Pedido confirmado» con la factura adjunta. ESCRIBE en Storage y
//     ENVÍA un email: solo para pedidos de prueba con email delivered@resend.dev.
//     Con --para <email> el envío va a ese destinatario en lugar del guardado
//     en el pedido (que no se modifica). Solo admite APPROVED_RECIPIENTS.
//
//   npx tsx --import ./scripts/lib/stub-server-only.mjs scripts/factura-pdf.tsx --enviar <R2026-0001> [--para <email>]
//     Paso 8. Envía una factura suelta (simplificada o rectificativa) con el
//     email corto InvoiceEmail, igual que «Enviar al cliente» del panel. Busca
//     el PDF en Storage o lo genera y lo sube (sin sobrescribir). ESCRIBE en
//     Storage, ENVÍA un email y lo apunta en el historial (FACTURA_REENVIADA).
//     Mismas reglas de seguridad y de --para que --reenviar.
//
// Lee la configuración de .env.local (base de datos de pruebas).

import fs from 'node:fs';
import path from 'node:path';

process.loadEnvFile('.env.local');

const TEST_EMAIL = 'delivered@resend.dev';

// Destinatarios aprobados explícitamente para --para. Solo para ver el email
// real en una bandeja de pruebas; nunca la dirección de un cliente real. El
// email guardado en el pedido no se modifica.
const APPROVED_RECIPIENTS = new Set([TEST_EMAIL, 'alejandroinelcom@gmail.com']);

async function main() {
  const [mode, ref, folder, ...rest] = process.argv.slice(2);
  const { supabaseAdmin } = await import('@/lib/supabase-admin');
  const { INVOICE_PDF_COLUMNS, invoicePdfFileName, toInvoicePdfData } = await import('@/lib/invoice-pdf/invoice-data');
  const { loadInvoicePdfData } = await import('@/lib/invoice-pdf/load');

  // Uso: [--para <email aprobado>]
  const parseRecipient = (options: (string | undefined)[]): string | null => {
    const values = options.filter((value): value is string => value !== undefined);
    if (values.length === 0) return null;
    if (values.length !== 2 || values[0] !== '--para') throw new Error('Opciones válidas: --para <email aprobado>');
    const recipient = values[1].trim().toLowerCase();
    if (!APPROVED_RECIPIENTS.has(recipient)) {
      throw new Error(`Destinatario no aprobado: ${recipient}. Aprobados: ${[...APPROVED_RECIPIENTS].join(', ')}`);
    }
    return recipient;
  };

  if (mode === '--local' && ref && folder) {
    const { renderInvoicePdf } = await import('@/lib/invoice-pdf/render');
    const { data, error } = await supabaseAdmin.from('invoices').select(INVOICE_PDF_COLUMNS)
      .eq('invoice_number', ref).maybeSingle();
    if (error || !data) throw error ?? new Error(`No existe la factura ${ref}`);
    const pdf = await renderInvoicePdf(await loadInvoicePdfData(supabaseAdmin, data));
    fs.mkdirSync(folder, { recursive: true });
    const file = path.resolve(folder, invoicePdfFileName(ref));
    fs.writeFileSync(file, pdf);
    console.log(`PDF generado (${pdf.length} bytes): ${file}`);
    return;
  }

  if (mode === '--reenviar' && ref) {
    const recipient = parseRecipient([folder, ...rest]);

    const { ensureInvoicePdf } = await import('@/lib/invoice-pdf/storage');
    const { sendCustomerConfirmationEmail } = await import('@/lib/email/send-order-notifications');

    const { data: order, error: orderError } = await supabaseAdmin.from('orders').select('*')
      .eq('order_number', ref).maybeSingle();
    if (orderError || !order) throw orderError ?? new Error(`No existe el pedido ${ref}`);
    if (order.customer_email !== TEST_EMAIL) {
      throw new Error(`Por seguridad solo se reenvía a pedidos de prueba con email ${TEST_EMAIL}`);
    }
    if (!order.paid_at) throw new Error(`El pedido ${ref} no está pagado`);

    const { data: invoice, error: invoiceError } = await supabaseAdmin.from('invoices').select(INVOICE_PDF_COLUMNS)
      .eq('order_id', order.id).eq('invoice_type', 'SIMPLIFIED').maybeSingle();
    if (invoiceError || !invoice) throw invoiceError ?? new Error(`El pedido ${ref} no tiene factura`);

    const { data: items, error: itemsError } = await supabaseAdmin.from('order_items')
      .select('product_name_snapshot, variant_name_snapshot, unit_price_snapshot, quantity, line_total, allergens_snapshot, allergens_notes_snapshot, item_type')
      .eq('order_id', order.id);
    if (itemsError || !items) throw itemsError ?? new Error('Pedido sin líneas');

    const file = await ensureInvoicePdf(supabaseAdmin, toInvoicePdfData(invoice));
    console.log(`${file.filename}: ${file.created ? 'generado y subido a Storage' : 'ya estaba en Storage, reutilizado'} (${file.content.length} bytes)`);

    await sendCustomerConfirmationEmail({
      orderId: order.id,
      orderNumber: order.order_number,
      customerName: order.customer_name,
      customerLastName: order.customer_last_name,
      // Solo cambia el destinatario de este envío; el pedido no se modifica.
      customerEmail: recipient ?? order.customer_email,
      customerPhone: order.customer_phone,
      shippingStreet: order.shipping_street,
      shippingCity: order.shipping_city,
      shippingProvince: order.shipping_province,
      shippingPostalCode: order.shipping_postal_code,
      shippingCountry: order.shipping_country,
      shippingNotes: order.shipping_notes,
      paidAt: order.paid_at,
      termsVersion: order.terms_version,
      subtotal: order.subtotal,
      shippingCost: order.shipping_cost,
      total: order.total,
      items: items.map((item) => ({
        productName: item.product_name_snapshot,
        variantName: item.variant_name_snapshot,
        unitPrice: item.unit_price_snapshot,
        quantity: item.quantity,
        lineTotal: item.line_total,
        allergens: item.allergens_snapshot,
        allergensNotes: item.allergens_notes_snapshot,
        itemType: item.item_type === 'GIFT' ? 'GIFT' : 'PRODUCT',
      })),
    }, { filename: file.filename, content: file.content });
    console.log(`Email «Pedido confirmado» enviado a ${recipient ?? order.customer_email} con ${file.filename}`);
    return;
  }

  if (mode === '--enviar' && ref) {
    const recipient = parseRecipient([folder, ...rest]);
    const { ensureInvoicePdf } = await import('@/lib/invoice-pdf/storage');
    const { sendInvoiceEmail } = await import('@/lib/email/send-invoice-email');

    const { data: invoice, error: invoiceError } = await supabaseAdmin.from('invoices')
      .select(`order_id, ${INVOICE_PDF_COLUMNS}`).eq('invoice_number', ref).maybeSingle();
    if (invoiceError || !invoice) throw invoiceError ?? new Error(`No existe la factura ${ref}`);
    if (invoice.invoice_type !== 'SIMPLIFIED' && invoice.invoice_type !== 'CORRECTIVE') {
      throw new Error(`Tipo de factura no admitido: ${invoice.invoice_type}`);
    }

    const { data: order, error: orderError } = await supabaseAdmin.from('orders')
      .select('id, order_number, customer_name, customer_email').eq('id', invoice.order_id).maybeSingle();
    if (orderError || !order) throw orderError ?? new Error(`No existe el pedido de ${ref}`);
    if (order.customer_email !== TEST_EMAIL) {
      throw new Error(`Por seguridad solo se envía en pedidos de prueba con email ${TEST_EMAIL}`);
    }

    const pdfData = await loadInvoicePdfData(supabaseAdmin, invoice);
    const file = await ensureInvoicePdf(supabaseAdmin, pdfData);
    console.log(`${file.filename}: ${file.created ? 'generado y subido a Storage' : 'ya estaba en Storage, reutilizado'} (${file.content.length} bytes)`);

    const to = recipient ?? order.customer_email;
    await sendInvoiceEmail({
      to,
      customerName: order.customer_name,
      orderNumber: order.order_number,
      invoiceNumber: ref,
      invoiceType: invoice.invoice_type,
      rectifiedInvoiceNumber: pdfData.correction?.rectifiedInvoiceNumber ?? null,
      pdf: { filename: file.filename, content: file.content },
    });
    const { error: historyError } = await supabaseAdmin.from('order_status_history').insert({
      order_id: order.id,
      event_type: 'FACTURA_REENVIADA',
      notes: `${ref} → ${to}`,
      metadata: { invoice_number: ref, email: to, origen: 'script' },
    });
    if (historyError) console.error('Email enviado, pero no se guardó en el histórico:', historyError.message);
    console.log(`Email de la factura ${ref} enviado a ${to} con ${file.filename}`);
    return;
  }

  console.error('Uso: --local <número de factura> <carpeta> | --reenviar <número de pedido> | --enviar <número de factura>');
  process.exitCode = 1;
}

main().catch((err) => {
  console.error('Error:', err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
