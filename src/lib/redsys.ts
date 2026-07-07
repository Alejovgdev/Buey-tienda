import 'server-only';
import { createRedsysAPI, SANDBOX_URLS, PRODUCTION_URLS } from 'redsys-easy';

// Fase 4, sección 15. Librería elegida: redsys-easy (MIT, activamente mantenida —
// verificado con `npm view`/`npm pack` antes de fijarla: 31 versiones publicadas,
// última hace ~5 meses, sin deprecar). Hace el cálculo de firma HMAC-SHA256 y el
// cifrado 3DES del Ds_MerchantParameters; no se implementa a mano.
//
// No se usan los "formatters" opcionales del paquete (redirectInputFormatter,
// etc.): esos esperan importes en string decimal ('33.5') y currency como 'EUR'.
// Este proyecto ya trabaja en céntimos ('3350') y currency numérica ISO-4217
// ('978'), que es justo el formato que las funciones base ya esperan.
export const redsys = createRedsysAPI({
  secretKey: process.env.REDSYS_SECRET_KEY!,
  urls: process.env.REDSYS_ENVIRONMENT === 'production' ? PRODUCTION_URLS : SANDBOX_URLS,
});
