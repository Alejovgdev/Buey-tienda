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
const readOrder = vi.fn();
const readItems = vi.fn();
const updateOrder = vi.fn();

beforeEach(() => {
  vi.resetAllMocks();
  order.status = 'PENDING_PAYMENT';
  vi.spyOn(console, 'error').mockImplementation(() => {});
  mocks.notification.mockReturnValue({ Ds_Order: '26000001', Ds_Response: '0000', Ds_Amount: '1000' });
  insert.mockResolvedValue({ error: null });
  readOrder.mockImplementation(async () => ({ data: { ...order }, error: null }));
  readItems.mockResolvedValue({ data: items, error: null });
  updateOrder.mockResolvedValue({ data: { id: order.id }, error: null });
  update.mockReturnValue({ eq: () => ({ eq: () => ({ select: () => ({ maybeSingle: updateOrder }) }) }) });
  mocks.rpc.mockResolvedValue({ data: { ok: true, already_processed: false, paid_at: paidAt }, error: null });
  mocks.from.mockImplementation((table: string) => {
    if (table === 'orders') return {
      select: () => ({ eq: () => ({ maybeSingle: readOrder }) }),
      update,
    };
    if (table === 'order_items') return {
      select: () => ({ eq: () => ({ returns: readItems }) }),
    };
    if (table === 'order_status_history') return { insert };
    throw new Error(`El handler no debe escribir directamente en ${table}`);
  });
});

afterEach(() => vi.restoreAllMocks());

