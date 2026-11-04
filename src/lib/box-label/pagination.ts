import type { BoxLabelLine } from './schema';

export interface BoxLabelFragment { line: BoxLabelLine; text: string; continued: boolean }
export interface BoxLabelSheet { fragments: BoxLabelFragment[]; heightMm: number }
export interface BoxLabelPaper { mode: 'content' | 'fixed'; maxHeightMm: number }
// POS-80-Series denomina el rollo de 80 mm, pero sus formularios comunican
// unos 72,1 mm de ancho lógico a Windows. 68 mm + 2 mm a cada lado caben ahí.
export const BOX_LABEL_AREA_WIDTH_MM = 72;
export const BOX_LABEL_CONTENT_WIDTH_MM = 68;
// Coincide con el formulario Thermal Paper (80 × 210) de POS-80-Series.
export const DEFAULT_BOX_LABEL_PAPER: BoxLabelPaper = { mode: 'content', maxHeightMm: 210 };

export function lineText(line: BoxLabelLine) {
  return line.productName + (line.variantName ? `\n${line.variantName}` : '');
}

// Las medidas las proporciona el DOM real tras cargar fuentes e imagen.
// Un nombre más alto que una página se divide sin perder caracteres. No se
// reduce la fuente ni se recorta el texto para que quepa.
export function paginateBoxLabel(
  lines: BoxLabelLine[], capacity: number,
  measure: (fragment: BoxLabelFragment) => number
): BoxLabelFragment[][] {
  if (capacity <= 0 || !Number.isFinite(capacity)) throw new Error('Aumenta la longitud del papel');
  const pages: BoxLabelFragment[][] = [];
  let current: BoxLabelFragment[] = [];
  let used = 0;
  const flush = () => { if (current.length) pages.push(current); current = []; used = 0; };
  for (const line of lines) {
    let remaining = lineText(line);
    let continued = false;
    while (remaining.length) {
      const fragment = { line, text: remaining, continued };
      const height = measure(fragment);
      if (!Number.isFinite(height) || height <= 0) throw new Error('No se pudo medir el ticket');
      if (height <= capacity - used) {
        current.push(fragment); used += height; remaining = ''; continue;
      }
      // Conservar una línea que cabe entera en la siguiente página. Si ya
      // necesita continuaciones, aprovechar también el espacio restante.
      if (current.length && height <= capacity) { flush(); continue; }
      const available = capacity - used;
      const characters = Array.from(remaining);
      let low = 0, high = characters.length;
      while (low < high) {
        const middle = Math.ceil((low + high) / 2);
        if (measure({ ...fragment, text: characters.slice(0, middle).join('') }) <= available) low = middle;
        else high = middle - 1;
      }
      if (!low) {
        if (current.length) { flush(); continue; }
        throw new Error('La cabecera y el pie no dejan espacio. Aumenta la longitud del papel.');
      }
      current.push({ ...fragment, text: characters.slice(0, low).join('') });
      remaining = characters.slice(low).join('');
      continued = true;
      flush();
    }
  }
  flush();
  return pages;
}
