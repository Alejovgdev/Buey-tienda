import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn(), settings: vi.fn(), redirect: vi.fn(), orderNumber: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/supabase-admin', () => ({ supabaseAdmin: { from: mocks.from, rpc: mocks.rpc } }));
vi.mock('@/lib/shop-settings', () => ({ getShopSettings: mocks.settings }));
vi.mock('@/lib/redsys', () => ({ redsys: { createRedirectForm: mocks.redirect } }));
vi.mock('@/lib/order-number', () => ({ generateOrderNumber: mocks.orderNumber }));

import { POST as review } from './review/route';
import { POST as pay } from './create-session/route';

const variantId = '33333333-3333-4333-8333-333333333333';
const productId = '22222222-2222-4222-8222-222222222222';
const line = { variantId, productSlug: 'chuleton', quantity: 2, expectedUnitPrice: 2500 };
const customer = {
  customerName: 'Ana', customerLastName: 'García', customerEmail: 'ana@example.invalid',
  customerPhone: '+34670775786', shippingStreet: 'Calle Mayor, 1', shippingCity: 'Xàtiva',
  shippingProvince: 'València', shippingPostalCode: '46800', acceptTerms: true,
};
const baseVariant = {
  id: variantId, product_id: productId, name: '1 kg', price: 2500, stock: 8, is_active: true,
  product: { id: productId, slug: 'chuleton', name: 'Chuletón', is_active: true, allergens: [], label_profile_id: null },
};
let variant: typeof baseVariant | null;
let promotions: { id: string; min_subtotal: null; max_redemptions: null; current_redemptions: number; gift_variant_id: string }[];
let gift: typeof baseVariant;
const insertOrder = vi.fn(), insertItems = vi.fn(), history = vi.fn(), readVariants = vi.fn();
const request = (body: unknown) => new Request('http://localhost/api/checkout/test', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});
const reviewRequest = (items = [line]) => request({ items });
const payRequest = (overrides = {}) => request({ customer, items: [line], expectedTotal: 6000, ...overrides });
const noPayment = () => {
  expect(insertOrder).not.toHaveBeenCalled();
  expect(insertItems).not.toHaveBeenCalled();
  expect(mocks.redirect).not.toHaveBeenCalled();
  expect(mocks.rpc).not.toHaveBeenCalled();
};

beforeEach(() => {
  vi.resetAllMocks();
  vi.stubEnv('ADMIN_JWT_SECRET', 'clave-local-solo-para-pruebas-de-checkout');
  vi.spyOn(console, 'error').mockImplementation(() => {});
  variant = structuredClone(baseVariant);
  promotions = [];
  gift = { ...structuredClone(baseVariant), id: '44444444-4444-4444-8444-444444444444', name: 'Regalo' };
  mocks.settings.mockResolvedValue({ acceptingOrders: true, noticeMessage: null, checkoutDisabledMessage: null });
  readVariants.mockImplementation(async () => ({ data: variant ? [variant] : [], error: null }));
  insertOrder.mockReturnValue({ select: () => ({ single: async () => ({ data: { id: 'order-1', order_number: 'BM-LOCAL' }, error: null }) }) });
  insertItems.mockResolvedValue({ error: null });
  history.mockResolvedValue({ error: null });
  mocks.orderNumber.mockResolvedValue('BM-LOCAL');
  mocks.rpc.mockResolvedValue({ data: '26000001', error: null });
  mocks.redirect.mockReturnValue({ url: 'https://bank.example.invalid', body: {} });
  mocks.from.mockImplementation((table: string) => {
    if (table === 'product_variants') return { select: () => ({ in: readVariants, eq: () => ({ maybeSingle: async () => ({ data: gift, error: null }) }) }) };
    if (table === 'promotions') {
      const query = { select: () => query, eq: () => query, or: () => query, order: () => query, limit: async () => ({ data: promotions, error: null }) };
      return query;
    }
    if (table === 'orders') return { insert: insertOrder };
    if (table === 'order_items') return { insert: insertItems };
    if (table === 'order_status_history') return { insert: history };
    throw new Error(`No debe acceder a ${table}`);
  });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllEnvs(); });

