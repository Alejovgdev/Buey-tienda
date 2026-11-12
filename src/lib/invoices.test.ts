import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('./supabase-admin', () => ({ supabaseAdmin: { rpc: mocks.rpc } }));

import { issueSimplifiedInvoice } from './invoices';

beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('issueSimplifiedInvoice', () => {
  it('llama a la función SQL con el pedido y devuelve el número', async () => {
    mocks.rpc.mockResolvedValue({ data: { ok: true, already_issued: false, invoice_number: 'T2026-0001' }, error: null });
    await expect(issueSimplifiedInvoice('order-1')).resolves.toEqual({
      ok: true, invoiceNumber: 'T2026-0001', alreadyIssued: false,
    });
    expect(mocks.rpc).toHaveBeenCalledWith('issue_simplified_invoice', { p_order_id: 'order-1' });
  });

  it('distingue una factura ya emitida', async () => {
    mocks.rpc.mockResolvedValue({ data: { ok: true, already_issued: true, invoice_number: 'T2026-0001' }, error: null });
    await expect(issueSimplifiedInvoice('order-1')).resolves.toMatchObject({ ok: true, alreadyIssued: true });
  });

  it('propaga el motivo de negocio cuando la función rechaza el pedido', async () => {
    mocks.rpc.mockResolvedValue({ data: { ok: false, error: 'PEDIDO_SIN_IVA' }, error: null });
    await expect(issueSimplifiedInvoice('order-1')).resolves.toEqual({ ok: false, error: 'PEDIDO_SIN_IVA' });
  });

  it('nunca lanza: errores de BD, transporte o respuestas raras se devuelven como fallo', async () => {
    mocks.rpc.mockResolvedValueOnce({ data: null, error: { code: '40001', message: 'private-test-sentinel' } });
    await expect(issueSimplifiedInvoice('order-1')).resolves.toEqual({ ok: false, error: 'ERROR_INTERNO' });
    mocks.rpc.mockRejectedValueOnce(new Error('private-test-sentinel'));
    await expect(issueSimplifiedInvoice('order-1')).resolves.toEqual({ ok: false, error: 'ERROR_INTERNO' });
    mocks.rpc.mockResolvedValueOnce({ data: { ok: true }, error: null });
    await expect(issueSimplifiedInvoice('order-1')).resolves.toEqual({ ok: false, error: 'RESPUESTA_NO_VALIDA' });
    expect(JSON.stringify(vi.mocked(console.error).mock.calls)).not.toContain('private-test-sentinel');
  });
});
