import 'server-only';
import { render } from '@react-email/components';
import { resend } from '@/lib/resend';
import { OrderConfirmationEmail } from '@/emails/OrderConfirmationEmail';
import { InternalOrderNotificationEmail } from '@/emails/InternalOrderNotificationEmail';
import { resolveEmailFrom, resolveReplyTo } from './email-config';

// Fase 5, Unidad 4. Envio real con Resend + React Email. El llamador
// (handler de notificacion, Unidad 3) ya envuelve cada funcion en su propio
// try/catch - aqui basta con lanzar si Resend devuelve error, nunca hay que
// tragarselo en silencio.
export interface OrderEmailItem {
  productName: string;
  variantName: string;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  allergens: string[] | null;
  allergensNotes: string | null;
  itemType: 'PRODUCT' | 'GIFT';
}

export interface OrderEmailData {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerLastName: string;
  customerEmail: string;
  customerPhone: string;
  shippingStreet: string;
  shippingCity: string;
  shippingProvince: string;
  shippingPostalCode: string;
  shippingCountry: string;
  shippingNotes: string | null;
  paidAt: string;
  termsVersion: string | null;
  subtotal: number;
  shippingCost: number;
  total: number;
  items: OrderEmailItem[];
  // Fase 5, cierre hallazgo 3 (auditoria "final boss"). true si el pedido
  // incluia el regalo de una promocion pero se omitio al confirmar el pago
  // porque se quedo sin stock entre el checkout y la notificacion. La linea
  // GIFT sigue presente en `items` (el cliente ya la vio en el checkout y su
  // email debe ser identico al de cualquier pedido con regalo) - este flag
  // solo existe para que la plantilla interna muestre el aviso de accion
  // obligatoria; la plantilla del cliente lo ignora por completo.
  giftSkippedNoStock?: boolean;
}

const ADMIN_NOTIFICATION_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL;

/** PDF de la factura para adjuntar al email de confirmación. */
export type EmailAttachment = { filename: string; content: Buffer };

export async function sendCustomerConfirmationEmail(
  data: OrderEmailData,
  invoicePdf?: EmailAttachment
): Promise<void> {
  // La frase de la factura depende del adjunto real, no de un flag aparte.
  const html = await render(OrderConfirmationEmail({ data, invoiceAttached: Boolean(invoicePdf) }));
  const { error } = await resend.emails.send({
    from: resolveEmailFrom(),
    to: data.customerEmail,
    replyTo: resolveReplyTo(),
    subject: `Pedido confirmado — El Buey Madurado #${data.orderNumber}`,
    html,
    ...(invoicePdf
      ? { attachments: [{ filename: invoicePdf.filename, content: invoicePdf.content, contentType: 'application/pdf' }] }
      : {}),
  });
  if (error) {
    throw new Error(`Resend error (cliente): ${error.message}`);
  }
}

export async function sendInternalOrderNotification(data: OrderEmailData): Promise<void> {
  if (!ADMIN_NOTIFICATION_EMAIL) {
    throw new Error('ADMIN_NOTIFICATION_EMAIL no configurado');
  }
  const html = await render(InternalOrderNotificationEmail({ data }));
  const { error } = await resend.emails.send({
    from: resolveEmailFrom(),
    to: ADMIN_NOTIFICATION_EMAIL,
    subject: `NUEVO PEDIDO #${data.orderNumber} — El Buey Madurado`,
    html,
  });
  if (error) {
    throw new Error(`Resend error (interno): ${error.message}`);
  }
}
