import {
  Body,
  Container,
  Head,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Text,
} from '@react-email/components';

// Paso 6. Email corto para enviar una factura suelta desde el panel. La
// plantilla es la misma para todos los tipos de factura: solo cambia la frase
// principal (`message`), que decide send-invoice-email.ts.
const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const logoUrl = cloudName
  ? `https://res.cloudinary.com/${cloudName}/image/upload/w_240/Logo-Buey_t9mc4b.png`
  : undefined;

export function InvoiceEmail({
  customerName,
  message,
  previewText,
}: {
  customerName: string;
  message: string;
  previewText: string;
}) {
  return (
    <Html lang="es">
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={styles.body}>
        <Container style={styles.container}>
          {logoUrl ? (
            <Img src={logoUrl} alt="El Buey Madurado" width="120" style={styles.logo} />
          ) : null}

          <Text style={styles.text}>{`Hola ${customerName},`}</Text>
          <Text style={styles.text}>{message}</Text>

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
  hr: { borderColor: '#e5e5e5', margin: '20px 0' },
  smallText: { color: '#555555', fontSize: '13px', lineHeight: '20px', margin: '0 0 12px' },
  inlineLink: { color: '#7a1f1f', textDecoration: 'underline' },
  footer: { color: '#999999', fontSize: '12px', margin: '16px 0 0', textAlign: 'center' as const },
};

export default InvoiceEmail;
