import fs from 'node:fs/promises';
import sharp from 'sharp';
import { solidThermalPixels, THERMAL_LOGO_DOTS } from '../src/lib/box-label/thermal-logo.ts';

// Conversión determinista del recurso original de la marca, sin red ni IA.
const source = 'public/assets/images/logo-buey-ticket-source.png';
const target = 'public/assets/images/logo-buey-thermal.png';
const { data, info } = await sharp(source).ensureAlpha().resize(THERMAL_LOGO_DOTS, THERMAL_LOGO_DOTS, {
  fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 },
}).raw().toBuffer({ resolveWithObject: true });
const pixels = solidThermalPixels(new Uint8ClampedArray(data));
await sharp(Buffer.from(pixels), { raw: { width: info.width, height: info.height, channels: 4 } })
  .removeAlpha().png({ palette: true, colours: 2, dither: 0, compressionLevel: 9 }).toFile(target);
console.log(JSON.stringify({ source, target, bytes: (await fs.stat(target)).size, dots: THERMAL_LOGO_DOTS }));
