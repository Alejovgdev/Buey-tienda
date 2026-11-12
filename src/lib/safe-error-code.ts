// Los errores de transporte/proveedores pueden incluir cabeceras, URLs y PII.
// Conservar solo códigos PostgreSQL/PostgREST; nunca mensajes, stacks o causas.
export function safeErrorCode(error: unknown): string {
  const code = error && typeof error === 'object' && 'code' in error ? error.code : null;
  return typeof code === 'string' && /^(?:[0-9]{2}[0-9A-Z]{3}|PGRST[0-9]{3})$/.test(code)
    ? code
    : 'UNAVAILABLE';
}
