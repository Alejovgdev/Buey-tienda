import fs from 'node:fs/promises';
import sharp from 'sharp';

// Logo de la cabecera de los emails, generado del original de la marca, sin red.
// 240 px de ancho (se muestra a 120 px: nítido en pantallas de alta densidad).
// Se aplana sobre el blanco de la tarjeta del email: sin transparencia, el
// contorno oscuro sigue viéndose aunque el cliente de correo oscurezca el fondo.
const source = 'public/assets/images/logo-buey-ticket-source.png';
const target = 'public/assets/images/logo-buey-email.png';
await sharp(source)
  .resize({ width: 240 })
  .flatten({ background: '#ffffff' })
  .png({ palette: true, colours: 64, compressionLevel: 9 })
  .toFile(target);
const { width, height } = await sharp(target).metadata();
console.log(JSON.stringify({ source, target, width, height, bytes: (await fs.stat(target)).size }));
