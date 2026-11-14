import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mejoras del panel: estado Enviado, pedidos sin pagar (cancelar y
// recordatorio a partir de 24 h, una sola vez) y textos de los avisos.
const mocks = vi.hoisted(() => ({ authenticated: vi.fn(), from: vi.fn(), send: vi.fn(), issueInvoice: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/admin-session', () => ({ isAdminAuthenticated: mocks.authenticated }));
vi.mock('@/lib/supabase-admin', () => ({ supabaseAdmin: { from: mocks.from } }));
vi.mock('@/lib/resend', () => ({ resend: { emails: { send: mocks.send } } }));
vi.mock('@/lib/invoices-admin', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/invoices-admin')>()),
  issueInvoiceFromAdmin: mocks.issueInvoice,
}));

import { PATCH as changeStatus } from '@/app/api/admin/pedidos/[id]/estado/route';
import { POST as sendReminder } from '@/app/api/admin/pedidos/[id]/recordatorio/route';
import { availableTransitions, isUnpaidOrderStale } from '@/lib/admin/order-status';
import { sendPaidAfterCancelAlert, sendStockErrorAlert, type OrderAlertData } from '@/lib/email/send-order-alerts';

const ORDER_ID = '33333333-3333-4333-8333-333333333333';
const ctx = { params: Promise.resolve({ id: ORDER_ID }) };
const patch = (status: string) => new Request('http://localhost', {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
});
const post = () => new Request('http://localhost', { method: 'POST' });
const HOURS = 60 * 60 * 1000;
const ago = (hours: number) => new Date(Date.now() - hours * HOURS).toISOString();

type OrderState = {
  id: string; order_number: string; status: string; created_at: string;
  customer_name: string; customer_email: string; payment_reminder_sent_at: string | null;
};
let order: OrderState;
let history: Record<string, unknown>[];

// Base de datos simulada: lecturas, UPDATE condicionados por eq/is/in y
// el histórico.
function database() {
  history = [];
  mocks.from.mockImplementation((table: string) => {
    if (table === 'order_status_history') {
      return { insert: vi.fn(async (row: Record<string, unknown>) => { history.push(row); return { error: null }; }) };
    }
    if (table === 'order_items') {
      return { select: () => ({ eq: () => ({ eq: () => ({ returns: async () => ({
        data: [{ product_name_snapshot: 'Salsa Chimichurri', variant_name_snapshot: 'Tarro 200 ml', quantity: 1 }], error: null,
      }) }) }) }) };
    }
    if (table !== 'orders') throw new Error(`No debe consultar ${table}`);
    return {
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { ...order }, error: null }) }) }),
      update: (values: Partial<OrderState>) => {
        const conditions: ((o: OrderState) => boolean)[] = [];
        const run = () => {
          if (!conditions.every((check) => check(order))) return { data: null, error: null };
          Object.assign(order, values);
          return { data: { id: order.id }, error: null };
        };
        const chain = {
          eq: (column: keyof OrderState, value: unknown) => { conditions.push((o) => o[column] === value); return chain; },
          is: (column: keyof OrderState, value: null) => { conditions.push((o) => o[column] === value); return chain; },
          in: (column: keyof OrderState, values: unknown[]) => { conditions.push((o) => values.includes(o[column])); return chain; },
          select: () => ({ maybeSingle: async () => run() }),
          then: (resolve: (value: unknown) => unknown) => Promise.resolve(run()).then(resolve),
        };
        return chain;
      },
    };
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.authenticated.mockResolvedValue(true);
  mocks.send.mockResolvedValue({ data: { id: 'email-1' }, error: null });
  order = {
    id: ORDER_ID, order_number: 'BM-2026-00120', status: 'PENDING_PAYMENT', created_at: ago(25),
    customer_name: 'Ana', customer_email: 'delivered@resend.dev', payment_reminder_sent_at: null,
  };
  database();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe('reglas de estado', () => {
  it('Preparando → Enviado o Cancelado; Enviado es final', () => {
    expect(availableTransitions('PREPARING', ago(100))).toEqual(['SHIPPED', 'CANCELLED']);
    expect(availableTransitions('SHIPPED', ago(100))).toEqual([]);
  });

  it('sin pagar: solo Cancelado y solo pasadas 24 h', () => {
    for (const status of ['PENDING_PAYMENT', 'PAYMENT_FAILED']) {
      expect(availableTransitions(status, ago(23.9))).toEqual([]);
      expect(availableTransitions(status, ago(24))).toEqual(['CANCELLED']);
    }
    expect(isUnpaidOrderStale('PAID', ago(100))).toBe(false);
  });
});

