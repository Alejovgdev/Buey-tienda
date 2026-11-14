import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { formatPriceFromCents } from '@/lib/format-price';

const mocks = vi.hoisted(() => ({ authenticated: vi.fn(), from: vi.fn() }));
vi.mock('@/lib/admin-session', () => ({ isAdminAuthenticated: mocks.authenticated }));
vi.mock('@/lib/supabase-admin', () => ({ supabaseAdmin: { from: mocks.from } }));
vi.mock('@/lib/admin/features', () => ({ FOOD_LABELING_ENABLED: false }));
vi.mock('@/components/Admin/AdminHeader', () => ({ default: () => null }));
vi.mock('@/components/Admin/OrderStatusControl', () => ({ default: () => null }));
vi.mock('@/components/Admin/OrderNotesForm', () => ({ default: () => null }));
vi.mock('@/components/Admin/OrderTimeline', () => ({ default: () => null }));
vi.mock('@/components/Admin/IncidentBanner', () => ({ default: () => null }));
vi.mock('@/components/Admin/OrderInvoices', () => ({ default: () => null }));
vi.mock('@/components/Admin/OrderReminder', () => ({ default: () => null }));
vi.mock('@/lib/invoices-admin', () => ({
  listOrderInvoices: async () => [], INVOICE_TYPE_LABELS: {}, INVOICE_STATUS_LABELS: {},
}));

import AdminPedidoDetailPage from '@/app/admin/pedidos/[id]/page';

type Payment = { order_id: string; amount: number; status: string };

function database({
  number = 'BM-2026-00108', status = 'PAYMENT_FAILED', total = 9500,
  payments = [] as Payment[], paymentError = false,
} = {}) {
  const order = {
    id: 'order-1', order_number: number, status, total,
    subtotal: total - 1000, shipping_cost: 1000, created_at: '2026-11-04T18:00:00Z',
    marketing_consent: null,
  };
  const paymentFilters: Record<string, unknown> = {};
  const paymentQuery = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn((key: string, value: unknown) => {
      paymentFilters[key] = value;
      return paymentQuery;
    }),
    maybeSingle: vi.fn(async () => ({
      data: paymentError ? null : payments.find((payment) =>
        Object.entries(paymentFilters).every(([key, value]) => payment[key as keyof Payment] === value)
      ) ?? null,
      error: paymentError ? { message: 'Consulta no disponible' } : null,
    })),
  };
  mocks.from.mockImplementation((table: string) => {
    if (table === 'payments') return paymentQuery;
    if (table === 'orders') return {
      select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: order }) }) }),
    };
    if (table === 'order_items' || table === 'order_status_history') {
      const query = {
        select: () => query, eq: () => query, order: () => query,
        returns: async () => ({ data: [] }),
      };
      return query;
    }
    throw new Error(`Consulta inesperada: ${table}`);
  });
  return paymentQuery;
}

async function totalsHtml() {
  const page = await AdminPedidoDetailPage({ params: Promise.resolve({ id: 'order-1' }) });
  const html = renderToStaticMarkup(page);
  return html.slice(html.indexOf('>Totales</h3>'), html.indexOf('</section>', html.indexOf('>Totales</h3>')));
}

function expectAmount(html: string, label: string, cents: number) {
  expect(html).toContain(`<span>${label}</span><span>${formatPriceFromCents(cents)}</span>`);
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authenticated.mockResolvedValue(true);
});

describe('totales del detalle administrativo', () => {
  it('BM-2026-00108: conserva 95 € de pedido y muestra 0 € cobrados sin pagos', async () => {
    const query = database();
    const html = await totalsHtml();
    expectAmount(html, 'Subtotal', 8500);
    expectAmount(html, 'Gastos de envío', 1000);
    expectAmount(html, 'Total del pedido', 9500);
    expectAmount(html, 'Total cobrado', 0);
    expect(query.eq).toHaveBeenCalledWith('order_id', 'order-1');
    expect(query.eq).toHaveBeenCalledWith('status', 'succeeded');
  });

  it('BM-2026-00107: conserva 75 € de pedido y muestra 75 € de pago confirmado', async () => {
    database({ number: 'BM-2026-00107', status: 'PAID', total: 7500,
      payments: [{ order_id: 'order-1', amount: 7500, status: 'succeeded' }],
    });
    const html = await totalsHtml();
    expectAmount(html, 'Subtotal', 6500);
    expectAmount(html, 'Gastos de envío', 1000);
    expectAmount(html, 'Total del pedido', 7500);
    expectAmount(html, 'Total cobrado', 7500);
  });

  it.each(['CANCELLED', 'STOCK_ERROR', 'NEEDS_REVIEW'])(
    'conserva el cobro acreditado aunque el estado operativo sea %s', async (status) => {
      database({ status, payments: [{ order_id: 'order-1', amount: 9500, status: 'succeeded' }] });
      expectAmount(await totalsHtml(), 'Total cobrado', 9500);
    }
  );

  it('un estado PAID sin pago confirmado no acredita ningún cobro', async () => {
    database({ status: 'PAID' });
    expectAmount(await totalsHtml(), 'Total cobrado', 0);
  });

  it('descarta intentos fallidos y pagos de otros pedidos', async () => {
    database({ payments: [
      { order_id: 'order-1', amount: 9500, status: 'failed' },
      { order_id: 'other-order', amount: 9500, status: 'succeeded' },
    ] });
    expectAmount(await totalsHtml(), 'Total cobrado', 0);
  });

  it('muestra el importe del pago aunque difiera del total contractual almacenado', async () => {
    database({ payments: [{ order_id: 'order-1', amount: 7500, status: 'succeeded' }] });
    const html = await totalsHtml();
    expectAmount(html, 'Total del pedido', 9500);
    expectAmount(html, 'Total cobrado', 7500);
  });

  it('no presenta un error de consulta como ausencia de cobro', async () => {
    database({ paymentError: true });
    const html = await totalsHtml();
    expectAmount(html, 'Total del pedido', 9500);
    expect(html).toContain('<span>Total cobrado</span><span>No disponible</span>');
  });
});
