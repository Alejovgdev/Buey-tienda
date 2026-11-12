// No conservar mensajes, causas o cabeceras del proveedor en errores públicos.
export class CatalogQueryError extends Error {
  constructor() {
    super('No se ha podido consultar el catálogo temporalmente.');
    this.name = 'CatalogQueryError';
  }
}

export async function queryCatalog<T extends { error: unknown }>(query: PromiseLike<T>): Promise<T> {
  try {
    const result = await query;
    if (result.error) throw new CatalogQueryError();
    return result;
  } catch {
    throw new CatalogQueryError();
  }
}

// El recuento permite detectar una respuesta truncada incluso si el límite de
// filas del proveedor es menor que el tamaño solicitado. Un fallo nunca devuelve
// las páginas ya leídas como si fueran el catálogo completo.
export async function readAllCatalogRows<T>(
  readPage: (from: number, to: number) => PromiseLike<{
    data: T[] | null;
    count: number | null;
    error: unknown;
  }>
): Promise<T[]> {
  const rows: T[] = [];
  let total: number | undefined;

  do {
    const { data, count } = await queryCatalog(readPage(rows.length, rows.length + 499));
    if (!data || count === null || !Number.isSafeInteger(count) || count < 0) {
      throw new CatalogQueryError();
    }
    if (total !== undefined && total !== count) throw new CatalogQueryError();
    total = count;
    if ((data.length === 0 && rows.length < total) || rows.length + data.length > total) {
      throw new CatalogQueryError();
    }
    rows.push(...data);
  } while (rows.length < total);

  return rows;
}
