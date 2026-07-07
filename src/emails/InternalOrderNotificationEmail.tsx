import { Body, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text } from '@react-email/components';
import { formatPriceFromCents } from '@/lib/format-price';
import type { OrderEmailData } from '@/lib/email/send-order-notifications';

// Fase 5, Unidad 4. Plantilla interna al restaurante (seccion 16 del MVP).
// Prioridad: que el equipo vea de un vistazo que preparar. El enlace al
// panel admin apunta a una ruta que todavia no existe (Fase 7) - no hace
// falta que resuelva, solo que quede lista para cuando exista.
export function InternalOrderNotificationEmail({ data }: { data: OrderEmailData }) {
  const now = new Date().toLocaleString('es-ES', {
    timeZone: 'Europe/Madrid',
    dateStyle: 'short',
    timeStyle: 'short',
  });
  const productItems = data.items.filter((item) => item.itemType === 'PRODUCT');
  const giftItems = data.items.filter((item) => item.itemType === 'GIFT');
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? '';

  return (
    <Html>
      <Head />
      <Preview>{`NUEVO PEDIDO #${data.orderNumber}`}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Heading style={styles.h1}>NUEVO PEDIDO #{data.orderNumber}</Heading>
          <Text style={styles.smallText}>Recibido: {now}</Text>

          <Section style={styles.box}>
            <Text style={styles.boxTitle}>Productos a preparar</Text>
            {productItems.map((item, idx) => (
              <Text key={`p-${idx}`} style={styles.productLine}>
                {item.productName} — {item.variantName} × {item.quantity}
                {item.allergens && item.allergens.length > 0
                  ? ` (Alérgenos: ${item.allergens.join(', ')})`
                  : ''}
              </Text>
            ))}
            {giftItems.map((item, idx) => (
              <Text key={`g-${idx}`} style={styles.productLine}>
                [REGALO PROMO] {item.productName} — {item.variantName} × {item.quantity}
              </Text>
            ))}
          </Section>

          {data.giftSkippedNoStock ? (
            <Section style={styles.warningBox}>
              <Text style={styles.warningText}>
                ⚠️ ACCIÓN REQUERIDA: a este cliente se le ha prometido el regalo{' '}
                {giftItems[0]?.productName ?? 'de la promoción'} en su email de confirmación, pero NO
                había stock al confirmar el pago. El cliente NO lo sabe y espera recibirlo. Hay que
                hacérselo llegar sí o sí (contactar al cliente o reponer una unidad para su envío).
              </Text>
            </Section>
          ) : null}

          <Hr style={styles.hr} />

          <Text style={styles.boxTitle}>Cliente</Text>
          <Text style={styles.smallText}>
            {data.customerName} {data.customerLastName}
            <br />
            {data.customerEmail} — Tel. {data.customerPhone}
          </Text>

          <Text style={styles.boxTitle}>Dirección de envío</Text>
          <Text style={styles.smallText}>
            {data.shippingStreet}
            <br />
            {data.shippingPostalCode} {data.shippingCity}, {data.shippingProvince}
          </Text>

          {data.shippingNotes ? (
            <>
              <Text style={styles.boxTitle}>Observaciones</Text>
              <Text style={styles.smallText}>{data.shippingNotes}</Text>
            </>
          ) : null}

          <Hr style={styles.hr} />

          <Text style={styles.total}>Total cobrado: {formatPriceFromCents(data.total)}</Text>

          <Link href={`${baseUrl}/admin/pedidos/${data.orderId}`} style={styles.link}>
            Ver pedido en el panel admin
          </Link>
        </Container>
      </Body>
    </Html>
  );
}

const styles: Record<string, React.CSSProperties> = {
  body: { backgroundColor: '#f6f6f4', fontFamily: 'Arial, sans-serif', padding: '24px 0' },
  container: {
    backgroundColor: '#ffffff',
    margin: '0 auto',
    padding: '32px',
    maxWidth: '560px',
    borderRadius: '8px',
  },
  h1: { fontSize: '20px', color: '#b91c1c' },
  box: { backgroundColor: '#fef3e2', borderRadius: '6px', padding: '12px 16px', margin: '12px 0' },
  warningBox: {
    backgroundColor: '#fee2e2',
    border: '2px solid #b91c1c',
    borderRadius: '6px',
    padding: '12px 16px',
    margin: '12px 0',
  },
  warningText: { fontSize: '14px', fontWeight: 'bold', color: '#b91c1c', margin: 0, lineHeight: 1.5 },
  boxTitle: { fontWeight: 'bold', fontSize: '14px', margin: '12px 0 4px' },
  productLine: { fontSize: '15px', fontWeight: 'bold', color: '#1a1a1a', margin: '4px 0' },
  smallText: { fontSize: '13px', color: '#3a3a3a', lineHeight: 1.6 },
  hr: { borderColor: '#e5e5e5', margin: '16px 0' },
  total: { fontSize: '16px', fontWeight: 'bold', margin: '8px 0' },
  link: { fontSize: '14px', color: '#b45309' },
};

export default InternalOrderNotificationEmail;
