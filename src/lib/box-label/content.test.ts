import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { buildBoxLabelSnapshot, getBoxLabelGifts, type BoxLabelItem } from './content';
import { canPrepareBoxLabel } from './schema';
import { lineText, paginateBoxLabel, type BoxLabelFragment } from './pagination';
import BoxLabelTicket from '@/components/Admin/BoxLabel/BoxLabelTicket';

const logo = 'data:image/png;base64,AAAA';
const item: BoxLabelItem = {
  id: '11111111-1111-4111-8111-111111111111', product_variant_id: 'variant-1',
  product_name_snapshot: 'Chuletón madurado', variant_name_snapshot: '1 kg', quantity: 2, item_type: 'PRODUCT',
};
const gift: BoxLabelItem = { ...item, id: '22222222-2222-4222-8222-222222222222', product_variant_id: 'gift-variant',
  product_name_snapshot: 'Salsa de regalo', variant_name_snapshot: 'Tarro 100 g', quantity: 1, item_type: 'GIFT' };

describe('contenido de la caja', () => {
  it('usa referencia, nombres históricos, variante, cantidad y trabajador sin precios ni cliente', () => {
    const snapshot = buildBoxLabelSnapshot('BM-2026-00123', 'Ana', logo, [item, gift], [gift.id]);
    expect(snapshot.lines).toEqual([
      { id: item.id, productName: item.product_name_snapshot, variantName: '1 kg', quantity: 2, isGift: false },
      { id: gift.id, productName: gift.product_name_snapshot, variantName: 'Tarro 100 g', quantity: 1, isGift: true },
    ]);
    const html = renderToStaticMarkup(createElement(BoxLabelTicket, { snapshot, sheets: [{
      heightMm: 100, fragments: snapshot.lines.map((line) => ({ line, text: lineText(line), continued: false })),
    }] }));
    for (const text of ['Pedido BM-2026-00123', 'Chuletón madurado', '1 kg', '× 2', 'Salsa de regalo', 'Preparado por: Ana']) {
      expect(html).toContain(text);
    }
    expect(html).not.toMatch(/precio|subtotal|dirección|cliente|100mm 70mm/i);
    expect(html).not.toContain('Página 1 de 1');
    expect(html).not.toContain('<div class="box-number">');
    expect(html).toContain('padding: 2mm; margin: 0 auto');
    expect(html).toContain('width: 72mm');
    expect(html).toContain('filter: none');
    expect(html).toContain('@page { size: auto; margin: 0; }');
    expect(html).not.toContain('@page box');
    const sectionStyle = html.match(/<section[^>]*style="([^"]*)"/)?.[1];
    expect(sectionStyle).not.toMatch(/(^|;)(height|min-height):/);
  });

  it('no incluye un regalo pendiente de stock por defecto y permite seleccionarlo cuando esté realmente embalado', () => {
    const gifts = getBoxLabelGifts([item, gift], [{ event_type: 'PROMOCION_NO_APLICADA', metadata: {
      reason: 'SIN_STOCK_REGALO_EN_CONFIRMACION', gift_variant_id: gift.product_variant_id,
    } }]);
    expect(gifts[0]).toMatchObject({ pendingStock: true, included: false });
    expect(buildBoxLabelSnapshot('BM-1', 'Ana', logo, [item, gift], []).lines).toHaveLength(1);
    expect(buildBoxLabelSnapshot('BM-1', 'Ana', logo, [item, gift], [gift.id]).lines).toHaveLength(2);
  });

  it('mantiene los regalos entregados aunque no cuenten como canje o se agote el cupo', () => {
    const gifts = getBoxLabelGifts([gift], [
      { event_type: 'PROMOCION_NO_APLICADA', metadata: { reason: 'AGOTADA' } },
      { event_type: 'REGALO_ENTREGADO_SIN_CANJE_CONTADO', metadata: { gift_variant_id: gift.product_variant_id } },
    ]);
    expect(gifts[0]).toMatchObject({ pendingStock: false, included: true });
  });

  it('no aplica la falta de stock de otro regalo al regalo de esta línea', () => {
    expect(getBoxLabelGifts([gift], [{ event_type: 'PROMOCION_NO_APLICADA', metadata: {
      reason: 'SIN_STOCK_REGALO_EN_CONFIRMACION', gift_variant_id: 'otra-variante',
    } }])[0].included).toBe(true);
  });

  it('rechaza seleccionar un producto como regalo, IDs ajenos, duplicados y pedidos sin contenido', () => {
    for (const ids of [[item.id], ['33333333-3333-4333-8333-333333333333'], [gift.id, gift.id]]) {
      expect(() => buildBoxLabelSnapshot('BM-1', 'Ana', logo, [item, gift], ids)).toThrow();
    }
    expect(() => buildBoxLabelSnapshot('BM-1', 'Ana', logo, [], [])).toThrow();
  });

  it('solo permite preparar copias nuevas en PAID y PREPARING', () => {
    expect(canPrepareBoxLabel('PAID')).toBe(true);
    expect(canPrepareBoxLabel('PREPARING')).toBe(true);
    for (const status of ['CANCELLED', 'PENDING_PAYMENT', 'PAYMENT_FAILED', 'STOCK_ERROR', 'NEEDS_REVIEW']) {
      expect(canPrepareBoxLabel(status)).toBe(false);
    }
  });
});

