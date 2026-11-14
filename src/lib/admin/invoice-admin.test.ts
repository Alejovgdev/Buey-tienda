import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Paso 6. Factura en el panel: descarga, reenvío y emisión manual.
const mocks = vi.hoisted(() => ({
  authenticated: vi.fn(),
  from: vi.fn(),
  rpc: vi.fn(),
  storageFrom: vi.fn(),
  send: vi.fn(),
  render: vi.fn(),
}));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/admin-session', () => ({ isAdminAuthenticated: mocks.authenticated }));
vi.mock('@/lib/supabase-admin', () => ({
  supabaseAdmin: { from: mocks.from, rpc: mocks.rpc, storage: { from: mocks.storageFrom } },
}));
vi.mock('@/lib/resend', () => ({ resend: { emails: { send: mocks.send } } }));
vi.mock('@/lib/invoice-pdf/render', () => ({ renderInvoicePdf: mocks.render }));

import { GET as downloadPdf } from '@/app/api/admin/facturas/[id]/pdf/route';
import { POST as resendInvoice } from '@/app/api/admin/facturas/[id]/reenviar/route';
import { POST as issueInvoice } from '@/app/api/admin/pedidos/[id]/factura/route';
import { invoiceEmailMessage, invoiceEmailSubject } from '@/lib/email/send-invoice-email';
import { issueInvoiceFromAdmin } from '@/lib/invoices-admin';

const INVOICE_ID = '11111111-1111-4111-8111-111111111111';
const ORDER_ID = '22222222-2222-4222-8222-222222222222';
const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const post = () => new Request('http://localhost/api/admin', { method: 'POST' });
const get = () => new Request('http://localhost/api/admin');

const invoiceRow = {
  id: INVOICE_ID, order_id: ORDER_ID, invoice_type: 'SIMPLIFIED',
  invoice_number: 'T2026-0001', year: 2026, issue_date: '2026-11-12', operation_date: '2026-11-12',
  issuer_legal_name: 'El Buey Madurado SL', issuer_tax_id: 'B24770836',
  lines: [{ type: 'PRODUCT', description: 'Chuletón — 1 kg', quantity: 1, line_total: 3500 }],
  vat_breakdown: [{ vat_rate: 10, tax_base: 3182, vat_amount: 318 }],
  total: 3500,
};
const orderRow = { id: ORDER_ID, status: 'PAID', order_number: 'BM-2026-00112', customer_name: 'Ana', customer_email: 'delivered@resend.dev' };
const storedPdf = Buffer.from('%PDF-guardado');

let history: Record<string, unknown>[];
let pdfInStorage: boolean;
let upload: ReturnType<typeof vi.fn>;

