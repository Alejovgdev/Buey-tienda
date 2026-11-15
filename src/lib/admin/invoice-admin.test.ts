import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Pasos 6 y 8. Factura en el panel: descarga, reenvío, emisión manual y rectificativas.
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
import { POST as issueCorrective } from '@/app/api/admin/pedidos/[id]/rectificativa/route';
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

// `invoices` puede ser una lista: cada consulta a la tabla devuelve la siguiente
// (la rectificativa y después la factura que rectifica).
function database({ invoice = invoiceRow as Record<string, unknown> | null, invoices = null as Record<string, unknown>[] | null } = {}) {
  history = [];
  const queue = invoices ? [...invoices] : null;
  mocks.from.mockImplementation((table: string) => {
    if (table === 'order_status_history') {
      return { insert: vi.fn(async (row: Record<string, unknown>) => { history.push(row); return { error: null }; }) };
    }
    const row = table === 'invoices' ? (queue ? queue.shift() ?? null : invoice) : table === 'orders' ? orderRow : undefined;
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

  it('la plantilla tiene texto para la simplificada y la rectificativa, no para la completa', () => {
    expect(invoiceEmailSubject('T2026-0001')).toBe('Tu factura T2026-0001 — El Buey Madurado');
    expect(invoiceEmailSubject('R2026-0001', 'CORRECTIVE')).toBe('Tu factura rectificativa R2026-0001 — El Buey Madurado');
    expect(invoiceEmailMessage('CORRECTIVE', 'R2026-0001', 'BM-2026-00112', 'T2026-0001')).toBe(
      'Te enviamos la factura rectificativa R2026-0001 de tu pedido BM-2026-00112, que corrige la factura T2026-0001. ' +
      'La devolución del importe, si corresponde, se hace aparte en la tarjeta con la que pagaste.'
    );
    expect(() => invoiceEmailMessage('CORRECTIVE', 'R2026-0001', 'BM-2026-00112')).toThrow();
    expect(() => invoiceEmailMessage('FULL', 'T2026-0009', 'BM-2026-00001')).toThrow();
  });

  it('envía la rectificativa con su texto y la referencia a la factura que rectifica', async () => {
    const corrective = {
      ...invoiceRow, invoice_type: 'CORRECTIVE', invoice_number: 'R2026-0001', issue_date: '2026-11-15',
      correction_reason: 'Chuletón 1 kg, llegó con el vacío roto', rectifies_invoice_id: INVOICE_ID,
      lines: [{ type: 'CORRECTION', description: 'Devolución parcial: Chuletón 1 kg, llegó con el vacío roto', quantity: 1, line_total: -1000 }],
      vat_breakdown: [{ vat_rate: 10, tax_base: -909, vat_amount: -91 }], total: -1000,
    };
    database({ invoices: [corrective, { invoice_number: 'T2026-0001', issue_date: '2026-11-12' }] });
    const response = await resendInvoice(post(), ctx(INVOICE_ID));
    expect(response.status).toBe(200);
    const email = mocks.send.mock.calls[0][0];
    expect(email.subject).toBe('Tu factura rectificativa R2026-0001 — El Buey Madurado');
    expect(email.html).toContain('que corrige la factura T2026-0001');
    expect(email.attachments[0].filename).toBe('Factura-R2026-0001.pdf');
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

describe('emitir rectificativa', () => {
  const REQUEST_ID = '33333333-3333-4333-8333-333333333333';
  const body = (value: unknown) =>
    new Request('http://localhost/api/admin', { method: 'POST', body: JSON.stringify(value), headers: { 'Content-Type': 'application/json' } });
  const partial = { kind: 'PARTIAL', amount: 1000, reason: 'Chuletón 1 kg, llegó con el vacío roto', requestId: REQUEST_ID };

  it('sin sesión, 401 y no llama a la BD', async () => {
    mocks.authenticated.mockResolvedValue(false);
    expect((await issueCorrective(body(partial), ctx(ORDER_ID))).status).toBe(401);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('valida la petición antes de llamar a la BD', async () => {
    for (const value of [{ ...partial, reason: ' ' }, { ...partial, amount: 0 }, { ...partial, requestId: 'x' }, { ...partial, kind: 'X' }]) {
      expect((await issueCorrective(body(value), ctx(ORDER_ID))).status).toBe(400);
    }
    expect((await issueCorrective(body(partial), ctx('no-es-uuid'))).status).toBe(404);
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it('parcial: llama a la función con el importe en céntimos y devuelve el número', async () => {
    mocks.rpc.mockResolvedValue({ data: { ok: true, already_issued: false, invoice_id: INVOICE_ID, invoice_number: 'R2026-0001', total: -1000 }, error: null });
    const response = await issueCorrective(body(partial), ctx(ORDER_ID));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, invoiceId: INVOICE_ID, invoiceNumber: 'R2026-0001', total: -1000, alreadyIssued: false });
    expect(mocks.rpc).toHaveBeenCalledWith('issue_corrective_invoice', {
      p_order_id: ORDER_ID, p_kind: 'PARTIAL', p_amount: 1000,
      p_reason: 'Chuletón 1 kg, llegó con el vacío roto', p_request_id: REQUEST_ID,
    });
    // El historial lo escribe la función SQL en la misma transacción.
    expect(history).toEqual([]);
  });

  it('total: no manda importe', async () => {
    mocks.rpc.mockResolvedValue({ data: { ok: true, already_issued: false, invoice_id: INVOICE_ID, invoice_number: 'R2026-0002', total: -3500 }, error: null });
    await issueCorrective(body({ kind: 'TOTAL', amount: 50, reason: 'Pedido cancelado', requestId: REQUEST_ID }), ctx(ORDER_ID));
    expect(mocks.rpc.mock.calls[0][1]).toMatchObject({ p_kind: 'TOTAL', p_amount: null });
  });

  it('si se pasa de la factura o ya no queda nada, 409 con mensaje claro', async () => {
    mocks.rpc.mockResolvedValue({ data: { ok: false, error: 'IMPORTE_SUPERA_FACTURA', remaining: 500 }, error: null });
    let response = await issueCorrective(body(partial), ctx(ORDER_ID));
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'IMPORTE_SUPERA_FACTURA', remaining: 500 });

    mocks.rpc.mockResolvedValue({ data: { ok: false, error: 'NADA_QUE_DEVOLVER' }, error: null });
    response = await issueCorrective(body(partial), ctx(ORDER_ID));
    expect((await response.json()).error).toBe('Ya se ha rectificado todo el importe de la factura');
  });

  it('si la BD falla, 500', async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: { code: 'XX000', message: 'boom' } });
    expect((await issueCorrective(body(partial), ctx(ORDER_ID))).status).toBe(500);
  });
});
