import { describe, expect, it } from 'vitest';
import { splitVatIncluded, sumVat } from './vat';

describe('splitVatIncluded', () => {
  it('desglosa los ejemplos del plan al 10 %', () => {
    expect(splitVatIncluded(2500, 10)).toEqual({ vatRate: 10, taxBase: 2273, vatAmount: 227 });
    expect(splitVatIncluded(1000, 10)).toEqual({ vatRate: 10, taxBase: 909, vatAmount: 91 });
  });

  it('deja tipo vacío, base 0 e IVA 0 en las líneas a 0 € (regalo y envío gratis)', () => {
    expect(splitVatIncluded(0, 10)).toEqual({ vatRate: null, taxBase: 0, vatAmount: 0 });
  });

  it('cuadra al céntimo en todos los importes de 0,01 € a 1.000 €', () => {
    for (let total = 1; total <= 100000; total += 1) {
      const { taxBase, vatAmount } = splitVatIncluded(total, 10);
      expect(taxBase + vatAmount).toBe(total);
      expect(taxBase).toBeGreaterThanOrEqual(0);
      expect(vatAmount).toBeGreaterThanOrEqual(0);
      // La base es el redondeo correcto: a menos de medio céntimo del valor exacto.
      expect(Math.abs(taxBase - total / 1.1)).toBeLessThanOrEqual(0.5);
    }
  });

  it('redondea medio céntimo hacia arriba', () => {
    // 0,21 € / 1,10 = 0,19090… → 19; 1,65 € / 1,10 = 1,5 exacto → 150.
    expect(splitVatIncluded(21, 10).taxBase).toBe(19);
    expect(splitVatIncluded(165, 10).taxBase).toBe(150);
    // 0,11 € al 10 %: 0,10 base exacta.
    expect(splitVatIncluded(11, 10)).toEqual({ vatRate: 10, taxBase: 10, vatAmount: 1 });
  });

  it('admite otros tipos configurables', () => {
    expect(splitVatIncluded(12100, 21)).toEqual({ vatRate: 21, taxBase: 10000, vatAmount: 2100 });
    expect(splitVatIncluded(10400, 4)).toEqual({ vatRate: 4, taxBase: 10000, vatAmount: 400 });
    expect(splitVatIncluded(500, 0)).toEqual({ vatRate: 0, taxBase: 500, vatAmount: 0 });
  });

  it('rechaza importes y tipos no válidos', () => {
    expect(() => splitVatIncluded(-1, 10)).toThrow();
    expect(() => splitVatIncluded(1.5, 10)).toThrow();
    expect(() => splitVatIncluded(100, -1)).toThrow();
    expect(() => splitVatIncluded(100, Number.NaN)).toThrow();
    expect(() => splitVatIncluded(100, 101)).toThrow();
  });
});

describe('sumVat', () => {
  it('base total + IVA total = total cobrado con muchas líneas', () => {
    const lineTotals = [2500, 1, 3999, 12345, 0, 7, 10999, 1000];
    const total = lineTotals.reduce((sum, value) => sum + value, 0);
    const totals = sumVat(lineTotals.map((value) => splitVatIncluded(value, 10)));
    expect(totals.taxBaseTotal + totals.vatTotal).toBe(total);
  });
});
