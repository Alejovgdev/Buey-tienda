import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  from: vi.fn(), rpc: vi.fn(), notification: vi.fn(), customer: vi.fn(), internal: vi.fn(), invoice: vi.fn(),
  stockAlert: vi.fn(), cancelAlert: vi.fn(), previousCancelPayment: vi.fn(),
}));
vi.mock('@/lib/invoices', () => ({ issueSimplifiedInvoice: mocks.invoice }));
const invoicePdf = vi.hoisted(() => vi.fn());
vi.mock('@/lib/invoice-pdf', () => ({ prepareInvoiceAttachment: invoicePdf }));
const pdfContent = Buffer.from('%PDF-prueba');
vi.mock('@/lib/supabase-admin', () => ({ supabaseAdmin: { from: mocks.from, rpc: mocks.rpc } }));
vi.mock('@/lib/redsys', () => ({ redsys: { processRestNotification: mocks.notification } }));
vi.mock('@/lib/email/send-order-alerts', () => ({
  sendStockErrorAlert: mocks.stockAlert,
  sendPaidAfterCancelAlert: mocks.cancelAlert,
}));
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
  mocks.previousCancelPayment.mockResolvedValue({ data: [], error: null });
  updateOrder.mockResolvedValue({ data: { id: order.id }, error: null });
  update.mockReturnValue({ eq: () => ({ eq: () => ({ select: () => ({ maybeSingle: updateOrder }) }) }) });
  mocks.rpc.mockResolvedValue({ data: { ok: true, already_processed: false, paid_at: paidAt }, error: null });
  // Factura simulada con persistencia: la primera llamada la emite y las
  // siguientes la encuentran ya emitida (como issue_simplified_invoice).
  let invoiceIssued = false;
  mocks.invoice.mockImplementation(async () => {
    const alreadyIssued = invoiceIssued;
    invoiceIssued = true;
    return { ok: true, invoiceNumber: 'T2026-0001', alreadyIssued };
  });
  invoicePdf.mockResolvedValue({
    ok: true, invoiceNumber: 'T2026-0001',
    attachment: { filename: 'Factura-T2026-0001.pdf', content: pdfContent, created: true },
  });
  mocks.from.mockImplementation((table: string) => {
    if (table === 'orders') return {
      select: () => ({ eq: () => ({ maybeSingle: readOrder }) }),
      update,
    };
    if (table === 'order_items') return {
      select: () => ({ eq: () => ({ returns: readItems }) }),
    };
    if (table === 'order_status_history') return {
      insert,
      select: () => ({ eq: () => ({ eq: () => ({ eq: () => ({ limit: mocks.previousCancelPayment }) }) }) }),
    };
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
    // ...y emitio la factura en esa misma ejecucion.
    mocks.invoice.mockResolvedValue({ ok: true, invoiceNumber: 'T2026-0001', alreadyIssued: true });
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
      mocks.invoice.mockResolvedValue({ ok: true, invoiceNumber: 'T2026-0001', alreadyIssued: true });
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
    expect(mocks.customer).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ paidAt }), expect.objectContaining({ filename: 'Factura-T2026-0001.pdf' }));
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

  it('no vuelve a escribir STOCK_ERROR ni envía emails al cliente cuando la RPC ya resolvió la falta de stock', async () => {
    mocks.rpc.mockResolvedValue({ data: { ok: false, error: 'STOCK_INSUFICIENTE', paid_at: paidAt }, error: null });
    expect((await POST(request())).status).toBe(200);
    expect(update).not.toHaveBeenCalled();
    expect(insert).not.toHaveBeenCalledWith(expect.objectContaining({ event_type: 'STOCK_ERROR' }));
    expect(mocks.customer).not.toHaveBeenCalled();
    expect(mocks.internal).not.toHaveBeenCalled();
  });

  describe('aviso al restaurante por error de stock', () => {
    it('cobrado sin stock: avisa al restaurante con productos e importe y lo apunta', async () => {
      mocks.rpc.mockResolvedValue({ data: { ok: false, error: 'STOCK_INSUFICIENTE', paid_at: paidAt }, error: null });
      expect((await POST(request())).status).toBe(200);
      expect(mocks.stockAlert).toHaveBeenCalledWith(expect.objectContaining({
        orderId: 'order-1', amount: 1000,
        items: [expect.objectContaining({ quantity: 2, itemType: 'PRODUCT' }), expect.objectContaining({ quantity: 1, itemType: 'GIFT' })],
      }));
      expect(insert).toHaveBeenCalledWith({ order_id: 'order-1', event_type: 'AVISO_STOCK_ENVIADO' });
    });

    it('si el aviso falla, lo apunta en el historial y responde igual a Redsys', async () => {
      mocks.rpc.mockResolvedValue({ data: { ok: false, error: 'STOCK_INSUFICIENTE', paid_at: paidAt }, error: null });
      mocks.stockAlert.mockRejectedValue(new Error('resend caído'));
      expect((await POST(request())).status).toBe(200);
      expect(insert).toHaveBeenCalledWith(expect.objectContaining({ order_id: 'order-1', event_type: 'AVISO_STOCK_ERROR' }));
    });

    it('un aviso repetido de Redsys (sin paid_at) no vuelve a avisar', async () => {
      order.status = 'STOCK_ERROR';
      mocks.rpc.mockResolvedValue({ data: { ok: false, review_required: true, error: 'PAYMENT_RECONCILIATION_REQUIRED' }, error: null });
      expect((await POST(request())).status).toBe(200);
      expect(mocks.stockAlert).not.toHaveBeenCalled();
      expect(mocks.cancelAlert).not.toHaveBeenCalled();
      expect(insert).not.toHaveBeenCalled();
    });
  });

  describe('pago recibido de un pedido cancelado', () => {
    const cancelledPayment = () => {
      order.status = 'CANCELLED';
      mocks.notification.mockReturnValue({ Ds_Order: '26000001', Ds_Response: '0000', Ds_Amount: '1000', Ds_AuthorisationCode: 'AUT123' });
      mocks.rpc.mockResolvedValue({ data: { ok: false, review_required: true, error: 'ORDER_RECONCILIATION_REQUIRED' }, error: null });
    };

    it('queda en el historial (aviso rojo) y avisa al restaurante, sin cambiar el estado', async () => {
      cancelledPayment();
      expect((await POST(request())).status).toBe(200);
      expect(update).not.toHaveBeenCalled();
      expect(insert).toHaveBeenCalledWith({
        order_id: 'order-1', event_type: 'PAGO_TRAS_CANCELACION',
        metadata: { ds_order: '26000001', ds_response: '0000', ds_amount: '1000', ds_authorization: 'AUT123' },
      });
      expect(mocks.cancelAlert).toHaveBeenCalledWith(expect.objectContaining({ orderId: 'order-1' }), { dsOrder: '26000001', authorization: 'AUT123' });
      expect(insert).toHaveBeenCalledWith({ order_id: 'order-1', event_type: 'AVISO_PAGO_CANCELADO_ENVIADO' });
      expect(mocks.customer).not.toHaveBeenCalled();
      expect(mocks.invoice).not.toHaveBeenCalled();
    });

    it('si Redsys repite el aviso de la misma operación, no lo duplica', async () => {
      cancelledPayment();
      mocks.previousCancelPayment.mockResolvedValue({ data: [{ id: 'h-1' }], error: null });
      expect((await POST(request())).status).toBe(200);
      expect(insert).not.toHaveBeenCalled();
      expect(mocks.cancelAlert).not.toHaveBeenCalled();
    });

    it('si el aviso falla, lo apunta en el historial', async () => {
      cancelledPayment();
      mocks.cancelAlert.mockRejectedValue(new Error('resend caído'));
      expect((await POST(request())).status).toBe(200);
      expect(insert).toHaveBeenCalledWith(expect.objectContaining({ event_type: 'PAGO_TRAS_CANCELACION' }));
      expect(insert).toHaveBeenCalledWith(expect.objectContaining({ event_type: 'AVISO_PAGO_CANCELADO_ERROR' }));
    });
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

  describe('factura simplificada (paso 4)', () => {
    const events = () => insert.mock.calls.flat(2) as { event_type: string; metadata?: Record<string, unknown> }[];

    it('se emite al confirmar el pago, antes de los emails, y queda en el histórico', async () => {
      const sequence: string[] = [];
      mocks.invoice.mockImplementationOnce(async () => {
        sequence.push('factura');
        return { ok: true, invoiceNumber: 'T2026-0007', alreadyIssued: false };
      });
      mocks.customer.mockImplementationOnce(async () => { sequence.push('email'); });
      expect((await POST(request())).status).toBe(200);
      expect(mocks.invoice).toHaveBeenCalledExactlyOnceWith('order-1');
      expect(sequence).toEqual(['factura', 'email']);
      expect(events()).toContainEqual(expect.objectContaining({
        event_type: 'FACTURA_EMITIDA', metadata: { invoice_number: 'T2026-0007', reintento: false },
      }));
    });

    it('un aviso duplicado no crea otra factura ni escribe histórico', async () => {
      expect((await POST(request())).status).toBe(200);
      const writes = insert.mock.calls.length;
      mocks.rpc.mockResolvedValue({ data: { ok: true, already_processed: true }, error: null });
      expect((await POST(request())).status).toBe(200);
      expect(mocks.invoice).toHaveBeenCalledTimes(2);
      expect(insert).toHaveBeenCalledTimes(writes);
      expect(events().filter((event) => event.event_type === 'FACTURA_EMITIDA')).toHaveLength(1);
    });

    it('si la factura falla, el pago sigue confirmado, se envían los emails y queda FACTURA_ERROR', async () => {
      mocks.invoice.mockResolvedValueOnce({ ok: false, error: 'ERROR_INTERNO' });
      expect((await POST(request())).status).toBe(200);
      expect(events()).toContainEqual(expect.objectContaining({ event_type: 'PAGO_CONFIRMADO' }));
      expect(events()).toContainEqual(expect.objectContaining({
        event_type: 'FACTURA_ERROR', metadata: { error: 'ERROR_INTERNO', reintento: false },
      }));
      expect(mocks.customer).toHaveBeenCalledOnce();
      expect(mocks.internal).toHaveBeenCalledOnce();
    });

    it('un aviso repetido reintenta la factura que falló', async () => {
      mocks.invoice.mockResolvedValueOnce({ ok: false, error: 'ERROR_INTERNO' });
      expect((await POST(request())).status).toBe(200);
      mocks.invoice.mockResolvedValueOnce({ ok: true, invoiceNumber: 'T2026-0008', alreadyIssued: false });
      mocks.rpc.mockResolvedValue({ data: { ok: true, already_processed: true }, error: null });
      expect((await POST(request())).status).toBe(200);
      expect(events()).toContainEqual(expect.objectContaining({
        event_type: 'FACTURA_EMITIDA', metadata: { invoice_number: 'T2026-0008', reintento: true },
      }));
      expect(mocks.customer).toHaveBeenCalledOnce();
    });

    it('adjunta el PDF de la factura al email de confirmación (no al interno)', async () => {
      expect((await POST(request())).status).toBe(200);
      expect(invoicePdf).toHaveBeenCalledExactlyOnceWith('order-1');
      expect(mocks.customer).toHaveBeenCalledWith(expect.anything(), {
        filename: 'Factura-T2026-0001.pdf', content: pdfContent,
      });
      expect(mocks.internal).toHaveBeenCalledWith(expect.anything());
      expect(mocks.internal.mock.calls[0]).toHaveLength(1);
    });

    it('si falla el PDF, el email sale sin adjunto y queda FACTURA_PDF_ERROR', async () => {
      invoicePdf.mockResolvedValueOnce({ ok: false, error: 'ERROR_PDF' });
      expect((await POST(request())).status).toBe(200);
      expect(mocks.customer).toHaveBeenCalledWith(expect.anything(), undefined);
      expect(events()).toContainEqual(expect.objectContaining({
        event_type: 'FACTURA_PDF_ERROR', metadata: { error: 'ERROR_PDF' },
      }));
      expect(events()).toContainEqual(expect.objectContaining({ event_type: 'FACTURA_EMITIDA' }));
    });

    it('si no hay factura, no se intenta el PDF ni se apunta FACTURA_PDF_ERROR', async () => {
      mocks.invoice.mockResolvedValueOnce({ ok: false, error: 'PEDIDO_SIN_IVA' });
      expect((await POST(request())).status).toBe(200);
      expect(invoicePdf).not.toHaveBeenCalled();
      expect(mocks.customer).toHaveBeenCalledWith(expect.anything(), undefined);
      expect(events().some((event) => event.event_type === 'FACTURA_PDF_ERROR')).toBe(false);
    });

    it('un aviso duplicado no regenera el PDF ni reenvía el email', async () => {
      expect((await POST(request())).status).toBe(200);
      mocks.rpc.mockResolvedValue({ data: { ok: true, already_processed: true }, error: null });
      expect((await POST(request())).status).toBe(200);
      expect(invoicePdf).toHaveBeenCalledOnce();
      expect(mocks.customer).toHaveBeenCalledOnce();
    });

    it('no se emite factura si el pago queda pendiente de revisión o falla', async () => {
      mocks.rpc.mockResolvedValueOnce({ data: { ok: false, error: 'STOCK_INSUFICIENTE', paid_at: paidAt }, error: null });
      await POST(request());
      mocks.rpc.mockResolvedValueOnce({ data: null, error: { message: 'payment insert failed' } });
      await POST(request());
      mocks.notification.mockReturnValue({ Ds_Order: '26000001', Ds_Response: '0101', Ds_Amount: '1000' });
      await POST(request());
      expect(mocks.invoice).not.toHaveBeenCalled();
    });
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
