import { inflateSync } from 'node:zlib';

// Métricas de los PDF emitidos por Chrome en la prueba de impresión. Lee la
// posición del primer XObject (logo) de cada página, incluidas las matrices
// de colocación del contenido sobre el papel seleccionado en el controlador.
export function boxLabelPdfMetrics(bytes) {
  const text = bytes.toString('latin1');
  const objects = new Map(Array.from(text.matchAll(/(\d+) 0 obj\b([\s\S]*?)endobj/g), (match) => [match[1], match[2]]));
  const multiply = (a, b) => [
    a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5],
  ];
  return [...objects.values()].filter((value) => /\/Type\s*\/Page\b/.test(value)).map((page) => {
    const media = page.match(/\/MediaBox\s*\[([^\]]+)\]/)[1].trim().split(/\s+/).map(Number);
    const content = objects.get(page.match(/\/Contents\s+(\d+) 0 R/)[1]);
    const start = /stream\r?\n/.exec(content);
    const length = Number(content.match(/\/Length\s+(\d+)/)[1]);
    let stream = Buffer.from(content.slice(start.index + start[0].length, start.index + start[0].length + length), 'latin1');
    if (/\/FlateDecode/.test(content.slice(0, start.index))) stream = inflateSync(stream);
    const tokens = stream.toString('latin1').match(/\/[\w]+|[-+]?(?:\d*\.\d+|\d+)|[A-Za-z*]+/g);
    let matrix = [1, 0, 0, 1, 0, 0];
    const stack = [], operands = [];
    let logoTopMm = null;
    let logoLeftMm = null, logoRightMm = null;
    for (const token of tokens) {
      if (/^[-+]?(?:\d*\.\d+|\d+)$/.test(token)) { operands.push(Number(token)); continue; }
      if (token.startsWith('/')) continue;
      if (token === 'q') stack.push([...matrix]);
      else if (token === 'Q') matrix = stack.pop() ?? matrix;
      else if (token === 'cm') matrix = multiply(matrix, operands.slice(-6));
      else if (token === 'Do') {
        const ys = [matrix[5], matrix[1] + matrix[5], matrix[3] + matrix[5], matrix[1] + matrix[3] + matrix[5]];
        logoTopMm = (media[3] - Math.max(...ys)) * 25.4 / 72;
        const xs = [matrix[4], matrix[0] + matrix[4], matrix[2] + matrix[4], matrix[0] + matrix[2] + matrix[4]];
        logoLeftMm = Math.min(...xs) * 25.4 / 72;
        logoRightMm = Math.max(...xs) * 25.4 / 72;
        break;
      }
      operands.length = 0;
    }
    return { widthMm: media[2] * 25.4 / 72, heightMm: media[3] * 25.4 / 72, logoTopMm, logoLeftMm, logoRightMm };
  });
}
