import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAdminSessionToken, verifyAdminSessionToken } from '@/lib/admin-auth';

const mocks = vi.hoisted(() => ({ token: undefined as string | undefined, from: vi.fn(), read: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => mocks.token ? { value: mocks.token } : undefined }) }));
vi.mock('@/lib/supabase-admin', () => ({ supabaseAdmin: { from: mocks.from } }));

import { GET } from './route';
import { createOrderStatusAccess, ORDER_STATUS_ACCESS_SECONDS } from '@/lib/order-status-access';

const orderNumber = 'BM-2026-123';
const request = (number = orderNumber) => new Request(`http://localhost/api/pedidos/estado?order=${number}`);

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('ADMIN_JWT_SECRET', 'clave-local-solo-para-pruebas-de-pedidos');
  mocks.token = undefined;
  mocks.read.mockResolvedValue({ data: { order_number: orderNumber, status: 'PAID' }, error: null });
  mocks.from.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: mocks.read }) }) });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe('consulta del estado autorizada por pedido', () => {
  for (const scenario of ['ausente', 'manipulada', 'otro pedido', 'caducada', 'administrador']) {
    it(`rechaza cookie ${scenario} antes de consultar la base de datos`, async () => {
      if (scenario === 'manipulada') {
        const token = await createOrderStatusAccess(orderNumber);
        const [header, payload, signature] = token.split('.');
        mocks.token = `${header}.${payload}.${signature[0] === 'A' ? 'B' : 'A'}${signature.slice(1)}`;
      }
      if (scenario === 'otro pedido') mocks.token = await createOrderStatusAccess('BM-2026-124');
      if (scenario === 'administrador') mocks.token = await createAdminSessionToken({ workerName: 'Ana', sid: 'local' });
      if (scenario === 'caducada') {
        vi.useFakeTimers();
        mocks.token = await createOrderStatusAccess(orderNumber);
        vi.setSystemTime(Date.now() + (ORDER_STATUS_ACCESS_SECONDS + 1) * 1000);
      }
      const response = await GET(request());
      expect(response.status).toBe(404);
      expect(await response.json()).toEqual({ error: 'PEDIDO_NO_ENCONTRADO' });
      expect(response.headers.get('cache-control')).toBe('no-store');
      expect(mocks.from).not.toHaveBeenCalled();
    });
  }

  it('solo devuelve número y estado con la cookie válida de ese pedido', async () => {
    mocks.token = await createOrderStatusAccess(orderNumber);
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ orderNumber, status: 'PAID' });
    expect(response.headers.get('cache-control')).toBe('no-store');
    expect(mocks.from).toHaveBeenCalledWith('orders');
    expect(await verifyAdminSessionToken(mocks.token)).toBe(false);
  });

  it('no distingue un pedido inexistente de uno no autorizado', async () => {
    mocks.token = await createOrderStatusAccess(orderNumber);
    mocks.read.mockResolvedValue({ data: null, error: null });
    expect((await GET(request())).status).toBe(404);
  });
});
