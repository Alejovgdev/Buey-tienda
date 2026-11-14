import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Text,
} from '@react-email/components';

// Recordatorio de pedido no terminado (Pendiente de pago o Pago fallido). Se
// envía a mano desde el panel, una sola vez por pedido. Email corto.
const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const logoUrl = cloudName
  ? `https://res.cloudinary.com/${cloudName}/image/upload/w_240/Logo-Buey_t9mc4b.png`
  : undefined;

export type PaymentReminderItem = { productName: string; variantName: string; quantity: number };

export function PaymentReminderEmail({
  customerName,
  items,
  shopUrl,
}: {
  customerName: string;
  items: PaymentReminderItem[];
  shopUrl: string;
}) {
  return (
    <Html lang="es">
      <Head />
      <Preview>Vimos que no terminaste tu pedido</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {logoUrl ? (
            <Img src={logoUrl} alt="El Buey Madurado" width="120" style={styles.logo} />
          ) : null}

          <Text style={styles.text}>{`Hola ${customerName},`}</Text>
          <Text style={styles.text}>
            Vimos que no terminaste tu pedido. Si todavía quieres estos productos, puedes volver a hacerlo desde la
            tienda.
          </Text>

          {items.map((item, index) => (
            <Text key={index} style={styles.item}>
              {`${item.quantity} × ${item.productName} — ${item.variantName}`}
            </Text>
          ))}

          <Button href={shopUrl} style={styles.button}>Ir a la tienda</Button>

          <Hr style={styles.hr} />

          <Text style={styles.smallText}>
            ¿Alguna duda? Escríbenos por{' '}
            <Link href="https://wa.me/34670775786" style={styles.inlineLink}>
              WhatsApp al +34 670 77 57 86
            </Link>{' '}
            o por correo a{' '}
            <Link href="mailto:elbueymaduradoxativa@gmail.com" style={styles.inlineLink}>
              elbueymaduradoxativa@gmail.com
            </Link>
            .
          </Text>

          <Text style={styles.footer}>El Buey Madurado</Text>
        </Container>
      </Body>
    </Html>
  );
}

const styles = {
  body: { backgroundColor: '#f4f4f4', fontFamily: 'Arial, Helvetica, sans-serif', margin: 0, padding: '24px 0' },
  container: { backgroundColor: '#ffffff', maxWidth: '560px', margin: '0 auto', padding: '32px 28px' },
  logo: { margin: '0 auto 24px', display: 'block' },
  text: { color: '#222222', fontSize: '15px', lineHeight: '22px', margin: '0 0 12px' },
  item: { color: '#222222', fontSize: '15px', lineHeight: '20px', margin: '0 0 4px', paddingLeft: '8px' },
  button: { backgroundColor: '#7a1f1f', color: '#ffffff', fontSize: '14px', fontWeight: 700, padding: '10px 18px', margin: '16px 0 0', textDecoration: 'none' },
  hr: { borderColor: '#e5e5e5', margin: '24px 0 16px' },
  smallText: { color: '#555555', fontSize: '13px', lineHeight: '20px', margin: '0 0 12px' },
  inlineLink: { color: '#7a1f1f', textDecoration: 'underline' },
  footer: { color: '#999999', fontSize: '12px', margin: '16px 0 0', textAlign: 'center' as const },
};

export default PaymentReminderEmail;
