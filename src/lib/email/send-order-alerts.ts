import 'server-only';
import { render } from '@react-email/components';
import { resend } from '@/lib/resend';
import { OrderAlertEmail, type OrderAlertItem } from '@/emails/OrderAlertEmail';
import { PaymentReminderEmail, type PaymentReminderItem } from '@/emails/PaymentReminderEmail';
import { getPublicSiteUrl } from '@/lib/public-site-url';
import { formatPriceFromCents } from '@/lib/format-price';
import { resolveEmailFrom, resolveReplyTo } from './email-config';

// Avisos al restaurante sobre pedidos que necesitan revisión a mano y
// recordatorio al cliente de un pedido no terminado. Todos lanzan si Resend
// falla: el llamador decide qué apuntar en el historial.

export type OrderAlertData = {
  orderId: string;
  orderNumber: string;
  customerName: string;
  customerLastName: string;
  customerEmail: string;
  customerPhone: string;
  amount: number;
  items: OrderAlertItem[];
};

function adminNotificationEmail(): string {
  const to = process.env.ADMIN_NOTIFICATION_EMAIL?.trim();
  if (!to) throw new Error('ADMIN_NOTIFICATION_EMAIL no configurado');
  return to;
}

async function sendAlert(
  data: OrderAlertData,
  subject: string,
  heading: string,
  message: string,
  extraDetails?: { label: string; value: string }[]
): Promise<void> {
  const html = await render(
    OrderAlertEmail({
      heading,
      message,
      orderNumber: data.orderNumber,
      customerFullName: `${data.customerName} ${data.customerLastName}`.trim(),
      customerEmail: data.customerEmail,
      customerPhone: data.customerPhone,
      amount: data.amount,
      items: data.items,
      extraDetails,
      adminUrl: getPublicSiteUrl(`/admin/pedidos/${data.orderId}`),
    })
  );
  const { error } = await resend.emails.send({ from: resolveEmailFrom(), to: adminNotificationEmail(), subject, html });
  if (error) throw new Error(`Resend error (aviso interno): ${error.message}`);
}

/** Pedido cobrado que se ha quedado en «Error de stock». */
export async function sendStockErrorAlert(data: OrderAlertData): Promise<void> {
  const subject = `Pedido ${data.orderNumber} cobrado pero sin stock suficiente. Revisar en el panel`;
  await sendAlert(
    data,
    subject,
    subject,
    `El pago de ${formatPriceFromCents(data.amount)} está cobrado, pero no había stock suficiente al confirmarlo. ` +
      'El pedido está en «Error de stock» y el cliente no ha recibido el email de confirmación. ' +
      'Decide en el panel si se prepara (Revisión manual → Preparando) o se cancela y se devuelve el importe desde el TPV.'
  );
}

/** Ha llegado un pago confirmado de Redsys para un pedido ya cancelado. */
export async function sendPaidAfterCancelAlert(
  data: OrderAlertData,
  payment: { dsOrder: string; authorization: string | null }
): Promise<void> {
  const subject = `Pedido ${data.orderNumber} cancelado pero cobrado. Devolver el importe o contactar al cliente`;
  await sendAlert(
    data,
    subject,
    subject,
    'Redsys ha confirmado un pago para este pedido, pero el pedido ya estaba cancelado. El pago no se ha registrado ' +
      'en la tienda ni se ha descontado stock. Devuelve el importe desde el TPV de Redsys o contacta con el cliente.',
    [
      { label: 'Número de operación Redsys (Ds_Order)', value: payment.dsOrder },
      { label: 'Autorización', value: payment.authorization ?? '—' },
    ]
  );
}

export type PaymentReminderInput = {
  to: string;
  customerName: string;
  orderNumber: string;
  items: PaymentReminderItem[];
};

export function paymentReminderSubject(orderNumber: string): string {
  return `Tu pedido ${orderNumber} no se llegó a completar — El Buey Madurado`;
}

/** Recordatorio al cliente de un pedido no terminado. */
export async function sendPaymentReminder(input: PaymentReminderInput): Promise<void> {
  const html = await render(
    PaymentReminderEmail({ customerName: input.customerName, items: input.items, shopUrl: getPublicSiteUrl('/tienda') })
  );
  const { error } = await resend.emails.send({
    from: resolveEmailFrom(),
    to: input.to,
    replyTo: resolveReplyTo(),
    subject: paymentReminderSubject(input.orderNumber),
    html,
  });
  if (error) throw new Error(`Resend error (recordatorio): ${error.message}`);
}
