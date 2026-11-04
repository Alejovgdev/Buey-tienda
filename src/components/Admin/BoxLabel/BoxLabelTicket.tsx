import type { BoxLabelSnapshot } from '@/lib/box-label/schema';
import { BOX_LABEL_AREA_WIDTH_MM, type BoxLabelSheet } from '@/lib/box-label/pagination';
import type { CSSProperties } from 'react';
import { THERMAL_LOGO_MM } from '@/lib/box-label/thermal-logo';

export const BOX_LABEL_CSS = `
  * { box-sizing: border-box; }
  @page { size: auto; margin: 0; }
  html, body { display: block; position: static; margin: 0; padding: 0; width: 100%; max-width: 80mm;
    height: auto; min-height: 0; background: white; color: black; }
  body { font: 11pt/1.3 Arial, Helvetica, sans-serif; }
  .box-sheet { display: block; position: static; width: ${BOX_LABEL_AREA_WIDTH_MM}mm; height: auto; min-height: 0;
    padding: 2mm; margin: 0 auto; break-after: page; page-break-after: always; }
  .box-sheet:last-child { break-after: auto; page-break-after: auto; }
  .box-header { text-align: center; padding-bottom: 2mm; border-bottom: 0.3mm solid black; }
  .box-header img { display: block; width: ${THERMAL_LOGO_MM}mm; height: ${THERMAL_LOGO_MM}mm;
    object-fit: contain; margin: 0 auto 1mm; opacity: 1; filter: none; image-rendering: pixelated; }
  .box-brand { font-size: 10pt; font-weight: bold; }
  .box-order { font-size: 12pt; font-weight: bold; margin-top: 2mm; overflow-wrap: anywhere; }
  .box-number { font-size: 9pt; margin-top: 1mm; }
  .box-row { display: grid; grid-template-columns: minmax(0, 1fr) 12mm; gap: 2mm;
    padding: 2mm 0; border-bottom: 0.2mm solid black; break-inside: avoid; }
  .box-description { white-space: pre-wrap; overflow-wrap: anywhere; }
  .box-quantity { font-size: 12pt; font-weight: bold; text-align: right; overflow-wrap: anywhere; }
  .box-gift, .box-continued { font-size: 9pt; font-weight: bold; }
  .box-footer { margin-top: 2mm; font-size: 10pt; overflow-wrap: anywhere; }
  @media screen { .box-sheet { min-height: var(--box-preview-height); box-shadow: inset 0 0 0 1px #ddd; margin-bottom: 8px; } }
  @media print {
    html, body { height: auto !important; min-height: 0 !important; print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    .box-sheet { height: auto !important; min-height: 0 !important; margin: 0 auto; box-shadow: none; overflow: visible; page: auto; }
  }
`;

export default function BoxLabelTicket({ snapshot, sheets, logoDataUrl }: {
  snapshot: BoxLabelSnapshot; sheets: BoxLabelSheet[]; logoDataUrl?: string;
}) {
  return <>
    <style>{BOX_LABEL_CSS}</style>
    {/* size:auto respeta el papel del controlador. Solicitar aquí una página
        corta hacía que Chrome la centrase sobre el formulario de 80 × 210.
        La altura calculada solo dimensiona la previsualización; no se impone
        como altura física ni como espacio vacío dentro del documento impreso. */}
    {sheets.map((sheet, index) => (
      <section className="box-sheet" key={index} data-height-mm={sheet.heightMm}
        style={{ '--box-preview-height': `${sheet.heightMm}mm` } as CSSProperties}>
        <header className="box-header">
          {/* PNG local incorporado en el snapshot: no depende de una descarga al imprimir. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoDataUrl ?? snapshot.logoDataUrl} alt="El Buey Madurado" width="224" height="224" />
          <div className="box-brand">EL BUEY MADURADO</div>
          <div className="box-order">Pedido {snapshot.orderNumber}</div>
          {sheets.length > 1 && <div className="box-number">Página {index + 1} de {sheets.length}</div>}
        </header>
        {sheet.fragments.map((fragment, fragmentIndex) => (
          <div className="box-row" data-line-id={fragment.line.id} key={`${fragment.line.id}-${fragmentIndex}`}>
            <div>
              <div className="box-continued" style={{ display: fragment.continued ? 'block' : 'none' }}>Continuación</div>
              <div className="box-description">{fragment.text}</div>
              <div className="box-gift" style={{ display: fragment.line.isGift ? 'block' : 'none' }}>Regalo</div>
            </div>
            <div className="box-quantity">× {fragment.line.quantity}</div>
          </div>
        ))}
        <footer className="box-footer">
          <div>Preparado por: {snapshot.preparedBy}</div>
          <div style={{ paddingTop: '1.3em', textAlign: 'center' }}>Gracias por tu pedido. ¡Que aproveche!</div>
        </footer>
      </section>
    ))}
  </>;
}
