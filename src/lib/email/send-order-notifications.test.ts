import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ send: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/resend', () => ({ resend: { emails: { send: mocks.send } } }));

import { sendCustomerConfirmationEmail, type OrderEmailData } from './send-order-notifications';

const data: OrderEmailData = {
  orderId: 'order-1', orderNumber: 'BM-2026-00001', customerName: 'Ana', customerLastName: 'García',
  customerEmail: 'delivered@resend.dev', customerPhone: '+34600000000', shippingStreet: 'Calle Mayor, 1',
  shippingCity: 'Xàtiva', shippingProvince: 'València', shippingPostalCode: '46800', shippingCountry: 'ES',
  shippingNotes: null, paidAt: '2026-11-12T10:00:00.000Z', termsVersion: '1.3',
  subtotal: 2500, shippingCost: 1000, total: 3500,
  items: [{ productName: 'Chuletón', variantName: '1 kg', unitPrice: 2500, quantity: 1, lineTotal: 2500,
    allergens: [], allergensNotes: null, itemType: 'PRODUCT' }],
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.send.mockResolvedValue({ data: { id: 'email-1' }, error: null });
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });

describe('envío de emails del pedido', () => {
  it('el email al cliente lleva remitente y "responder a" configurados', async () => {
    vi.stubEnv('EMAIL_FROM', 'El Buey Madurado <pedidos@restauranteelbueymadurado.com>');
    vi.stubEnv('EMAIL_REPLY_TO', 'elbueymaduradoxativa@gmail.com');
    await sendCustomerConfirmationEmail(data);
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({
      from: 'El Buey Madurado <pedidos@restauranteelbueymadurado.com>',
      to: 'delivered@resend.dev',
      replyTo: 'elbueymaduradoxativa@gmail.com',
    }));
  });

  it('en producción sin EMAIL_FROM no se envía nada', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('EMAIL_FROM', '');
    await expect(sendCustomerConfirmationEmail(data)).rejects.toThrow(/EMAIL_FROM/);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('en producción sin EMAIL_REPLY_TO avisa y envía igual', async () => {
    vi.stubEnv('VERCEL_ENV', 'production');
    vi.stubEnv('EMAIL_FROM', 'pedidos@restauranteelbueymadurado.com');
    vi.stubEnv('EMAIL_REPLY_TO', '');
    await sendCustomerConfirmationEmail(data);
    expect(mocks.send).toHaveBeenCalledWith(expect.objectContaining({ replyTo: undefined }));
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('EMAIL_REPLY_TO'));
  });
});
