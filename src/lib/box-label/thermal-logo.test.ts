import { readFile } from 'node:fs/promises';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { solidThermalPixels, THERMAL_LOGO_DOTS, THERMAL_LOGO_MM } from './thermal-logo';

describe('logo para impresión térmica', () => {
  it('convierte trazos transparentes en negro sólido, no en gris con alfa', () => {
    const pixels = new Uint8ClampedArray([255,255,255,0, 255,255,255,32, 255,255,255,64, 255,255,255,180]);
    expect(Array.from(solidThermalPixels(pixels))).toEqual([
      255,255,255,255, 255,255,255,255, 0,0,0,255, 0,0,0,255,
    ]);
  });

  it('conserva el blanco del fondo y el negro de un logo opaco y es idempotente', () => {
    const pixels = new Uint8ClampedArray([255,255,255,255, 0,0,0,255]);
    const once = solidThermalPixels(pixels).slice();
    expect(solidThermalPixels(pixels)).toEqual(once);
    expect(Array.from(once)).toEqual([255,255,255,255, 0,0,0,255]);
  });

  it('el recurso dedicado tiene 224 puntos, solo blanco/negro y ninguna transparencia', async () => {
    const bytes = await readFile('public/assets/images/logo-buey-thermal.png');
    const { data, info } = await sharp(bytes).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    expect(info.width).toBe(THERMAL_LOGO_DOTS);
    expect(info.height).toBe(THERMAL_LOGO_DOTS);
    expect(THERMAL_LOGO_DOTS / THERMAL_LOGO_MM).toBe(8);
    let black = 0;
    let opaque = true, monochrome = true;
    const colors = new Set<number>();
    for (let index = 0; index < data.length; index += 4) {
      colors.add(data[index]);
      monochrome &&= data[index + 1] === data[index] && data[index + 2] === data[index];
      opaque &&= data[index + 3] === 255;
      if (data[index] === 0) black++;
    }
    expect([...colors].sort((a, b) => a - b)).toEqual([0, 255]);
    expect(monochrome).toBe(true);
    expect(opaque).toBe(true);
    // Conserva trazo y huecos, sin un cuadrado negro ni un logo vacío.
    expect(black / (info.width * info.height)).toBeGreaterThan(0.1);
    expect(black / (info.width * info.height)).toBeLessThan(0.5);
  });
});
