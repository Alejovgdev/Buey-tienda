import 'server-only';
import { render } from '@react-email/components';
import { resend } from '@/lib/resend';
import { InvoiceEmail } from '@/emails/InvoiceEmail';
import type { InvoiceType } from '@/lib/invoices-admin';
import type { EmailAttachment } from './send-order-notifications';
import { resolveEmailFrom, resolveReplyTo } from './email-config';

// Paso 6. Envío de una factura suelta (reenvío desde el panel). La plantilla
// es común; cada tipo de factura solo aporta su frase. La completa (paso 7) y
// la rectificativa (paso 8) añadirán aquí la suya.
type InvoiceEmailText = (invoiceNumber: string, orderNumber: string) => string;

const INVOICE_EMAIL_TEXT: Partial<Record<InvoiceType, InvoiceEmailText>> = {
  SIMPLIFIED: (invoiceNumber, orderNumber) =>
    `Te enviamos la factura ${invoiceNumber} de tu pedido ${orderNumber}.`,
};

export type InvoiceEmailInput = {
  to: string;
  customerName: string;
  orderNumber: string;
  invoiceNumber: string;
  invoiceType: InvoiceType;
  pdf: EmailAttachment;
};

export function invoiceEmailSubject(invoiceNumber: string): string {
  return `Tu factura ${invoiceNumber} — El Buey Madurado`;
}

export function invoiceEmailMessage(type: InvoiceType, invoiceNumber: string, orderNumber: string): string {
  const text = INVOICE_EMAIL_TEXT[type];
  if (!text) throw new Error(`Email de factura no disponible para el tipo ${type}`);
  return text(invoiceNumber, orderNumber);
}

export async function sendInvoiceEmail(input: InvoiceEmailInput): Promise<void> {
  const message = invoiceEmailMessage(input.invoiceType, input.invoiceNumber, input.orderNumber);
  const html = await render(
    InvoiceEmail({ customerName: input.customerName, message, previewText: `Tu factura ${input.invoiceNumber}` })
  );
  const { error } = await resend.emails.send({
    from: resolveEmailFrom(),
    to: input.to,
    replyTo: resolveReplyTo(),
    subject: invoiceEmailSubject(input.invoiceNumber),
    html,
    attachments: [{ filename: input.pdf.filename, content: input.pdf.content, contentType: 'application/pdf' }],
  });
  if (error) {
    throw new Error(`Resend error (factura): ${error.message}`);
  }
}
