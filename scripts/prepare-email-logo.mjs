import fs from 'node:fs/promises';
import sharp from 'sharp';

// Logo de la cabecera de los emails, generado del original de la marca, sin red.
// 240 px de ancho (se muestra a 120 px: nítido en pantallas de alta densidad).
// Conserva el fondo transparente del original. Paleta de 16 colores con canal
// alfa: a este tamaño no se distingue de 32 o más y pesa menos de la mitad.
const source = 'public/assets/images/logo-buey-ticket-source.png';
const target = 'public/assets/images/logo-buey-email.png';
await sharp(source)
  .resize({ width: 240 })
  .png({ palette: true, colours: 16, compressionLevel: 9, effort: 10 })
  .toFile(target);
const { width, height, channels } = await sharp(target).metadata();
console.log(JSON.stringify({ source, target, width, height, channels, bytes: (await fs.stat(target)).size }));