describe('disponibilidad previa al pago, sin servicios reales', () => {
  it('relee precio, stock y apertura en cada revisión, sin crear pedidos ni reservar stock', async () => {
    const first = await review(reviewRequest());
    expect(first.headers.get('cache-control')).toBe('no-store');
    expect(await first.json()).toMatchObject({ total: 6000, pricesChanged: false, items: [{ stock: 8 }] });
    variant!.price = 3000;
    variant!.stock = 3;
    expect(await (await review(reviewRequest())).json()).toMatchObject({ total: 7000, pricesChanged: true, items: [{ stock: 3, unitPrice: 3000 }] });
    mocks.settings.mockResolvedValue({ acceptingOrders: false });
    expect((await review(reviewRequest())).status).toBe(503);
    expect(readVariants).toHaveBeenCalledTimes(2);
    noPayment();
  });

  for (const state of ['producto inactivo', 'producto ausente', 'variante inactiva', 'variante ausente', 'otro producto', 'otro slug', 'stock insuficiente']) {
    it(`rechaza ${state}, tanto al entrar como al iniciar pago`, async () => {
      if (state === 'producto inactivo') variant!.product.is_active = false;
      if (state === 'producto ausente') (variant as unknown as { product: null }).product = null;
      if (state === 'variante inactiva') variant!.is_active = false;
      if (state === 'variante ausente') variant = null;
      if (state === 'otro producto') variant!.product_id = 'otro-id';
      if (state === 'otro slug') variant!.product.slug = 'otro-producto';
      if (state === 'stock insuficiente') variant!.stock = 1;
      for (const [handler, body] of [[review, reviewRequest], [pay, payRequest]] as const) {
        const response = await handler(body());
        expect(response.status).toBe(409);
        expect(await response.json()).toMatchObject({ error: 'STOCK_INSUFICIENTE' });
      }
      noPayment();
    });
  }

  it('no inicia un pago si la tienda se cierra después de revisar', async () => {
    expect((await review(reviewRequest())).status).toBe(200);
    mocks.settings.mockResolvedValue({ acceptingOrders: false, checkoutDisabledMessage: 'Cerrado por vacaciones' });
    const response = await pay(payRequest());
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: 'CHECKOUT_DESHABILITADO', message: 'Cerrado por vacaciones' });
    noPayment();
  });

  for (const failure of ['apertura', 'consulta variantes', 'transporte', 'precio inválido', 'stock inválido']) {
    it(`un fallo de ${failure} impide el pago`, async () => {
      if (failure === 'apertura') mocks.settings.mockResolvedValue(null);
      if (failure === 'consulta variantes') readVariants.mockResolvedValue({ data: [variant], error: { message: 'Database unavailable' } });
      if (failure === 'transporte') readVariants.mockRejectedValue(new Error('Network unavailable'));
      if (failure === 'precio inválido') variant!.price = -1;
      if (failure === 'stock inválido') variant!.stock = Number.NaN;
      expect((await review(reviewRequest())).status).toBe(503);
      expect((await pay(payRequest())).status).toBe(503);
      noPayment();
    });
  }

  for (const quantity of [0, -1, 1.5, 51, '2']) {
    it(`rechaza la cantidad inválida ${quantity}`, async () => {
      const items = [{ ...line, quantity }];
      expect((await review(request({ items }))).status).toBe(400);
      expect((await pay(payRequest({ items }))).status).toBe(400);
      noPayment();
    });
  }

  it('suma las líneas duplicadas antes de comprobar stock y límite de cantidad', async () => {
    expect((await pay(payRequest({ items: [{ ...line, quantity: 5 }, { ...line, quantity: 5 }] }))).status).toBe(409);
    variant!.stock = 100;
    expect((await pay(payRequest({ items: [{ ...line, quantity: 30 }, { ...line, quantity: 30 }] }))).status).toBe(409);
    noPayment();
  });

  for (const price of [2000, 3000]) {
    it(`un cambio de precio a ${price} obliga a revisar el importe antes de generar el pago`, async () => {
      expect((await review(reviewRequest())).status).toBe(200);
      variant!.price = price;
      const response = await pay(payRequest({ total: 1, unitPrice: 1 }));
      expect(response.status).toBe(409);
      const body = await response.json();
      expect(body).toMatchObject({ error: 'PRECIOS_ACTUALIZADOS', review: { total: price * 2 + 1000 } });
      noPayment();
      const accepted = await pay(payRequest({
        items: body.review.items.map((item: { variantId: string; productSlug: string; quantity: number; unitPrice: number }) => ({ ...item, expectedUnitPrice: item.unitPrice })),
        expectedTotal: body.review.total,
      }));
      expect(accepted.status).toBe(200);
      expect(mocks.redirect).toHaveBeenCalledWith(expect.objectContaining({ DS_MERCHANT_AMOUNT: String(price * 2 + 1000) }));
      expect(variant!.stock).toBe(8);
    });
  }

  it('un total manipulado no determina el importe ni crea el pedido', async () => {
    const response = await pay(payRequest({ expectedTotal: 1 }));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: 'PRECIOS_ACTUALIZADOS', review: { subtotal: 5000, shippingCost: 1000, total: 6000 } });
    noPayment();
  });

  it('un carrito válido cobra el precio del servidor, ignora importes adicionales y no descuenta stock', async () => {
    const response = await pay(payRequest({ total: 1, price: 1, shippingCost: 0 }));
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toMatch(/order_status_BM-LOCAL=.*HttpOnly/i);
    expect(response.headers.get('set-cookie')).toContain('SameSite=lax');
    expect(response.headers.get('set-cookie')).toContain('Path=/api/pedidos/estado');
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(await response.json()).toMatchObject({ totalAmount: 6000 });
    expect(insertOrder).toHaveBeenCalledWith(expect.objectContaining({ subtotal: 5000, shipping_cost: 1000, total: 6000 }));
    expect(insertItems).toHaveBeenCalledWith([expect.objectContaining({ quantity: 2, unit_price_snapshot: 2500, line_total: 5000 })]);
    expect(mocks.redirect).toHaveBeenCalledWith(expect.objectContaining({ DS_MERCHANT_AMOUNT: '6000' }));
    expect(mocks.rpc).toHaveBeenCalledWith('generate_redsys_ds_order');
    expect(variant!.stock).toBe(8);
  });

  it('no filtra errores de proveedores en respuestas ni logs de disponibilidad', async () => {
    readVariants.mockRejectedValue(new Error('Authorization: Bearer private-test-sentinel'));
    const response = await review(reviewRequest());
    expect(response.status).toBe(503);
    expect(await response.text()).not.toContain('private-test-sentinel');
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('private-test-sentinel');
  });

  for (const stock of [0, 3]) {
    it(`conserva el regalo opcional con stock ${stock}, sin cambiar el total ni reservar unidades`, async () => {
      promotions = [{ id: 'promo-1', min_subtotal: null, max_redemptions: null, current_redemptions: 0, gift_variant_id: gift.id }];
      gift.stock = stock;
      const response = await pay(payRequest());
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ totalAmount: 6000 });
      const saved = insertItems.mock.calls[0][0] as { item_type: string; line_total: number }[];
      expect(saved).toHaveLength(stock > 0 ? 2 : 1);
      if (stock > 0) expect(saved[1]).toMatchObject({ item_type: 'GIFT', line_total: 0 });
      else expect(history).toHaveBeenCalledWith(expect.objectContaining({ event_type: 'PROMOCION_NO_APLICADA' }));
      expect(gift.stock).toBe(stock);
      expect(variant!.stock).toBe(8);
      expect(mocks.rpc).toHaveBeenCalledTimes(1);
      expect(mocks.rpc).toHaveBeenCalledWith('generate_redsys_ds_order');
    });
  }
});
