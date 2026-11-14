import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from '@react-email/components';
import { formatPriceFromCents } from '@/lib/format-price';

// Aviso interno al restaurante sobre un pedido que necesita revisión a mano
// (cobrado sin stock, o cobrado estando cancelado). Misma plantilla para los
// dos casos: cambian el título, el texto y los datos extra.

export type OrderAlertItem = { productName: string; variantName: string; quantity: number; itemType: string };

export type OrderAlertEmailProps = {
  heading: string;
  message: string;
  orderNumber: string;
  customerFullName: string;
  customerEmail: string;
  customerPhone: string;
  amount: number;
  items: OrderAlertItem[];
  extraDetails?: { label: string; value: string }[];
  adminUrl: string;
};

export function OrderAlertEmail(props: OrderAlertEmailProps) {
  return (
    <Html lang="es">
      <Head />
      <Preview>{props.heading}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          <Text style={styles.badge}>REVISIÓN MANUAL</Text>
          <Heading as="h1" style={styles.heading}>{props.heading}</Heading>
          <Text style={styles.text}>{props.message}</Text>

          <Section style={styles.box}>
            <Text style={styles.label}>Pedido</Text>
            <Text style={styles.value}>{props.orderNumber}</Text>
            <Text style={styles.label}>Importe cobrado</Text>
            <Text style={styles.value}>{formatPriceFromCents(props.amount)}</Text>
            <Text style={styles.label}>Cliente</Text>
            <Text style={styles.value}>
              {`${props.customerFullName} · ${props.customerEmail} · ${props.customerPhone}`}
            </Text>
            {(props.extraDetails ?? []).map((detail) => (
              <div key={detail.label}>
                <Text style={styles.label}>{detail.label}</Text>
                <Text style={styles.value}>{detail.value}</Text>
              </div>
            ))}
          </Section>

          <Text style={styles.label}>Productos</Text>
          {props.items.map((item, index) => (
            <Text key={index} style={styles.item}>
              {`${item.quantity} × ${item.productName} — ${item.variantName}${item.itemType === 'GIFT' ? ' (regalo)' : ''}`}
            </Text>
          ))}

          <Hr style={styles.hr} />
          <Button href={props.adminUrl} style={styles.button}>Abrir la ficha del pedido</Button>
          <Text style={styles.small}>{props.adminUrl}</Text>
        </Container>
      </Body>
    </Html>
  );
}

const styles = {
  body: { backgroundColor: '#f4f4f4', fontFamily: 'Arial, Helvetica, sans-serif', margin: 0, padding: '24px 0' },
  container: { backgroundColor: '#ffffff', maxWidth: '600px', margin: '0 auto', padding: '28px' },
  badge: { display: 'inline-block', backgroundColor: '#b91c1c', color: '#ffffff', fontSize: '12px', fontWeight: 700, padding: '4px 8px', margin: '0 0 12px' },
  heading: { color: '#111111', fontSize: '20px', lineHeight: '26px', margin: '0 0 12px' },
  text: { color: '#222222', fontSize: '15px', lineHeight: '22px', margin: '0 0 16px' },
  box: { backgroundColor: '#fef2f2', border: '1px solid #fecaca', padding: '12px 16px', margin: '0 0 16px' },
  label: { color: '#666666', fontSize: '12px', textTransform: 'uppercase' as const, margin: '8px 0 2px' },
  value: { color: '#111111', fontSize: '15px', fontWeight: 700, margin: '0 0 4px' },
  item: { color: '#222222', fontSize: '15px', margin: '2px 0' },
  hr: { borderColor: '#e5e5e5', margin: '20px 0' },
  button: { backgroundColor: '#111111', color: '#ffffff', fontSize: '14px', fontWeight: 700, padding: '10px 16px', textDecoration: 'none' },
  small: { color: '#888888', fontSize: '12px', margin: '8px 0 0', wordBreak: 'break-all' as const },
};

export default OrderAlertEmail;
