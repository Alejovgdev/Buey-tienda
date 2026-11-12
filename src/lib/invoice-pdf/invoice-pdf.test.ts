import { beforeEach, describe, expect, it, vi } from 'vitest';
import { invoicePdfPath, toInvoicePdfData, type InvoiceRow } from './invoice-data';
import { renderInvoicePdf } from './render';
import { ensureInvoicePdf } from './storage';

// Copia tal y como la guarda issue_simplified_invoice (T2026-0002 de pruebas).
const row: InvoiceRow = {
  invoice_number: 'T2026-0002',
  year: 2026,
  issue_date: '2026-11-12',
  operation_date: '2026-11-12',
  issuer_legal_name: 'EL BUEY MADURADO, S.L.',
  issuer_tax_id: 'B24770836',
  total: 15500,
  lines: [
    { type: 'PRODUCT', description: 'Chuletón de Vaca Madurada — 1,5 kg', quantity: 1, unit_price: 6500, line_total: 6500, vat_rate: 10, tax_base: 5909, vat_amount: 591 },
    { type: 'PRODUCT', description: 'Croquetas de Jamón Ibérico — Caja 24 uds.', quantity: 2, unit_price: 1300, line_total: 2600, vat_rate: 10, tax_base: 2364, vat_amount: 236 },
    { type: 'GIFT', description: 'Burger Wagyu Artesana — Pack 4 uds.', quantity: 1, unit_price: 0, line_total: 0, vat_rate: null, tax_base: 0, vat_amount: 0 },
  ],
  vat_breakdown: [{ vat_rate: 10, tax_base: 14091, vat_amount: 1409 }],
};

describe('datos del PDF', () => {
  it('salen solo de la copia guardada en la factura', () => {
    const data = toInvoicePdfData(row);
    expect(data).toMatchObject({
      invoiceNumber: 'T2026-0002', issueDate: '2026-11-12', operationDate: '2026-11-12',
      issuerLegalName: 'EL BUEY MADURADO, S.L.', issuerTaxId: 'B24770836', vatRates: [10], total: 15500,
    });
    expect(data.lines).toEqual([
      { type: 'PRODUCT', description: 'Chuletón de Vaca Madurada — 1,5 kg', quantity: 1, lineTotal: 6500 },
      { type: 'PRODUCT', description: 'Croquetas de Jamón Ibérico — Caja 24 uds.', quantity: 2, lineTotal: 2600 },
      { type: 'GIFT', description: 'Burger Wagyu Artesana — Pack 4 uds.', quantity: 1, lineTotal: 0 },
    ]);
    expect(invoicePdfPath(data)).toBe('2026/Factura-T2026-0002.pdf');
  });

  it('rechaza una copia incompleta', () => {
    expect(() => toInvoicePdfData({ ...row, lines: [] })).toThrow();
    expect(() => toInvoicePdfData({ ...row, lines: [{ description: 'Sin importe' }] })).toThrow();
    expect(() => toInvoicePdfData({ ...row, vat_breakdown: null })).toThrow();
  });

  it('genera un PDF de una página', async () => {
    const pdf = await renderInvoicePdf(toInvoicePdfData(row));
    expect(pdf.subarray(0, 5).toString('latin1')).toBe('%PDF-');
    expect(pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g)).toHaveLength(1);
    expect(pdf.length).toBeLessThan(100_000);
  });
});

describe('almacén de PDFs', () => {
  const data = toInvoicePdfData(row);
  const existing = Buffer.from('%PDF-guardado');
  const bucket = { exists: vi.fn(), download: vi.fn(), upload: vi.fn() };
  const client = { storage: { from: vi.fn(() => bucket) } } as unknown as Parameters<typeof ensureInvoicePdf>[0];
  const render = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();
    (client.storage.from as ReturnType<typeof vi.fn>).mockReturnValue(bucket);
    bucket.download.mockResolvedValue({ data: new Blob([existing]), error: null });
    bucket.upload.mockResolvedValue({ data: {}, error: null });
    render.mockResolvedValue(Buffer.from('%PDF-nuevo'));
  });

  it('si ya existe, lo reutiliza sin volver a generarlo ni subirlo', async () => {
    bucket.exists.mockResolvedValue({ data: true, error: null });
    const file = await ensureInvoicePdf(client, data, render);
    expect(file).toEqual({ filename: 'Factura-T2026-0002.pdf', content: existing, created: false });
    expect(client.storage.from).toHaveBeenCalledWith('invoices');
    expect(render).not.toHaveBeenCalled();
    expect(bucket.upload).not.toHaveBeenCalled();
  });

  it('si no existe, lo genera y lo sube sin permitir sobrescribir', async () => {
    bucket.exists.mockResolvedValue({ data: false, error: { status: 404 } });
    const file = await ensureInvoicePdf(client, data, render);
    expect(file).toMatchObject({ filename: 'Factura-T2026-0002.pdf', created: true });
    expect(bucket.upload).toHaveBeenCalledWith('2026/Factura-T2026-0002.pdf', Buffer.from('%PDF-nuevo'), {
      contentType: 'application/pdf', upsert: false,
    });
  });

  it('si otro proceso lo sube a la vez, usa el ya guardado', async () => {
    bucket.exists.mockResolvedValueOnce({ data: false, error: null }).mockResolvedValueOnce({ data: true, error: null });
    bucket.upload.mockResolvedValue({ data: null, error: { message: 'The resource already exists' } });
    const file = await ensureInvoicePdf(client, data, render);
    expect(file).toMatchObject({ content: existing, created: false });
  });

  it('propaga los fallos de subida para que el email salga sin adjunto', async () => {
    bucket.exists.mockResolvedValue({ data: false, error: null });
    bucket.upload.mockResolvedValue({ data: null, error: new Error('storage unavailable') });
    await expect(ensureInvoicePdf(client, data, render)).rejects.toThrow('storage unavailable');
  });
});