function database({ invoice = invoiceRow as typeof invoiceRow | null } = {}) {
  history = [];
  mocks.from.mockImplementation((table: string) => {
    if (table === 'order_status_history') {
      return { insert: vi.fn(async (row: Record<string, unknown>) => { history.push(row); return { error: null }; }) };
    }
    const row = table === 'invoices' ? invoice : table === 'orders' ? orderRow : undefined;
    if (row === undefined) throw new Error(`No debe consultar ${table}`);
    return { select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: row, error: null }) }) }) };
  });
  upload = vi.fn(async () => { pdfInStorage = true; return { error: null }; });
  mocks.storageFrom.mockReturnValue({
    exists: vi.fn(async () => ({ data: pdfInStorage })),
    download: vi.fn(async () => ({ data: new Blob([storedPdf]), error: null })),
    upload,
  });
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.authenticated.mockResolvedValue(true);
  mocks.send.mockResolvedValue({ data: { id: 'email-1' }, error: null });
  mocks.render.mockResolvedValue(Buffer.from('%PDF-nuevo'));
  pdfInStorage = true;
  database();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('solo un admin con sesión', () => {
  it('sin sesión, las tres rutas devuelven 401 y no tocan BD, Storage ni Resend', async () => {
    mocks.authenticated.mockResolvedValue(false);
    expect((await downloadPdf(get(), ctx(INVOICE_ID))).status).toBe(401);
    expect((await resendInvoice(post(), ctx(INVOICE_ID))).status).toBe(401);
    expect((await issueInvoice(post(), ctx(ORDER_ID))).status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
    expect(mocks.storageFrom).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
});

describe('descargar PDF', () => {
  it('sirve el PDF guardado como descarga privada', async () => {
    const response = await downloadPdf(get(), ctx(INVOICE_ID));
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/pdf');
    expect(response.headers.get('Content-Disposition')).toBe('attachment; filename="Factura-T2026-0001.pdf"');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe('%PDF-guardado');
    expect(upload).not.toHaveBeenCalled();
  });

  it('si no está en Storage, lo genera y lo sube sin sobrescribir', async () => {
    pdfInStorage = false;
    const response = await downloadPdf(get(), ctx(INVOICE_ID));
    expect(response.status).toBe(200);
    expect(Buffer.from(await response.arrayBuffer()).toString()).toBe('%PDF-nuevo');
    expect(upload).toHaveBeenCalledWith('2026/Factura-T2026-0001.pdf', expect.any(Buffer), {
      contentType: 'application/pdf', upsert: false,
    });
  });

  it('404 si la factura no existe o el id no es válido', async () => {
    database({ invoice: null });
    expect((await downloadPdf(get(), ctx(INVOICE_ID))).status).toBe(404);
    expect((await downloadPdf(get(), ctx('no-es-uuid'))).status).toBe(404);
  });
});

describe('reenviar al cliente', () => {
  it('envía el email corto con el PDF al email del pedido y lo apunta en el histórico', async () => {
    vi.stubEnv('EMAIL_REPLY_TO', 'elbueymaduradoxativa@gmail.com');
    const response = await resendInvoice(post(), ctx(INVOICE_ID));
    expect(response.status).toBe(200);

    const email = mocks.send.mock.calls[0][0];
    expect(email).toMatchObject({
      to: 'delivered@resend.dev',
      replyTo: 'elbueymaduradoxativa@gmail.com',
      subject: 'Tu factura T2026-0001 — El Buey Madurado',
    });
    expect(email.attachments).toEqual([{ filename: 'Factura-T2026-0001.pdf', content: storedPdf, contentType: 'application/pdf' }]);
    expect(email.html).toContain('Hola Ana,');
    expect(email.html).toContain('Te enviamos la factura T2026-0001 de tu pedido BM-2026-00112.');
    expect(email.html).toContain('elbueymaduradoxativa@gmail.com');
    expect(email.html).not.toContain('Pedido confirmado');

    expect(history).toEqual([expect.objectContaining({
      order_id: ORDER_ID,
      event_type: 'FACTURA_REENVIADA',
      metadata: { invoice_number: 'T2026-0001', email: 'delivered@resend.dev' },
    })]);
    vi.unstubAllEnvs();
  });

  it('si Resend falla, devuelve error y no apunta el reenvío', async () => {
    mocks.send.mockResolvedValue({ data: null, error: { message: 'fallo' } });
    expect((await resendInvoice(post(), ctx(INVOICE_ID))).status).toBe(502);
    expect(history).toEqual([]);
  });

  it('la plantilla solo tiene texto para la simplificada por ahora', () => {
    expect(invoiceEmailSubject('R2026-0001')).toBe('Tu factura R2026-0001 — El Buey Madurado');
    expect(() => invoiceEmailMessage('FULL', 'T2026-0009', 'BM-2026-00001')).toThrow();
  });
});

describe('emitir factura', () => {
  it('emite la simplificada y apunta FACTURA_EMITIDA desde el panel', async () => {
    mocks.rpc.mockResolvedValue({ data: { ok: true, already_issued: false, invoice_number: 'T2026-0003' }, error: null });
    const response = await issueInvoice(post(), ctx(ORDER_ID));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, invoiceNumber: 'T2026-0003', alreadyIssued: false });
    expect(mocks.rpc).toHaveBeenCalledWith('issue_simplified_invoice', { p_order_id: ORDER_ID });
    expect(history).toEqual([expect.objectContaining({
      order_id: ORDER_ID, event_type: 'FACTURA_EMITIDA', metadata: { invoice_number: 'T2026-0003', origen: 'admin' },
    })]);
  });

  it('si ya existía, no apunta otra emisión', async () => {
    mocks.rpc.mockResolvedValue({ data: { ok: true, already_issued: true, invoice_number: 'T2026-0001' }, error: null });
    expect((await issueInvoice(post(), ctx(ORDER_ID))).status).toBe(200);
    expect(history).toEqual([]);
  });

  for (const status of ['STOCK_ERROR', 'NEEDS_REVIEW', 'CANCELLED', 'PENDING_PAYMENT']) {
    it(`en ${status} no llama a la BD para emitir ni apunta nada`, async () => {
      orderRow.status = status;
      try {
        const response = await issueInvoice(post(), ctx(ORDER_ID));
        expect(response.status).toBe(409);
        expect((await response.json()).code).toBe('ESTADO_NO_FACTURABLE');
        expect(mocks.rpc).not.toHaveBeenCalled();
        expect(history).toEqual([]);
      } finally {
        orderRow.status = 'PAID';
      }
    });
  }

  it('si la BD dice que sigue en revisión, 409 con mensaje claro', async () => {
    mocks.rpc.mockResolvedValue({ data: { ok: false, error: 'PEDIDO_EN_REVISION' }, error: null });
    const response = await issueInvoice(post(), ctx(ORDER_ID));
    expect(response.status).toBe(409);
    expect((await response.json()).error).toContain('pendiente de revisión');
  });

  it('al resolver una revisión apunta el origen en el histórico', async () => {
    mocks.rpc.mockResolvedValue({ data: { ok: true, already_issued: false, invoice_number: 'T2026-0004' }, error: null });
    await issueInvoiceFromAdmin(ORDER_ID, 'revision');
    expect(history).toEqual([expect.objectContaining({
      event_type: 'FACTURA_EMITIDA',
      notes: 'T2026-0004 (emitida al resolver la revisión)',
      metadata: { invoice_number: 'T2026-0004', origen: 'revision' },
    })]);
  });

  it('si el pedido no está pagado, 409 y FACTURA_ERROR', async () => {
    mocks.rpc.mockResolvedValue({ data: { ok: false, error: 'PEDIDO_NO_PAGADO' }, error: null });
    expect((await issueInvoice(post(), ctx(ORDER_ID))).status).toBe(409);
    expect(history).toEqual([expect.objectContaining({ event_type: 'FACTURA_ERROR', metadata: { error: 'PEDIDO_NO_PAGADO', origen: 'admin' } })]);
  });
});