describe('cambio de estado', () => {
  it('pasa de Preparando a Enviado y después ya no se puede cambiar', async () => {
    order.status = 'PREPARING';
    expect((await changeStatus(patch('SHIPPED'), ctx)).status).toBe(200);
    expect(order.status).toBe('SHIPPED');
    expect(history).toEqual([expect.objectContaining({ event_type: 'ESTADO_CAMBIADO', previous_status: 'PREPARING', new_status: 'SHIPPED' })]);
    for (const next of ['CANCELLED', 'PREPARING', 'PAID']) {
      expect((await changeStatus(patch(next), ctx)).status).toBe(409);
    }
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('un pedido sin pagar no se puede cancelar antes de 24 h', async () => {
    for (const status of ['PENDING_PAYMENT', 'PAYMENT_FAILED']) {
      order.status = status;
      order.created_at = ago(23);
      const response = await changeStatus(patch('CANCELLED'), ctx);
      expect(response.status).toBe(409);
      expect((await response.json()).error).toContain('24 horas');
      expect(order.status).toBe(status);
    }
    expect(history).toEqual([]);
  });

  it('pasadas 24 h sí se cancela', async () => {
    order.status = 'PAYMENT_FAILED';
    expect((await changeStatus(patch('CANCELLED'), ctx)).status).toBe(200);
    expect(order.status).toBe('CANCELLED');
  });

  it('no pisa un estado que ha cambiado entretanto (por ejemplo, llega el pago)', async () => {
    const originalFrom = mocks.from.getMockImplementation()!;
    mocks.from.mockImplementation((table: string) => {
      const api = originalFrom(table);
      if (table !== 'orders') return api;
      return {
        ...api,
        select: () => ({ eq: () => ({ maybeSingle: async () => {
          const snapshot = { ...order };
          order.status = 'PAID'; // el pago llega justo después de leer
          return { data: snapshot, error: null };
        } }) }),
      };
    });
    const response = await changeStatus(patch('CANCELLED'), ctx);
    expect(response.status).toBe(409);
    expect(order.status).toBe('PAID');
    expect(history).toEqual([]);
  });
});

describe('recordatorio al cliente', () => {
  it('sin sesión, 401 sin tocar nada', async () => {
    mocks.authenticated.mockResolvedValue(false);
    expect((await sendReminder(post(), ctx)).status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('envía el email corto con replyTo, marca el pedido y lo apunta', async () => {
    vi.stubEnv('EMAIL_REPLY_TO', 'elbueymaduradoxativa@gmail.com');
    expect((await sendReminder(post(), ctx)).status).toBe(200);
    const email = mocks.send.mock.calls[0][0];
    expect(email).toMatchObject({
      to: 'delivered@resend.dev',
      replyTo: 'elbueymaduradoxativa@gmail.com',
      subject: 'Tu pedido BM-2026-00120 no se llegó a completar — El Buey Madurado',
    });
    expect(email.html).toContain('Hola Ana,');
    expect(email.html).toContain('Vimos que no terminaste tu pedido. Si todavía quieres estos productos, puedes volver a hacerlo desde la');
    expect(email.html).toContain('1 × Salsa Chimichurri — Tarro 200 ml');
    expect(email.html).toContain('/tienda');
    expect(email.html).toContain('elbueymaduradoxativa@gmail.com');
    expect(order.payment_reminder_sent_at).not.toBeNull();
    expect(history).toEqual([expect.objectContaining({ event_type: 'RECORDATORIO_ENVIADO', metadata: { email: 'delivered@resend.dev' } })]);
  });

  it('solo una vez: el segundo intento se rechaza sin enviar', async () => {
    await sendReminder(post(), ctx);
    const second = await sendReminder(post(), ctx);
    expect(second.status).toBe(409);
    expect(mocks.send).toHaveBeenCalledOnce();
  });

  it('dos peticiones a la vez: solo una envía', async () => {
    const [a, b] = await Promise.all([sendReminder(post(), ctx), sendReminder(post(), ctx)]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect(mocks.send).toHaveBeenCalledOnce();
  });

  it('antes de 24 h, o si el pedido está pagado, no se envía', async () => {
    order.created_at = ago(10);
    expect((await sendReminder(post(), ctx)).status).toBe(409);
    order.created_at = ago(30);
    order.status = 'PAID';
    expect((await sendReminder(post(), ctx)).status).toBe(409);
    expect(mocks.send).not.toHaveBeenCalled();
  });

  it('si el envío falla, desmarca el pedido para poder reintentar y lo apunta', async () => {
    mocks.send.mockResolvedValueOnce({ data: null, error: { message: 'fallo' } });
    expect((await sendReminder(post(), ctx)).status).toBe(502);
    expect(order.payment_reminder_sent_at).toBeNull();
    expect(history).toEqual([expect.objectContaining({ event_type: 'RECORDATORIO_ERROR' })]);
    expect((await sendReminder(post(), ctx)).status).toBe(200);
  });
});

describe('avisos al restaurante', () => {
  const alert: OrderAlertData = {
    orderId: ORDER_ID, orderNumber: 'BM-2026-00120', customerName: 'Ana', customerLastName: 'García',
    customerEmail: 'delivered@resend.dev', customerPhone: '+34600000000', amount: 1900,
    items: [{ productName: 'Salsa Chimichurri', variantName: 'Tarro 200 ml', quantity: 1, itemType: 'PRODUCT' }],
  };

  it('error de stock: asunto, importe, productos, cliente y enlace a la ficha', async () => {
    vi.stubEnv('ADMIN_NOTIFICATION_EMAIL', 'delivered@resend.dev');
    vi.stubEnv('NEXT_PUBLIC_BASE_URL', 'https://tienda.example');
    await sendStockErrorAlert(alert);
    const email = mocks.send.mock.calls[0][0];
    expect(email.to).toBe('delivered@resend.dev');
    expect(email.subject).toBe('Pedido BM-2026-00120 cobrado pero sin stock suficiente. Revisar en el panel');
    expect(email.html).toContain('19,00');
    expect(email.html).toContain('1 × Salsa Chimichurri — Tarro 200 ml');
    expect(email.html).toContain('Ana García');
    expect(email.html).toContain(`https://tienda.example/admin/pedidos/${ORDER_ID}`);
  });

  it('pago de pedido cancelado: incluye la operación de Redsys', async () => {
    vi.stubEnv('ADMIN_NOTIFICATION_EMAIL', 'delivered@resend.dev');
    await sendPaidAfterCancelAlert(alert, { dsOrder: '26000150', authorization: 'AUT123' });
    const email = mocks.send.mock.calls[0][0];
    expect(email.subject).toContain('cancelado pero cobrado');
    expect(email.html).toContain('26000150');
    expect(email.html).toContain('AUT123');
  });

  it('sin ADMIN_NOTIFICATION_EMAIL lanza (el llamador lo apunta en el historial)', async () => {
    vi.stubEnv('ADMIN_NOTIFICATION_EMAIL', '');
    await expect(sendStockErrorAlert(alert)).rejects.toThrow('ADMIN_NOTIFICATION_EMAIL');
  });
});