describe('paginación sin pérdida de contenido', () => {
  const measure = (fragment: BoxLabelFragment) => Math.ceil(Array.from(fragment.text).length / 18) * 10
    + (fragment.continued ? 5 : 0) + (fragment.line.isGift ? 5 : 0) + 5;

  it('mantiene las líneas cortas completas y crea continuaciones con pedido y numeración', () => {
    const snapshot = buildBoxLabelSnapshot('BM-123', 'Ana', logo,
      Array.from({ length: 90 }, (_, index) => ({ ...item, id: `${String(index).padStart(8, '0')}-1111-4111-8111-111111111111` })), []);
    const pages = paginateBoxLabel(snapshot.lines, 70, measure);
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.flat().map((fragment) => fragment.line.id)).toEqual(snapshot.lines.map((line) => line.id));
    const html = renderToStaticMarkup(createElement(BoxLabelTicket, { snapshot,
      sheets: pages.map((fragments) => ({ fragments, heightMm: 100 })),
    }));
    expect(html.match(/Pedido BM-123/g)).toHaveLength(pages.length);
    expect(html).toContain(`Página ${pages.length} de ${pages.length}`);
  });

  it('divide incluso un nombre mayor que una página, conservando Unicode y todos los caracteres', () => {
    const snapshot = buildBoxLabelSnapshot('BM-1', 'Ana', logo, [{ ...item,
      product_name_snapshot: 'Vacuno 🐂 con nombre muy largo '.repeat(100), variant_name_snapshot: 'Formato especial '.repeat(30),
    }], []);
    const pages = paginateBoxLabel(snapshot.lines, 80, measure);
    expect(pages.length).toBeGreaterThan(10);
    expect(pages.flat().map((fragment) => fragment.text).join('')).toBe(lineText(snapshot.lines[0]));
    for (const page of pages) {
      expect(page.length).toBeGreaterThan(0);
      expect(page.reduce((sum, fragment) => sum + measure(fragment), 0)).toBeLessThanOrEqual(80);
      expect(page.every((fragment) => fragment.line.quantity === 2)).toBe(true);
    }
    expect(pages[1][0].continued).toBe(true);
  });

  it('falla explícitamente si no cabe ni un carácter en lugar de recortar o entrar en bucle', () => {
    const snapshot = buildBoxLabelSnapshot('BM-1', 'Ana', logo, [item], []);
    expect(() => paginateBoxLabel(snapshot.lines, 1, measure)).toThrow('Aumenta la longitud');
    expect(() => paginateBoxLabel(snapshot.lines, 0, measure)).toThrow();
  });

  it('aprovecha el resto de una página si un nombre necesita continuaciones de todos modos', () => {
    const snapshot = buildBoxLabelSnapshot('BM-1', 'Ana', logo, [
      { ...item, product_name_snapshot: 'Corto', variant_name_snapshot: '' },
      { ...item, id: gift.id, product_name_snapshot: 'Nombre muy extenso '.repeat(20), variant_name_snapshot: 'Formato' },
    ], []);
    const pages = paginateBoxLabel(snapshot.lines, 80, measure);
    expect(pages[0]).toHaveLength(2);
    expect(pages.flat().filter((fragment) => fragment.line.id === gift.id).map((fragment) => fragment.text).join(''))
      .toBe(lineText(snapshot.lines[1]));
    for (const page of pages) expect(page.reduce((sum, fragment) => sum + measure(fragment), 0)).toBeLessThanOrEqual(80);
  });
});
