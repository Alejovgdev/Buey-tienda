import { Body, Container, Head, Heading, Hr, Html, Img, Preview, Section, Text } from '@react-email/components';
import { formatPriceFromCents } from '@/lib/format-price';
import type { OrderEmailData } from '@/lib/email/send-order-notifications';

// Fase 5, Unidad 4. Plantilla de confirmacion al cliente (seccion 16 del
// MVP). Tablas simples con estilos inline - es lo que sobrevive de verdad en
// clientes de correo (Gmail, Outlook), no flexbox/grid.
const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const logoUrl = cloudName
  ? `https://res.cloudinary.com/${cloudName}/image/upload/w_240/Logo-Buey_t9mc4b.png`
  : undefined;

export function OrderConfirmationEmail({ data }: { data: OrderEmailData }) {
  const productItems = data.items.filter((item) => item.itemType === 'PRODUCT');
  const giftItems = data.items.filter((item) => item.itemType === 'GIFT');
  const itemsWithAllergens = data.items.filter(
    (item) => item.allergens && item.allergens.length > 0
  );

  return (
    <Html>
      <Head />
      <Preview>{`Tu pedido ${data.orderNumber} está confirmado`}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {logoUrl ? (
            <Img src={logoUrl} alt="El Buey Madurado" width="120" style={styles.logo} />
          ) : null}

          <Heading style={styles.h1}>¡Tu pedido está confirmado!</Heading>
          <Text style={styles.orderNumber}>Pedido {data.orderNumber}</Text>

          <Section>
            {productItems.map((item, idx) => (
              <Row3
                key={`product-${idx}`}
                left={`${item.productName} — ${item.variantName} × ${item.quantity}`}
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
          <Row3 left="TOTAL" right={formatPriceFromCents(data.total)} bold />

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

          <Text style={styles.smallText}>
            Tiempo estimado de entrega: 24–48 horas laborables desde la confirmación del pago.
          </Text>

          <Hr style={styles.hr} />

          <Text style={styles.smallText}>
            ¿Alguna incidencia con tu pedido? Escríbenos a{' '}
            <a href="mailto:elbueymaduradoxativa@gmail.com">elbueymaduradoxativa@gmail.com</a> o
            llámanos al +34 670 77 57 86.
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
  box: { backgroundColor: '#fef3e2', borderRadius: '6px', padding: '12px 16px', margin: '16px 0' },
  boxTitle: { fontWeight: 'bold', fontSize: '14px', margin: '12px 0 4px' },
  smallText: { fontSize: '13px', color: '#3a3a3a', lineHeight: 1.6 },
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
