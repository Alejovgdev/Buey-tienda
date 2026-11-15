// Paso 8. Ayudas de las facturas rectificativas que usan a la vez el panel
// (navegador) y la API. Sin dependencias de servidor.
//
// La BD (issue_corrective_invoice, migración 0029) vuelve a comprobarlo todo:
// esto solo sirve para avisar antes y validar la petición.

export type CorrectiveKind = 'TOTAL' | 'PARTIAL';

export const CORRECTIVE_REASON_MAX = 300;

/** Importe máximo de una devolución parcial (100.000 €), solo como freno a errores de tecleo. */
const MAX_AMOUNT_CENTS = 10_000_000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * "10", "10,5", "10,50" o "10.50" → céntimos. null si no es un importe
 * positivo con como mucho dos decimales.
 */
export function parseEurosToCents(input: string): number | null {
  const value = input.trim().replace(/\s|€/g, '');
  const match = /^(\d{1,7})(?:[.,](\d{1,2}))?$/.exec(value);
  if (!match) return null;
  const cents = Number(match[1]) * 100 + Number((match[2] ?? '').padEnd(2, '0'));
  return cents > 0 && cents <= MAX_AMOUNT_CENTS ? cents : null;
}

type InvoiceForBalance = { invoiceType: string; total: number; invoiceNumber: string; status?: string };

export type CorrectiveBalance = {
  originalNumber: string;
  originalTotal: number;
  /** Ya devuelto con rectificativas (positivo). */
  refunded: number;
  remaining: number;
};

/**
 * Lo que queda por rectificar de la factura vigente del pedido. La vigente es
 * la última simplificada o completa no sustituida (hoy, siempre la T).
 * null si el pedido no tiene factura vigente.
 */
export function correctiveBalance(invoices: InvoiceForBalance[]): CorrectiveBalance | null {
  const original = [...invoices]
    .reverse()
    .find((invoice) => (invoice.invoiceType === 'SIMPLIFIED' || invoice.invoiceType === 'FULL') && invoice.status !== 'SUSTITUIDA');
  if (!original) return null;
  const refunded = invoices
    .filter((invoice) => invoice.invoiceType === 'CORRECTIVE')
    .reduce((sum, invoice) => sum - invoice.total, 0);
  return {
    originalNumber: original.invoiceNumber,
    originalTotal: original.total,
    refunded,
    remaining: Math.max(0, original.total - refunded),
  };
}

export type CorrectiveRequest = {
  kind: CorrectiveKind;
  amount: number | null;
  reason: string;
  requestId: string;
};

/** Valida el cuerpo de la petición del panel. */
export function parseCorrectiveRequest(body: unknown): { ok: true; value: CorrectiveRequest } | { ok: false; error: string } {
  if (typeof body !== 'object' || body === null) return { ok: false, error: 'Petición no válida' };
  const { kind, amount, reason, requestId } = body as Record<string, unknown>;

  if (kind !== 'TOTAL' && kind !== 'PARTIAL') return { ok: false, error: 'Elige «Devolver todo» o «Devolver una parte»' };
  if (typeof requestId !== 'string' || !UUID_RE.test(requestId)) return { ok: false, error: 'Petición no válida' };

  const text = typeof reason === 'string' ? reason.trim() : '';
  if (text === '') return { ok: false, error: 'Escribe el motivo' };
  if (text.length > CORRECTIVE_REASON_MAX) {
    return { ok: false, error: `El motivo no puede pasar de ${CORRECTIVE_REASON_MAX} caracteres` };
  }

  if (kind === 'TOTAL') return { ok: true, value: { kind, amount: null, reason: text, requestId } };

  if (typeof amount !== 'number' || !Number.isSafeInteger(amount) || amount <= 0 || amount > MAX_AMOUNT_CENTS) {
    return { ok: false, error: 'Escribe un importe válido' };
  }
  return { ok: true, value: { kind, amount, reason: text, requestId } };
}

/** Base e IVA de un importe con IVA incluido, redondeando al céntimo (como la BD). */
export function splitVat(amount: number, vatRate: number): { taxBase: number; vat: number } {
  const taxBase = Math.round((amount * 100) / (100 + vatRate));
  return { taxBase, vat: amount - taxBase };
}
