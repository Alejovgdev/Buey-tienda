import { describe, expect, it } from 'vitest';
import { CatalogQueryError, queryCatalog, readAllCatalogRows } from './catalog-query';

describe('consultas de catálogo', () => {
  it('conserva la ausencia real y las listas realmente vacías', async () => {
    expect((await queryCatalog(Promise.resolve({ data: null, error: null }))).data).toBeNull();
    expect((await queryCatalog(Promise.resolve({ data: [], error: null }))).data).toEqual([]);
  });

  it('un error del proveedor no se convierte en ausencia ni expone sus detalles', async () => {
    const result = queryCatalog(Promise.resolve({ data: null, error: { message: 'Bearer secret-sentinel' } }));
    await expect(result).rejects.toBeInstanceOf(CatalogQueryError);
    await expect(result).rejects.not.toThrow('secret-sentinel');
  });

  it('un fallo de transporte produce el mismo error temporal sin filtrar su causa', async () => {
    const result = queryCatalog(Promise.reject(new Error('private-provider-url-sentinel')));
    await expect(result).rejects.toBeInstanceOf(CatalogQueryError);
    await expect(result).rejects.not.toThrow('private-provider-url-sentinel');
  });
});

describe('lectura completa del catálogo para sitemap', () => {
  it('recupera todas las filas aunque el proveedor imponga un límite menor', async () => {
    const all = Array.from({ length: 1001 }, (_, id) => ({ id }));
    const result = await readAllCatalogRows((from, to) => Promise.resolve({
      data: all.slice(from, Math.min(to + 1, from + 100)), count: all.length, error: null,
    }));
    expect(result).toEqual(all);
  });

  it('acepta un catálogo realmente vacío', async () => {
    expect(await readAllCatalogRows(() => Promise.resolve({ data: [], count: 0, error: null }))).toEqual([]);
  });

  it('no devuelve las filas anteriores cuando falla una página posterior', async () => {
    await expect(readAllCatalogRows(from => Promise.resolve(from === 0
      ? { data: [{ id: 1 }], count: 2, error: null }
      : { data: null, count: null, error: { message: 'temporary failure' } }
    ))).rejects.toBeInstanceOf(CatalogQueryError);
  });

  it('rechaza un recuento que cambia durante la lectura', async () => {
    await expect(readAllCatalogRows(from => Promise.resolve({
      data: [{ id: from }], count: from === 0 ? 2 : 3, error: null,
    }))).rejects.toBeInstanceOf(CatalogQueryError);
  });

  for (const response of [
    { data: [], count: 1, error: null },
    { data: null, count: 0, error: null },
    { data: [], count: null, error: null },
    { data: [{ id: 1 }], count: 0, error: null },
  ]) {
    it(`rechaza una respuesta incompleta: ${JSON.stringify(response)}`, async () => {
      await expect(readAllCatalogRows(() => Promise.resolve(response))).rejects.toBeInstanceOf(CatalogQueryError);
    });
  }
});
