import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  from: vi.fn(), rpc: vi.fn(), notification: vi.fn(), customer: vi.fn(), internal: vi.fn(),
}));
vi.mock('@/lib/supabase-admin', () => ({ supabaseAdmin: { from: mocks.from, rpc: mocks.rpc } }));
vi.mock('@/lib/redsys', () => ({ redsys: { processRestNotification: mocks.notification } }));
vi.mock('@/lib/email/send-order-notifications', () => ({
  sendCustomerConfirmationEmail: mocks.customer,
  sendInternalOrderNotification: mocks.internal,
}));

import { POST } from './route';

const paidAt = '2026-11-04T10:00:00.000Z';
const order = { id: 'order-1', status: 'PENDING_PAYMENT', total: 1000 };
const items = [
  { product_variant_id: 'product-1', quantity: 2, item_type: 'PRODUCT' },
  { product_variant_id: 'gift-1', quantity: 1, item_type: 'GIFT', promotion_id: 'promo-1' },
];
const request = () => new Request('http://localhost/api/pagos/notificacion', { method: 'POST', body: '' });
const insert = vi.fn();
const update = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  order.status = 'PENDING_PAYMENT';
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.notification.mockReturnValue({ Ds_Order: '26000001', Ds_Response: '0000', Ds_Amount: '1000' });
  insert.mockResolvedValue({ error: null });
  mocks.rpc.mockResolvedValue({ data: { ok: true, already_processed: false, paid_at: paidAt }, error: null });
  mocks.from.mockImplementation((table: string) => {
    if (table === 'orders') return {
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { ...order }, error: null }) }) }),
      update,
    };
    if (table === 'order_items') return {
      select: () => ({ eq: () => ({ returns: async () => ({ data: items, error: null }) }) }),
    };
    if (table === 'order_status_history') return { insert };
    throw new Error(`El handler no debe escribir directamente en ${table}`);
  });
});

afterEach(() => vi.restoreAllMocks());

describe('notificación Redsys (servicios simulados; concurrencia SQL en script aparte)', () => {
  for (const status of ['PAID', 'PREPARING', 'CANCELLED']) {
    it(`no repite efectos ni modifica ${status} cuando la BD confirma un duplicado`, async () => {
      order.status = status;
      mocks.rpc.mockResolvedValue({ data: { ok: true, already_processed: true }, error: null });
      expect((await POST(request())).status).toBe(200);
      expect(mocks.rpc).toHaveBeenCalledOnce();
      expect(update).not.toHaveBeenCalled();
      expect(insert).not.toHaveBeenCalled();
      expect(mocks.customer).not.toHaveBeenCalled();
      expect(mocks.internal).not.toHaveBeenCalled();
    });
  }

  it('primer pago: delega pago, stock y regalo a la RPC y usa su fecha para ambos emails', async () => {
    order.status = 'PENDING_PAYMENT';
    expect((await POST(request())).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith('decrement_stock_and_confirm_order', {
      p_order_id: 'order-1', p_redsys_ds_order: '26000001', p_redsys_ds_response: '0000',
      p_redsys_authorization: null, p_amount: 1000, p_promotion_id: 'promo-1',
      p_line_items: [
        { variant_id: 'product-1', quantity: 2, item_type: 'PRODUCT' },
        { variant_id: 'gift-1', quantity: 1, item_type: 'GIFT' },
      ],
    });
    expect(update).not.toHaveBeenCalled();
    expect(mocks.customer).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ paidAt }));
    expect(mocks.internal).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ paidAt }));
    expect(insert.mock.calls.flat(2).filter((event) => event.event_type === 'PAGO_CONFIRMADO')).toHaveLength(1);
  });

  it('deja la omisión del regalo a la RPC y avisa al correo interno simulado', async () => {
    mocks.rpc.mockResolvedValue({ data: { ok: true, paid_at: paidAt, gift_skipped_no_stock: true }, error: null });
    await POST(request());
    expect(mocks.internal).toHaveBeenCalledWith(expect.objectContaining({ giftSkippedNoStock: true }));
  });

  it('un importe incoherente en PREPARING pasa por la protección atómica sin UPDATE desde JS', async () => {
    order.status = 'PREPARING';
    mocks.notification.mockReturnValue({ Ds_Order: '26000001', Ds_Response: '0000', Ds_Amount: '999' });
    mocks.rpc.mockResolvedValue({ data: { ok: false, review_required: true, error: 'PAYMENT_RECONCILIATION_REQUIRED' }, error: null });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.rpc).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ p_amount: 999 }));
    expect(update).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalled();
    expect(mocks.customer).not.toHaveBeenCalled();
  });

  it('no vuelve a escribir STOCK_ERROR ni envía emails cuando la RPC ya resolvió la falta de stock', async () => {
    mocks.rpc.mockResolvedValue({ data: { ok: false, error: 'STOCK_INSUFICIENTE', paid_at: paidAt }, error: null });
    expect((await POST(request())).status).toBe(200);
    expect(update).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
    expect(mocks.customer).not.toHaveBeenCalled();
  });

  it('un fallo transaccional devuelve 500 sin histórico ni emails de confirmación', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { message: 'payment insert failed' } });
    expect((await POST(request())).status).toBe(500);
    expect(insert).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(mocks.customer).not.toHaveBeenCalled();
    expect(mocks.internal).not.toHaveBeenCalled();
  });

  it('firma inválida: no accede a BD', async () => {
    mocks.notification.mockImplementation(() => { throw new Error('invalid signature'); });
    expect((await POST(request())).status).toBe(400);
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('respuesta denegada: no llama a la RPC de cobro', async () => {
    order.status = 'PREPARING';
    mocks.notification.mockReturnValue({ Ds_Order: '26000001', Ds_Response: '0101', Ds_Amount: '1000' });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(mocks.customer).not.toHaveBeenCalled();
  });
});
