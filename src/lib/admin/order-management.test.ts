import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ authenticated: vi.fn(), from: vi.fn() }));
vi.mock('@/lib/admin-session', () => ({ isAdminAuthenticated: mocks.authenticated }));
vi.mock('@/lib/supabase-admin', () => ({ supabaseAdmin: { from: mocks.from } }));

import { PATCH as changeStatus } from '@/app/api/admin/pedidos/[id]/estado/route';
import { PATCH as saveNotes } from '@/app/api/admin/pedidos/[id]/notas/route';

const context = { params: Promise.resolve({ id: 'order-1' }) };
const request = (body: unknown) => new Request('http://localhost/api/admin/pedidos/order-1', {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authenticated.mockResolvedValue(true);
});

function orderDatabase(status: string) {
  const order = { id: 'order-1', status, admin_notes: 'Nota anterior', labeled_at: null, labeled_by: null };
  const update = vi.fn((values: object) => ({ eq: vi.fn(async () => {
    Object.assign(order, values);
    return { error: null };
  }) }));
  const insert = vi.fn(async () => ({ error: null }));
  mocks.from.mockImplementation((table: string) => {
    if (table === 'order_status_history') return { insert };
    if (table !== 'orders') throw new Error(`No debe consultar ${table}`);
    return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { ...order }, error: null }) }) }), update };
  });
  return { order, update, insert };
}

describe('gestión normal de pedidos sin etiquetas', () => {
  for (const [previous, next] of [
    ['PAID', 'PREPARING'], ['PAID', 'CANCELLED'], ['PREPARING', 'CANCELLED'],
    ['STOCK_ERROR', 'NEEDS_REVIEW'], ['STOCK_ERROR', 'CANCELLED'],
    ['NEEDS_REVIEW', 'PREPARING'], ['NEEDS_REVIEW', 'CANCELLED'],
  ]) {
    it(`conserva ${previous} → ${next} sin etiquetas ni marcas de etiquetado`, async () => {
      const { order, update, insert } = orderDatabase(previous);
      expect((await changeStatus(request({ status: next }), context)).status).toBe(200);
      expect(order.status).toBe(next);
      expect(order.labeled_at).toBeNull();
      expect(order.labeled_by).toBeNull();
      expect(update).toHaveBeenCalledWith({ status: next, updated_at: expect.any(String) });
      expect(insert).toHaveBeenCalledWith({ order_id: 'order-1', event_type: 'ESTADO_CAMBIADO', previous_status: previous, new_status: next });
    });
  }

  for (const [previous, next] of [['PENDING_PAYMENT', 'PAID'], ['PAYMENT_FAILED', 'PREPARING'], ['CANCELLED', 'PREPARING']]) {
    it(`sigue rechazando ${previous} → ${next}`, async () => {
      const { update, insert } = orderDatabase(previous);
      expect((await changeStatus(request({ status: next }), context)).status).toBe(409);
      expect(update).not.toHaveBeenCalled();
      expect(insert).not.toHaveBeenCalled();
    });
  }

  it('guarda notas e histórico sin cambiar el estado ni las marcas de etiquetado', async () => {
    const { order, update, insert } = orderDatabase('PREPARING');
    expect((await saveNotes(request({ notes: '  Embalar con cuidado  ' }), context)).status).toBe(200);
    expect(order).toMatchObject({ status: 'PREPARING', admin_notes: 'Embalar con cuidado', labeled_at: null, labeled_by: null });
    expect(update).toHaveBeenCalledWith({ admin_notes: 'Embalar con cuidado', updated_at: expect.any(String) });
    expect(insert).toHaveBeenCalledWith({ order_id: 'order-1', event_type: 'NOTA_INTERNA_AÑADIDA', notes: 'Embalar con cuidado' });
  });

  it('mantiene protegidas las escrituras de estado y notas', async () => {
    mocks.authenticated.mockResolvedValue(false);
    expect((await changeStatus(request({ status: 'PREPARING' }), context)).status).toBe(401);
    expect((await saveNotes(request({ notes: 'Nueva nota' }), context)).status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
  });
});
