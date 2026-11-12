// Paso 3 (IVA). Desglose de importes con IVA incluido.
//
// Los precios de la tienda son siempre IVA incluido y no cambian: aquí solo se
// calcula qué parte de cada importe es base imponible y qué parte es cuota.
//
// Redondeo por línea, en céntimos enteros:
//   base = round(total / (1 + tipo/100))   (medio céntimo hacia arriba)
//   cuota = total - base                   (por resta, nunca base × tipo)
// Así base + cuota === total en cada línea, y los totales del pedido, que son
// sumas de líneas, cuadran al céntimo con el importe cobrado.
//
// Las líneas a 0 € (regalos y envío gratis) no llevan tipo: se guardan con
// tipo null, base 0 y cuota 0, para que no parezcan una operación exenta.

export type VatBreakdown = {
  vatRate: number | null;
  taxBase: number;
  vatAmount: number;
};

export type OrderVatTotals = {
  taxBaseTotal: number;
  vatTotal: number;
};

/** Tipo en puntos básicos (10 % → 1000) para operar solo con enteros. */
function toBasisPoints(vatRate: number): number {
  const basisPoints = Math.round(vatRate * 100);
  if (!Number.isFinite(vatRate) || basisPoints < 0 || basisPoints > 10000) {
    throw new Error(`Tipo de IVA no válido: ${vatRate}`);
  }
  return basisPoints;
}

/**
 * Desglosa un importe con IVA incluido (en céntimos). Un importe de 0 devuelve
 * tipo null, base 0 y cuota 0.
 */
export function splitVatIncluded(totalCents: number, vatRate: number): VatBreakdown {
  if (!Number.isSafeInteger(totalCents) || totalCents < 0) {
    throw new Error(`Importe no válido: ${totalCents}`);
  }
  const basisPoints = toBasisPoints(vatRate);
  if (totalCents === 0) {
    return { vatRate: null, taxBase: 0, vatAmount: 0 };
  }

  // round(total × 10000 / (10000 + bp)) con medio hacia arriba, en enteros:
  // floor((2 × total × 10000 + divisor) / (2 × divisor)).
  const divisor = 10000 + basisPoints;
  const taxBase = Math.floor((2 * totalCents * 10000 + divisor) / (2 * divisor));

  return { vatRate: basisPoints / 100, taxBase, vatAmount: totalCents - taxBase };
}

/** Suma las bases y cuotas de las líneas y del envío. */
export function sumVat(lines: VatBreakdown[]): OrderVatTotals {
  return lines.reduce(
    (totals, line) => ({
      taxBaseTotal: totals.taxBaseTotal + line.taxBase,
      vatTotal: totals.vatTotal + line.vatAmount,
    }),
    { taxBaseTotal: 0, vatTotal: 0 }
  );
}
