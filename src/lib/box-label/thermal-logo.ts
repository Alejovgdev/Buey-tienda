// 28 mm a 8 puntos/mm (203 dpi): un píxel del recurso por punto térmico.
export const THERMAL_LOGO_DOTS = 224;
export const THERMAL_LOGO_MM = 28;
const MINIMUM_INK_COVERAGE = 64;

export function solidThermalPixels(pixels: Uint8ClampedArray) {
  // El original es un dibujo claro sobre transparencia. brightness(0)
  // conservaba el alfa y dejaba sus trazos grises. En una copia ya opaca
  // se usa la luminancia para conservar también el fondo blanco.
  let transparent = false;
  for (let index = 3; index < pixels.length; index += 4) {
    if (pixels[index] < 255) { transparent = true; break; }
  }
  for (let index = 0; index < pixels.length; index += 4) {
    const coverage = transparent ? pixels[index + 3]
      : 255 - (0.2126 * pixels[index] + 0.7152 * pixels[index + 1] + 0.0722 * pixels[index + 2]);
    const value = coverage >= MINIMUM_INK_COVERAGE ? 0 : 255;
    pixels[index] = pixels[index + 1] = pixels[index + 2] = value;
    pixels[index + 3] = 255;
  }
  return pixels;
}

// También prepara los logos de snapshots antiguos sin modificar sus datos:
// mismos trazos, negro/blanco opacos, sin consultar el catálogo ni otro logo.
export async function prepareThermalLogo(source: string, document: Document) {
  const image = document.createElement('img');
  image.src = source;
  await image.decode();
  if (!image.naturalWidth || !image.naturalHeight) throw new Error('No se pudo cargar el logo');
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = THERMAL_LOGO_DOTS;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) throw new Error('No se pudo preparar el logo térmico');
  const scale = Math.min(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
  const width = image.naturalWidth * scale, height = image.naturalHeight * scale;
  context.drawImage(image, (canvas.width - width) / 2, (canvas.height - height) / 2, width, height);
  const data = context.getImageData(0, 0, canvas.width, canvas.height);
  solidThermalPixels(data.data);
  context.putImageData(data, 0, 0);
  return canvas.toDataURL('image/png');
}
