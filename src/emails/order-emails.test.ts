import { render } from '@react-email/components';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { InternalOrderNotificationEmail } from '@/emails/InternalOrderNotificationEmail';
import { OrderConfirmationEmail } from '@/emails/OrderConfirmationEmail';
import type { OrderEmailData } from '@/lib/email/send-order-notifications';
import { getPublicSiteUrl } from '@/lib/public-site-url';

const emailData: OrderEmailData = {
  orderId: '11111111-1111-4111-8111-111111111111',
  orderNumber: 'BM-2026-00123',
  customerName: 'Ana',
  customerLastName: 'García',
  customerEmail: 'ana@example.com',
  customerPhone: '+34670775786',
  shippingStreet: 'Calle Mayor, 1',
  shippingCity: 'Xàtiva',
  shippingProvince: 'València',
  shippingPostalCode: '46800',
  shippingCountry: 'ES',
  shippingNotes: 'Llamar al llegar',
  paidAt: '2026-08-04T10:30:00.000Z',
  termsVersion: '1.1',
  subtotal: 2500,
  shippingCost: 1000,
  total: 3500,
  items: [
    {
      productName: 'Hamburguesa madurada',
      variantName: 'Pack de 2',
      unitPrice: 1250,
      quantity: 2,
      lineTotal: 2500,
      allergens: ['leche'],
      allergensNotes: null,
      itemType: 'PRODUCT',
    },
  ],
};

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('emails del pedido', () => {
  it('incluye en la confirmación el resumen económico y la información contractual', async () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_URL', 'https://tienda.example.com/');

    const html = await render(OrderConfirmationEmail({ data: emailData }));

    expect(html).toContain('/ud.');
    expect(html).toContain('Total cobrado');
    expect(html).toContain('Condiciones generales aceptadas: versión');
    expect(html).toContain('1.1');
    expect(html).toContain('horarios de corte');
    expect(html.toLowerCase()).toContain('derecho de desistimiento');
    expect(html).toContain(
      'href="https://tienda.example.com/condiciones-de-contratacion#envios"'
    );
    expect(html).toContain(
      'href="https://tienda.example.com/condiciones-de-contratacion#cambios-y-devoluciones"'
    );
    expect(html).toContain('href="https://wa.me/34670775786"');
  });

  it('carga el logo de la confirmación desde la propia web, sin Cloudinary', async () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_URL', 'https://tienda.example.com/');

    const html = await render(OrderConfirmationEmail({ data: emailData }));

    expect(html).toContain('src="https://tienda.example.com/assets/images/logo-buey-email.png"');
    expect(html).not.toContain('cloudinary');
  });

  it('usa en el email interno la hora real del pago y un enlace absoluto al pedido', async () => {
    vi.stubEnv('NEXT_PUBLIC_BASE_URL', 'https://tienda.example.com/');
    const formattedPaidAt = new Date(emailData.paidAt).toLocaleString('es-ES', {
      timeZone: 'Europe/Madrid',
      dateStyle: 'short',
      timeStyle: 'short',
    });

    const html = await render(InternalOrderNotificationEmail({ data: emailData }));

    expect(html).toContain('Pago confirmado:');
    expect(html).toContain(formattedPaidAt);
    expect(html).toContain(
      `href="https://tienda.example.com/admin/pedidos/${emailData.orderId}"`
    );
  });

  it('no afirma una aceptación cuando el pedido no tiene versión registrada', async () => {
    const html = await render(
      OrderConfirmationEmail({
        data: { ...emailData, termsVersion: null },
      })
    );

    expect(html).not.toContain('Condiciones generales aceptadas');
    expect(html).not.toContain('horarios de corte');
  });

  it('en la versión 1.3 muestra el resumen corto con el art. 103.d', async () => {
    const html = await render(OrderConfirmationEmail({ data: { ...emailData, termsVersion: '1.3' } }));

    expect(html).toContain('<strong>Cambios y cancelaciones:</strong>');
    expect(html).toContain('puedes pedir cambios o cancelar el pedido mientras no haya entrado en preparación.');
    expect(html).toContain('<strong>Desistimiento:</strong>');
    expect(html).toContain('art. 103.d de la Ley General para la Defensa de los Consumidores y Usuarios');
    expect(html).toContain('Si hay algo incorrecto en tu pedido, escríbenos y lo solucionamos.');
    expect(html).not.toContain('Cambios, cancelaciones y desistimiento');
    expect(html).not.toContain('horarios de corte');
    expect(html).not.toContain('103.e');
    expect(html).toContain('Condiciones generales aceptadas: versión');
  });
});

describe('getPublicSiteUrl', () => {
  it('normaliza la barra final y siempre devuelve una URL absoluta', () => {
    expect(
      getPublicSiteUrl('/condiciones-de-contratacion#envios', ' https://tienda.example.com/ ')
    ).toBe('https://tienda.example.com/condiciones-de-contratacion#envios');
  });
});
