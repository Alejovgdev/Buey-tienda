import { describe, expect, it } from 'vitest';
import { suggestPackageCount } from './label-package-suggestion';

describe('suggestPackageCount', () => {
  it('sugiere un envase por unidad vendida cuando el producto no agrupa unidades (chuletón)', () => {
    // 2 chuletones sueltos, quantity=2, suggested_package_count=1 -> 2 envases sugeridos
    expect(suggestPackageCount(2, 1)).toBe(2);
  });

  it('sugiere un único envase cuando el pack completo ya es una unidad de venta (pack de hamburguesas)', () => {
    // "Pack 4 uds." vendido como quantity=1, suggested_package_count=1 -> 1 envase
    expect(suggestPackageCount(1, 1)).toBe(1);
  });

  it('multiplica cantidad × envases-por-unidad cuando el producto lo declara así', () => {
    expect(suggestPackageCount(3, 2)).toBe(6);
  });

  it('nunca sugiere menos de 1 envase, incluso con datos inválidos', () => {
    expect(suggestPackageCount(0, 1)).toBe(1);
    expect(suggestPackageCount(-5, 1)).toBe(1);
    expect(suggestPackageCount(2, 0)).toBe(2);
    expect(suggestPackageCount(2, -3)).toBe(2);
  });

  it('redondea hacia abajo cantidades no enteras en vez de fallar', () => {
    expect(suggestPackageCount(2.9, 1)).toBe(2);
  });
});
