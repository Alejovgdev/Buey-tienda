// Permite usar desde scripts de Node los módulos de src/ que importan
// 'server-only' (ese paquete lanza fuera de los componentes de servidor de
// Next). Se carga con: npx tsx --import ./scripts/lib/stub-server-only.mjs …
import { register } from 'node:module';

const hooks = `
export async function resolve(specifier, context, next) {
  if (specifier === 'server-only') return { url: 'data:text/javascript,export {}', shortCircuit: true };
  return next(specifier, context);
}`;

register(`data:text/javascript,${encodeURIComponent(hooks)}`);
