import type { BoxLabelSnapshot } from './schema';
import { BOX_LABEL_AREA_WIDTH_MM, BOX_LABEL_CONTENT_WIDTH_MM, paginateBoxLabel, type BoxLabelFragment, type BoxLabelPaper, type BoxLabelSheet } from './pagination';

export async function waitForBoxLabelResources(document: Document) {
  await document.fonts.ready;
  await Promise.all(Array.from(document.images).map(async (image) => {
    await image.decode();
    if (!image.naturalWidth) throw new Error('No se pudo cargar el logo');
  }));
  await new Promise<void>((resolve) => document.defaultView!.requestAnimationFrame(() => {
    document.defaultView!.requestAnimationFrame(() => resolve());
  }));
}

export function measureBoxLabel(document: Document, snapshot: BoxLabelSnapshot, paper: BoxLabelPaper): BoxLabelSheet[] {
  const sheet = document.querySelector<HTMLElement>('.box-sheet')!;
  const header = sheet.querySelector<HTMLElement>('.box-header')!;
  const footer = sheet.querySelector<HTMLElement>('.box-footer')!;
  const template = sheet.querySelector<HTMLElement>('.box-row')!;
  const pxPerMm = sheet.getBoundingClientRect().width / BOX_LABEL_AREA_WIDTH_MM;
  // Reserva el espacio del contador con seis dígitos para que numerar las
  // continuaciones no cambie las medidas obtenidas en la primera página.
  // Medir un clon: modificar nodos gestionados por React impediría que la
  // primera página actualizase después el total de continuaciones.
  const headerProbe = header.cloneNode(true) as HTMLElement;
  headerProbe.style.position = 'absolute';
  headerProbe.style.width = `${BOX_LABEL_CONTENT_WIDTH_MM}mm`;
  headerProbe.style.left = '-10000px';
  headerProbe.querySelector('.box-number')?.remove();
  document.body.append(headerProbe);
  const styles = document.defaultView!.getComputedStyle(sheet);
  const footerStyles = document.defaultView!.getComputedStyle(footer);
  const extra = (value: string) => Number.parseFloat(value) || 0;
  // Medidas reales de padding y márgenes, más 1 mm para redondeo/paginación.
  // No medir la altura mínima de la vista previa como si fuese contenido.
  const baseOverhead = footer.getBoundingClientRect().height
    + extra(styles.paddingTop) + extra(styles.paddingBottom)
    + extra(footerStyles.marginTop) + extra(footerStyles.marginBottom) + pxPerMm;
  let overhead = headerProbe.getBoundingClientRect().height + baseOverhead;
  const probe = template.cloneNode(true) as HTMLElement;
  probe.style.position = 'absolute';
  probe.style.width = `${BOX_LABEL_CONTENT_WIDTH_MM}mm`;
  probe.style.left = '-10000px';
  document.body.append(probe);
  try {
    const measure = (fragment: BoxLabelFragment) => {
      probe.querySelector<HTMLElement>('.box-description')!.textContent = fragment.text;
      probe.querySelector<HTMLElement>('.box-quantity')!.textContent = `× ${fragment.line.quantity}`;
      probe.querySelector<HTMLElement>('.box-gift')!.style.display = fragment.line.isGift ? 'block' : 'none';
      probe.querySelector<HTMLElement>('.box-continued')!.style.display = fragment.continued ? 'block' : 'none';
      return probe.getBoundingClientRect().height;
    };
    let pages = paginateBoxLabel(snapshot.lines, paper.maxHeightMm * pxPerMm - overhead, measure);
    // Los tickets de una hoja no llevan contador ni reservan su espacio.
    // Solo si hacen falta continuaciones se recalcula con la numeración.
    if (pages.length > 1) {
      const number = document.createElement('div');
      number.className = 'box-number';
      number.textContent = 'Página 000000 de 000000';
      headerProbe.append(number);
      overhead = headerProbe.getBoundingClientRect().height + baseOverhead;
      pages = paginateBoxLabel(snapshot.lines, paper.maxHeightMm * pxPerMm - overhead, measure);
    }
    return pages.map((fragments) => ({
      fragments,
      heightMm: paper.mode === 'fixed' ? paper.maxHeightMm
        : Math.ceil((overhead + fragments.reduce((sum, fragment) => sum + measure(fragment), 0)) / pxPerMm),
    }));
  } finally {
    probe.remove();
    headerProbe.remove();
  }
}

export function verifyBoxLabelLayout(document: Document, sheets: BoxLabelSheet[]) {
  const nodes = Array.from(document.querySelectorAll<HTMLElement>('.box-sheet'));
  if (!nodes.length || nodes.length !== sheets.length) throw new Error('La paginación todavía no está renderizada');
  nodes.forEach((node, index) => {
    const rect = node.getBoundingClientRect();
    const footer = node.querySelector<HTMLElement>('.box-footer')!;
    const padding = Number.parseFloat(document.defaultView!.getComputedStyle(node).paddingBottom) || 0;
    const consumed = footer.getBoundingClientRect().bottom - rect.top + padding;
    if (consumed > sheets[index].heightMm * rect.width / BOX_LABEL_AREA_WIDTH_MM + 0.5) throw new Error('El contenido supera la longitud calculada');
  });
}
