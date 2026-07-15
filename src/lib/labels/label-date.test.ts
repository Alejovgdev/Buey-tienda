import { describe, expect, it } from 'vitest';
import { formatLabelDate } from './label-date';

describe('formatLabelDate', () => {
  it('formatea una fecha ISO (YYYY-MM-DD) a DD/MM/YYYY sin desplazamiento de zona horaria', () => {
    expect(formatLabelDate('2026-07-20')).toBe('20/07/2026');
  });

  it('acepta también un timestamp completo y usa solo la parte de fecha', () => {
    expect(formatLabelDate('2026-01-05T00:00:00.000Z')).toBe('05/01/2026');
  });

  it('devuelve un guion largo para valores ausentes', () => {
    expect(formatLabelDate(null)).toBe('—');
    expect(formatLabelDate(undefined)).toBe('—');
  });

  it('devuelve el valor original si no reconoce el formato', () => {
    expect(formatLabelDate('no-es-una-fecha')).toBe('no-es-una-fecha');
  });
});
