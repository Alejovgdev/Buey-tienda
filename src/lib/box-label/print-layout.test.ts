import { describe, expect, it, vi } from 'vitest';
import { waitForBoxLabelResources } from './print-layout';

describe('espera de recursos antes de imprimir', () => {
  it('espera fuentes, decodificación del logo y dos renderizados antes de continuar', async () => {
    let finishFonts!: () => void;
    let finishImage!: () => void;
    const frames: (() => void)[] = [];
    const decode = vi.fn(() => new Promise<void>((resolve) => { finishImage = resolve; }));
    const document = {
      fonts: { ready: new Promise<void>((resolve) => { finishFonts = resolve; }) },
      images: [{ decode, naturalWidth: 240 }],
      defaultView: { requestAnimationFrame: (callback: () => void) => frames.push(callback) },
    } as unknown as Document;
    let done = false;
    const waiting = waitForBoxLabelResources(document).then(() => { done = true; });
    expect(decode).not.toHaveBeenCalled();
    finishFonts(); await Promise.resolve();
    expect(decode).toHaveBeenCalledOnce();
    expect(done).toBe(false);
    finishImage();
    // Promesas de decode y Promise.all antes del primer frame.
    await vi.waitFor(() => expect(frames).toHaveLength(1));
    frames.shift()!();
    expect(done).toBe(false);
    expect(frames).toHaveLength(1);
    frames.shift()!();
    await waiting;
    expect(done).toBe(true);
  });

  it('no permite continuar con un logo que no se pudo cargar', async () => {
    const document = {
      fonts: { ready: Promise.resolve() }, images: [{ decode: async () => undefined, naturalWidth: 0 }],
    } as unknown as Document;
    await expect(waitForBoxLabelResources(document)).rejects.toThrow('No se pudo cargar el logo');
  });
});
