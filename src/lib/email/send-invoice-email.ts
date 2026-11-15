import 'server-only';
import { render } from '@react-email/components';
import { resend } from '@/lib/resend';
import { InvoiceEmail } from '@/emails/InvoiceEmail';
import type { InvoiceType } from '@/lib/invoices-admin';
import type { EmailAttachment } from './send-order-notifications';
import { resolveEmailFrom, resolveReplyTo } from './email-config';

// Pasos 6 y 8. Envío de una factura suelta desde el panel. La plantilla es
// común; cada tipo de factura solo aporta su frase y su asunto. La tienda no
// emite facturas completas.
type InvoiceEmailText = (invoiceNumber: string, orderNumber: string, rectifiedInvoiceNumber: string | null) => string;

const INVOICE_EMAIL_TEXT: Partial<Record<InvoiceType, InvoiceEmailText>> = {
  SIMPLIFIED: (invoiceNumber, orderNumber) =>
    `Te enviamos la factura ${invoiceNumber} de tu pedido ${orderNumber}.`,
  CORRECTIVE: (invoiceNumber, orderNumber, rectifiedInvoiceNumber) => {
    if (!rectifiedInvoiceNumber) throw new Error('Rectificativa sin factura rectificada');
    return (
      `Te enviamos la factura rectificativa ${invoiceNumber} de tu pedido ${orderNumber}, ` +
      `que corrige la factura ${rectifiedInvoiceNumber}. ` +
      'La devolución del importe, si corresponde, se hace aparte en la tarjeta con la que pagaste.'
    );
  },
};

export type InvoiceEmailInput = {
  to: string;
  customerName: string;
  orderNumber: string;
  invoiceNumber: string;
  invoiceType: InvoiceType;
  /** Obligatorio en las rectificativas. */
  rectifiedInvoiceNumber?: string | null;
  pdf: EmailAttachment;
};

export function invoiceEmailSubject(invoiceNumber: string, type: InvoiceType = 'SIMPLIFIED'): string {
  const label = type === 'CORRECTIVE' ? 'factura rectificativa' : 'factura';
  return `Tu ${label} ${invoiceNumber} — El Buey Madurado`;
}

export function invoiceEmailMessage(
  type: InvoiceType,
  invoiceNumber: string,
  orderNumber: string,
  rectifiedInvoiceNumber: string | null = null
): string {
  const text = INVOICE_EMAIL_TEXT[type];
  if (!text) throw new Error(`Email de factura no disponible para el tipo ${type}`);
  return text(invoiceNumber, orderNumber, rectifiedInvoiceNumber);
}

export async function sendInvoiceEmail(input: InvoiceEmailInput): Promise<void> {
  const message = invoiceEmailMessage(
    input.invoiceType, input.invoiceNumber, input.orderNumber, input.rectifiedInvoiceNumber ?? null
  );
  const subject = invoiceEmailSubject(input.invoiceNumber, input.invoiceType);
  const html = await render(
    InvoiceEmail({ customerName: input.customerName, message, previewText: subject.replace(/ — .*$/, '') })
  );
  const { error } = await resend.emails.send({
    from: resolveEmailFrom(),
    to: input.to,
    replyTo: resolveReplyTo(),
    subject,
    html,
    attachments: [{ filename: input.pdf.filename, content: input.pdf.content, contentType: 'application/pdf' }],
  });
  if (error) {
    throw new Error(`Resend error (factura): ${error.message}`);
  }
}
