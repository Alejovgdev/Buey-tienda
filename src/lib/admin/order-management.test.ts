import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ authenticated: vi.fn(), from: vi.fn(), issueInvoice: vi.fn() }));
vi.mock('@/lib/admin-session', () => ({ isAdminAuthenticated: mocks.authenticated }));
vi.mock('@/lib/supabase-admin', () => ({ supabaseAdmin: { from: mocks.from } }));
vi.mock('@/lib/invoices-admin', () => ({ issueInvoiceFromAdmin: mocks.issueInvoice }));

import { PATCH as changeStatus } from '@/app/api/admin/pedidos/[id]/estado/route';
import { PATCH as saveNotes } from '@/app/api/admin/pedidos/[id]/notas/route';

const context = { params: Promise.resolve({ id: 'order-1' }) };
const request = (body: unknown) => new Request('http://localhost/api/admin/pedidos/order-1', {
  method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.authenticated.mockResolvedValue(true);
  mocks.issueInvoice.mockResolvedValue({ ok: true, invoiceNumber: 'T2026-0009', alreadyIssued: false });
});

function orderDatabase(status: string, createdAt = '2026-11-01T10:00:00Z') {
  const order = {
    id: 'order-1', status, admin_notes: 'Nota anterior', labeled_at: null, labeled_by: null,
    created_at: createdAt,
  };
  // Notas: update(...).eq('id'). Estado: update(...).eq('id').eq('status',
  // previo).select().maybeSingle(), que solo cambia si el estado no ha cambiado.
  const update = vi.fn((values: object) => ({
    eq: () => {
      let applied = false;
      const apply = () => { if (!applied) { applied = true; Object.assign(order, values); } };
      return {
        then: (resolve: (value: { error: null }) => unknown) => { apply(); return Promise.resolve({ error: null }).then(resolve); },
        eq: (_column: string, expected: string) => ({
          select: () => ({
            maybeSingle: async () => {
              if (order.status !== expected) return { data: null, error: null };
              apply();
              return { data: { id: order.id }, error: null };
            },
          }),
        }),
      };
    },
  }));
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
      // Paso 6: solo resolver una revisión (Revisión manual → Preparando) emite la factura.
      if (previous === 'NEEDS_REVIEW' && next === 'PREPARING') {
        expect(mocks.issueInvoice).toHaveBeenCalledWith('order-1', 'revision');
      } else {
        expect(mocks.issueInvoice).not.toHaveBeenCalled();
      }
    });
  }

  it('al resolver la revisión devuelve el número de factura, o el error sin deshacer el cambio de estado', async () => {
    orderDatabase('NEEDS_REVIEW');
    const ok = await changeStatus(request({ status: 'PREPARING' }), context);
    expect(await ok.json()).toEqual({ ok: true, status: 'PREPARING', invoice: { ok: true, invoiceNumber: 'T2026-0009' } });

    const { order } = orderDatabase('NEEDS_REVIEW');
    mocks.issueInvoice.mockResolvedValue({ ok: false, error: 'PEDIDO_SIN_IVA' });
    const failed = await changeStatus(request({ status: 'PREPARING' }), context);
    expect(failed.status).toBe(200);
    expect(order.status).toBe('PREPARING');
    expect(await failed.json()).toEqual({ ok: true, status: 'PREPARING', invoice: { ok: false, error: 'PEDIDO_SIN_IVA' } });
  });

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