describe('notificación Redsys (servicios simulados; concurrencia SQL en script aparte)', () => {
  it('un error al consultar el pedido no confirma el pago como procesado', async () => {
    readOrder.mockResolvedValue({ data: null, error: { code: '08006', message: 'database unavailable' } });
    expect((await POST(request())).status).toBe(500);
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect(mocks.customer).not.toHaveBeenCalled();
    expect(mocks.internal).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      stage: 'order_lookup', dsOrder: '26000001', dsResponse: '0000', dsAmount: '1000',
    }));
  });

  it('distingue un pedido inexistente de un fallo de consulta', async () => {
    readOrder.mockResolvedValue({ data: null, error: null });
    const response = await POST(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: false, review_required: true });
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
      stage: 'order_missing', dsOrder: '26000001',
    }));
  });

  for (const failure of ['consulta', 'RPC']) {
    it(`recupera el mismo pago tras fallo de ${failure} y no repite efectos al duplicarlo`, async () => {
      // Servicio de BD simulado con persistencia entre notificaciones.
      const state = { payments: 0, productStock: 10, giftStock: 5, redemptions: 0 };
      mocks.rpc.mockImplementation(async () => {
        if (state.payments) return { data: { ok: true, already_processed: true }, error: null };
        state.payments++;
        state.productStock -= 2;
        state.giftStock--;
        state.redemptions++;
        order.status = 'PAID';
        return { data: { ok: true, paid_at: paidAt, promotion_consumed: true }, error: null };
      });
      if (failure === 'consulta') {
        readOrder.mockResolvedValueOnce({ data: null, error: { message: 'database unavailable' } });
      } else {
        mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: 'transaction rolled back' } });
      }
      expect((await POST(request())).status).toBe(500);
      expect(state).toEqual({ payments: 0, productStock: 10, giftStock: 5, redemptions: 0 });
      expect(insert).not.toHaveBeenCalled();
      expect(mocks.customer).not.toHaveBeenCalled();
      expect(mocks.internal).not.toHaveBeenCalled();

      expect((await POST(request())).status).toBe(200);
      expect(state).toEqual({ payments: 1, productStock: 8, giftStock: 4, redemptions: 1 });
      const historyWrites = insert.mock.calls.length;
      order.status = 'PREPARING';
      expect((await POST(request())).status).toBe(200);
      expect(state).toEqual({ payments: 1, productStock: 8, giftStock: 4, redemptions: 1 });
      expect(order.status).toBe('PREPARING');
      expect(update).not.toHaveBeenCalled();
      expect(insert).toHaveBeenCalledTimes(historyWrites);
      expect(mocks.customer).toHaveBeenCalledOnce();
      expect(mocks.internal).toHaveBeenCalledOnce();
      for (const [, args] of mocks.rpc.mock.calls) {
        expect(args).toMatchObject({
          p_order_id: 'order-1', p_redsys_ds_order: '26000001', p_amount: 1000,
          p_line_items: [
            { variant_id: 'product-1', quantity: 2, item_type: 'PRODUCT' },
            { variant_id: 'gift-1', quantity: 1, item_type: 'GIFT' },
          ],
          p_promotion_id: 'promo-1',
        });
      }
    });
  }

  it('una respuesta perdida tras el commit se recupera por la barrera de T1 sin emails', async () => {
    mocks.rpc.mockRejectedValueOnce(new Error('connection lost after commit'));
    expect((await POST(request())).status).toBe(500);
    // La BD confirmo, aunque el handler no recibio la respuesta.
    order.status = 'PREPARING';
    mocks.rpc.mockResolvedValue({ data: { ok: true, already_processed: true }, error: null });
    expect((await POST(request())).status).toBe(200);
    expect(update).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalled();
    expect(mocks.customer).not.toHaveBeenCalled();
    expect(mocks.internal).not.toHaveBeenCalled();
  });

  for (const query of ['pedido', 'lineas']) {
    it(`registra tambien excepciones de transporte al consultar ${query}`, async () => {
      (query === 'pedido' ? readOrder : readItems).mockRejectedValueOnce(new Error('network unavailable'));
      expect((await POST(request())).status).toBe(500);
      expect(mocks.rpc).not.toHaveBeenCalled();
      expect(insert).not.toHaveBeenCalled();
      expect(mocks.customer).not.toHaveBeenCalled();
      expect(mocks.internal).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
        stage: 'unexpected', dsOrder: '26000001',
      }));
    });
  }

  for (const result of [
    { data: null, error: { message: 'line query failed' } },
    { data: [], error: null },
  ]) {
    it(`no procesa un pago sin lineas verificadas (${result.error ? 'error' : 'vacias'})`, async () => {
      readItems.mockResolvedValueOnce(result);
      expect((await POST(request())).status).toBe(500);
      expect(mocks.rpc).not.toHaveBeenCalled();
      expect(mocks.customer).not.toHaveBeenCalled();
    });
  }

  for (const data of [null, {}, { ok: true }, { ok: false, error: 'unknown' }, { ok: false, already_processed: true }]) {
    it(`no acusa como procesada una RPC sin confirmacion valida (${JSON.stringify(data)})`, async () => {
      mocks.rpc.mockResolvedValueOnce({ data, error: null });
      expect((await POST(request())).status).toBe(500);
      expect(insert).not.toHaveBeenCalled();
      expect(mocks.customer).not.toHaveBeenCalled();
      expect(mocks.internal).not.toHaveBeenCalled();
    });
  }

  it('comprueba el UPDATE de rechazo antes de registrar PAYMENT_FAILED', async () => {
    mocks.notification.mockReturnValue({ Ds_Order: '26000001', Ds_Response: '0101', Ds_Amount: '1000' });
    updateOrder.mockResolvedValueOnce({ data: null, error: { message: 'update unavailable' } });
    expect((await POST(request())).status).toBe(500);
    expect(insert).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ stage: 'rejection_update' }));
  });

  it('no inventa una transicion de rechazo si el estado avanzo durante el UPDATE', async () => {
    mocks.notification.mockReturnValue({ Ds_Order: '26000001', Ds_Response: '0101', Ds_Amount: '1000' });
    updateOrder.mockResolvedValueOnce({ data: null, error: null });
    expect((await POST(request())).status).toBe(200);
    expect(insert).not.toHaveBeenCalled();
  });

  it('registra el fallo de escritura del historico de rechazo y devuelve error', async () => {
    mocks.notification.mockReturnValue({ Ds_Order: '26000001', Ds_Response: '0101', Ds_Amount: '1000' });
    insert.mockResolvedValueOnce({ error: { message: 'history unavailable' } });
    expect((await POST(request())).status).toBe(500);
    expect(mocks.customer).not.toHaveBeenCalled();
    expect(console.error).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ stage: 'history_insert' }));
  });

  it('un fallo del historico auxiliar no deshace el pago ni provoca reenvios al duplicarlo', async () => {
    insert.mockResolvedValue({ error: { message: 'history unavailable' } });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.customer).toHaveBeenCalledOnce();
    expect(mocks.internal).toHaveBeenCalledOnce();
    expect(console.error).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ stage: 'history_insert' }));
    mocks.rpc.mockResolvedValue({ data: { ok: true, already_processed: true }, error: null });
    expect((await POST(request())).status).toBe(200);
    expect(mocks.customer).toHaveBeenCalledOnce();
    expect(mocks.internal).toHaveBeenCalledOnce();
  });

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

  it('conserva el código de BD sin registrar mensajes, detalles o credenciales del proveedor', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: {
      code: '08006', message: 'private-test-sentinel', details: 'Authorization: Bearer private-test-sentinel',
    } });
    const response = await POST(request());
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain('private-test-sentinel');
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('private-test-sentinel');
    expect(console.error).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ errorCode: '08006', stage: 'payment_rpc' }));
  });

  it('no guarda ni registra el mensaje privado de errores de correo', async () => {
    mocks.customer.mockRejectedValue(new Error('private-test-sentinel'));
    mocks.internal.mockRejectedValue(new Error('private-test-sentinel'));
    expect((await POST(request())).status).toBe(200);
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('private-test-sentinel');
    expect(JSON.stringify(insert.mock.calls)).not.toContain('private-test-sentinel');
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ event_type: 'EMAIL_CLIENTE_ERROR' }));
    expect(insert).toHaveBeenCalledWith(expect.objectContaining({ event_type: 'EMAIL_INTERNO_ERROR' }));
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
