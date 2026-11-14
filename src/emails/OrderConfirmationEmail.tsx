import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import { EMAIL_LOGO_HEIGHT, EMAIL_LOGO_WIDTH, getEmailLogoUrl } from '@/emails/logo';
import { formatPriceFromCents } from '@/lib/format-price';
import { getOrderLegalNotices } from '@/lib/legal';
import { getPublicSiteUrl } from '@/lib/public-site-url';
import { SHIPPING_ETA_SENTENCE } from '@/lib/shipping';
import type { OrderEmailData } from '@/lib/email/send-order-notifications';

// Fase 5, Unidad 4. Plantilla de confirmacion al cliente (seccion 16 del
// MVP). Tablas simples con estilos inline - es lo que sobrevive de verdad en
// clientes de correo (Gmail, Outlook), no flexbox/grid.

export function OrderConfirmationEmail({
  data,
  invoiceAttached = false,
}: {
  data: OrderEmailData;
  /** Solo true cuando el PDF de la factura va realmente adjunto. */
  invoiceAttached?: boolean;
}) {
  const productItems = data.items.filter((item) => item.itemType === 'PRODUCT');
  const giftItems = data.items.filter((item) => item.itemType === 'GIFT');
  const itemsWithAllergens = data.items.filter(
    (item) => item.allergens && item.allergens.length > 0
  );
  const legalNotices = getOrderLegalNotices(data.termsVersion);
  const conditionsUrl = getPublicSiteUrl('/condiciones-de-contratacion');
  const shippingUrl = getPublicSiteUrl('/condiciones-de-contratacion#envios');
  const returnsUrl = getPublicSiteUrl(
    '/condiciones-de-contratacion#cambios-y-devoluciones'
  );
  const withdrawalUrl = getPublicSiteUrl(
    '/condiciones-de-contratacion#derecho-de-desistimiento'
  );
  const privacyUrl = getPublicSiteUrl('/politica-de-privacidad');

  return (
    <Html>
      <Head />
      <Preview>{`Tu pedido ${data.orderNumber} está confirmado`}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Img
            src={getEmailLogoUrl()}
            alt="El Buey Madurado"
            width={EMAIL_LOGO_WIDTH}
            height={EMAIL_LOGO_HEIGHT}
            style={styles.logo}
          />

          <Heading style={styles.h1}>¡Tu pedido está confirmado!</Heading>
          <Text style={styles.orderNumber}>Pedido {data.orderNumber}</Text>
          <Text style={styles.confirmationText}>
            Hemos recibido correctamente el pago y confirmamos tu pedido.
          </Text>
          {invoiceAttached ? (
            <Text style={styles.confirmationText}>Te adjuntamos la factura de tu compra.</Text>
          ) : null}

          <Section>
            {productItems.map((item, idx) => (
              <Row3
                key={`product-${idx}`}
                left={`${item.productName} — ${item.variantName} × ${item.quantity} · ${formatPriceFromCents(item.unitPrice)}/ud.`}
                right={formatPriceFromCents(item.lineTotal)}
              />
            ))}
            {giftItems.map((item, idx) => (
              <Row3
                key={`gift-${idx}`}
                left={`🎁 ${item.productName} — ${item.variantName} × ${item.quantity} — REGALO INCLUIDO`}
                right={formatPriceFromCents(0)}
              />
            ))}
          </Section>

          {itemsWithAllergens.length > 0 ? (
            <Section style={styles.box}>
              <Text style={styles.boxTitle}>Información de alérgenos</Text>
              {itemsWithAllergens.map((item, idx) => (
                <Text key={idx} style={styles.smallText}>
                  <strong>{item.productName}:</strong> {item.allergens?.join(', ')}
                  {item.allergensNotes ? ` — ${item.allergensNotes}` : ''}
                </Text>
              ))}
            </Section>
          ) : null}

          <Hr style={styles.hr} />

          <Row3 left="Subtotal" right={formatPriceFromCents(data.subtotal)} />
          <Row3 left="Gastos de envío" right={formatPriceFromCents(data.shippingCost)} />
          <Row3 left="Total cobrado" right={formatPriceFromCents(data.total)} bold />

          <Hr style={styles.hr} />

          <Text style={styles.boxTitle}>Tu pedido llegará a:</Text>
          <Text style={styles.smallText}>
            {data.customerName} {data.customerLastName}
            <br />
            {data.shippingStreet}
            <br />
            {data.shippingPostalCode} {data.shippingCity}, {data.shippingProvince}
            <br />
            Tel. {data.customerPhone}
          </Text>

          {data.shippingNotes ? (
            <>
              <Text style={styles.boxTitle}>Observaciones</Text>
              <Text style={styles.smallText}>{data.shippingNotes}</Text>
            </>
          ) : null}

          <Text style={styles.smallText}>{SHIPPING_ETA_SENTENCE}</Text>

          {legalNotices || data.termsVersion ? (
            <Section style={styles.legalBox}>
              {legalNotices && 'withdrawalLabel' in legalNotices ? (
                // v1.3 en adelante: resumen corto con etiquetas, sin título.
                <>
                  <Text style={styles.smallText}>
                    <strong>{legalNotices.changeCutoffLabel}</strong> {legalNotices.changeCutoff}
                  </Text>
                  <Text style={styles.smallText}>
                    <strong>{legalNotices.withdrawalLabel}</strong> {legalNotices.withdrawal}
                  </Text>
                </>
              ) : (
                <>
                  <Text style={styles.boxTitle}>
                    {legalNotices
                      ? 'Cambios, cancelaciones y desistimiento'
                      : 'Condiciones de contratación'}
                  </Text>
                  {legalNotices ? (
                    <>
                      <Text style={styles.smallText}>{legalNotices.changeCutoff}</Text>
                      <Text style={styles.smallText}>{legalNotices.withdrawal}</Text>
                    </>
                  ) : null}
                </>
              )}
              {data.termsVersion ? (
                <Text style={styles.smallText}>
                  Condiciones generales aceptadas: versión {data.termsVersion}.{' '}
                  <Link href={withdrawalUrl} style={styles.inlineLink}>
                    Consultar las condiciones completas
                  </Link>
                  .
                </Text>
              ) : null}
            </Section>
          ) : null}

          <Hr style={styles.hr} />

          <Text style={styles.smallText}>
            ¿Alguna incidencia con tu pedido? Escríbenos por{' '}
            <Link href="https://wa.me/34670775786" style={styles.inlineLink}>
              WhatsApp al +34 670 77 57 86
            </Link>{' '}
            o por correo a{' '}
            <Link
              href="mailto:elbueymaduradoxativa@gmail.com"
              style={styles.inlineLink}
            >
              elbueymaduradoxativa@gmail.com
            </Link>
            .
          </Text>

          <Hr style={styles.hr} />

          <Text style={styles.footer}>
            <Link href={conditionsUrl} style={styles.footerLink}>
              Condiciones de contratación
            </Link>
            {' · '}
            <Link href={shippingUrl} style={styles.footerLink}>
              Información de envíos
            </Link>
            {' · '}
            <Link href={returnsUrl} style={styles.footerLink}>
              Cambios y devoluciones
            </Link>
            {' · '}
            <Link href={privacyUrl} style={styles.footerLink}>
              Privacidad
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

function Row3({ left, right, bold }: { left: string; right: string; bold?: boolean }) {
  return (
    <table width="100%" cellPadding={0} cellSpacing={0} role="presentation">
      <tbody>
        <tr>
          <td style={bold ? styles.rowLeftBold : styles.rowLeft}>{left}</td>
          <td style={bold ? styles.rowRightBold : styles.rowRight}>{right}</td>
        </tr>
      </tbody>
    </table>
  );
}

const styles: Record<string, React.CSSProperties> = {
  body: { backgroundColor: '#f6f6f4', fontFamily: 'Georgia, serif', padding: '24px 0' },
  container: {
    backgroundColor: '#ffffff',
    margin: '0 auto',
    padding: '32px',
    maxWidth: '560px',
    borderRadius: '8px',
  },
  logo: { margin: '0 auto 16px', display: 'block' },
  h1: { fontSize: '22px', textAlign: 'center', color: '#1a1a1a' },
  orderNumber: { fontSize: '16px', textAlign: 'center', color: '#b45309', fontWeight: 'bold' },
  confirmationText: {
    fontSize: '13px',
    textAlign: 'center',
    color: '#3a3a3a',
    lineHeight: 1.6,
    marginBottom: '20px',
  },
  box: { backgroundColor: '#fef3e2', borderRadius: '6px', padding: '12px 16px', margin: '16px 0' },
  legalBox: {
    backgroundColor: '#fff7ed',
    border: '1px solid #fed7aa',
    borderRadius: '6px',
    padding: '12px 16px',
    margin: '16px 0',
  },
  boxTitle: { fontWeight: 'bold', fontSize: '14px', margin: '12px 0 4px' },
  smallText: { fontSize: '13px', color: '#3a3a3a', lineHeight: 1.6 },
  inlineLink: { color: '#b45309', textDecoration: 'underline' },
  footer: {
    fontSize: '12px',
    color: '#6b7280',
    lineHeight: 1.8,
    textAlign: 'center',
  },
  footerLink: { color: '#92400e', textDecoration: 'underline' },
  hr: { borderColor: '#e5e5e5', margin: '16px 0' },
  rowLeft: { fontSize: '14px', padding: '4px 0', color: '#1a1a1a' },
  rowRight: { fontSize: '14px', padding: '4px 0', textAlign: 'right', color: '#1a1a1a' },
  rowLeftBold: { fontSize: '16px', padding: '8px 0', color: '#1a1a1a', fontWeight: 'bold' },
  rowRightBold: {
    fontSize: '16px',
    padding: '8px 0',
    textAlign: 'right',
    color: '#1a1a1a',
    fontWeight: 'bold',
  },
};

export default OrderConfirmationEmail;
