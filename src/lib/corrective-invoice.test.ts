import { describe, expect, it } from 'vitest';
import { correctiveBalance, parseCorrectiveRequest, parseEurosToCents, splitVat } from './corrective-invoice';
import { INVOICE_ON_CANCEL_WARNING, confirmationFor } from '@/components/Admin/OrderStatusControl';

// Paso 8. Ayudas de las facturas rectificativas.
const REQUEST_ID = '33333333-3333-4333-8333-333333333333';

describe('importe en euros', () => {
  it('acepta coma o punto y como mucho dos decimales', () => {
    expect(parseEurosToCents('10')).toBe(1000);
    expect(parseEurosToCents('10,5')).toBe(1050);
    expect(parseEurosToCents('10,50')).toBe(1050);
    expect(parseEurosToCents(' 10.05 € ')).toBe(1005);
    expect(parseEurosToCents('0,01')).toBe(1);
  });

  it('rechaza importes vacíos, a cero, negativos o con más de dos decimales', () => {
    for (const value of ['', '0', '0,00', '-5', '10,505', 'diez', '1.000,50', '10,']) {
      expect(parseEurosToCents(value)).toBeNull();
    }
  });
});

describe('lo que queda por rectificar', () => {
  const original = { invoiceType: 'SIMPLIFIED', invoiceNumber: 'T2026-0003', total: 15500, status: 'EMITIDA' };

  it('sin rectificativas queda toda la factura', () => {
    expect(correctiveBalance([original])).toEqual({
      originalNumber: 'T2026-0003', originalTotal: 15500, refunded: 0, remaining: 15500,
    });
  });

  it('resta las rectificativas (en negativo) ya emitidas', () => {
    const list = [
      { ...original, status: 'RECTIFICADA' },
      { invoiceType: 'CORRECTIVE', invoiceNumber: 'R2026-0001', total: -1000 },
      { invoiceType: 'CORRECTIVE', invoiceNumber: 'R2026-0002', total: -2500 },
    ];
    expect(correctiveBalance(list)).toMatchObject({ refunded: 3500, remaining: 12000 });
  });

  it('sin factura vigente no hay nada que rectificar', () => {
    expect(correctiveBalance([])).toBeNull();
  });
});

describe('petición del panel', () => {
  it('total: sin importe y con motivo', () => {
    expect(parseCorrectiveRequest({ kind: 'TOTAL', amount: 999, reason: '  Pedido cancelado ', requestId: REQUEST_ID }))
      .toEqual({ ok: true, value: { kind: 'TOTAL', amount: null, reason: 'Pedido cancelado', requestId: REQUEST_ID } });
  });

  it('parcial: importe en céntimos obligatorio', () => {
    expect(parseCorrectiveRequest({ kind: 'PARTIAL', amount: 1050, reason: 'Chuletón 1 kg, vacío roto', requestId: REQUEST_ID }))
      .toMatchObject({ ok: true, value: { amount: 1050 } });
    for (const amount of [undefined, 0, -100, 10.5, '1050']) {
      expect(parseCorrectiveRequest({ kind: 'PARTIAL', amount, reason: 'x', requestId: REQUEST_ID }).ok).toBe(false);
    }
  });

  it('rechaza motivo vacío o largo, tipo desconocido y requestId no válido', () => {
    const base = { kind: 'TOTAL', reason: 'Motivo', requestId: REQUEST_ID };
    expect(parseCorrectiveRequest({ ...base, reason: '   ' }).ok).toBe(false);
    expect(parseCorrectiveRequest({ ...base, reason: 'x'.repeat(301) }).ok).toBe(false);
    expect(parseCorrectiveRequest({ ...base, kind: 'FULL' }).ok).toBe(false);
    expect(parseCorrectiveRequest({ ...base, requestId: 'abc' }).ok).toBe(false);
    expect(parseCorrectiveRequest(null).ok).toBe(false);
  });
});

describe('base e IVA de un importe con IVA incluido', () => {
  it('redondea la base al céntimo y el IVA es el resto', () => {
    expect(splitVat(1000, 10)).toEqual({ taxBase: 909, vat: 91 });
    expect(splitVat(1100, 10)).toEqual({ taxBase: 1000, vat: 100 });
    expect(splitVat(5, 10)).toEqual({ taxBase: 5, vat: 0 });
  });
});

describe('confirmación al cancelar', () => {
  it('recuerda la rectificativa y la devolución si el pedido tiene factura', () => {
    expect(confirmationFor('PAID', 'CANCELLED', 'BM-2026-00012', true))
      .toBe(`¿Cancelar el pedido BM-2026-00012? ${INVOICE_ON_CANCEL_WARNING}`);
    expect(INVOICE_ON_CANCEL_WARNING)
      .toBe('Este pedido tiene factura: emite una rectificativa y devuelve el dinero en el TPV de Redsys.');
  });

  it('sin factura no cambia la confirmación', () => {
    expect(confirmationFor('PAID', 'CANCELLED', 'BM-2026-00012')).toBeNull();
  });
});
