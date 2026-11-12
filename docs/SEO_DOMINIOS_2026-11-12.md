# Indexación limitada al sitio definitivo

Implementado en `next.config.ts`, sin cambios de middleware, autenticación,
metadatos, JSON-LD, robots, sitemap, pagos o URL operativas. No se han cambiado
servicios remotos ni desplegado ningún build.

## Comportamiento

| Petición recibida | Resultado de la aplicación |
| --- | --- |
| `www.restauranteelbueymadurado.com`, página pública indexable | Sin cabecera `noindex` |
| `restauranteelbueymadurado.com`, página pública | Mismo tratamiento del sitio definitivo; canonical con `www` |
| `buey-tienda.vercel.app`, preview o cualquier otro hostname | `X-Robots-Tag: noindex` |
| Carrito, checkout, confirmación y `/admin/:path*`, en cualquier dominio | `X-Robots-Tag: noindex`, conservando sus metadatos `noindex` |

La condición se evalúa por **Host en cada petición**, mediante `missing` de tipo
`host` de Next.js. Solo se admiten los dos nombres exactos del sitio definitivo.
Next compara el hostname completo, en minúsculas y sin el puerto; un subdominio
de pruebas o un sufijo parecido no pasa la condición. No se lee `NODE_ENV`,
`VERCEL_ENV`, `X-Forwarded-Host` ni el origen operativo de pagos para decidir.

No se añade una cabecera global `index` que pueda contradecir las exclusiones
de las páginas operativas. Las reglas que coinciden en una ruta privada emiten
una única cabecera `noindex` en la producción local comprobada.

Todos los canonical, identificadores/URL de JSON-LD y URL del sitemap siguen
apuntando a `https://www.restauranteelbueymadurado.com`, sin parámetros. El
catálogo y su sitemap mantienen sus consultas actuales y su frescura.

`robots.txt` continúa permitiendo `/` y bloqueando únicamente `/api/`. Carrito,
checkout, confirmación y login pueden rastrearse para leer sus directivas. El
control de acceso administrativo permanece en sus comprobaciones existentes.

## Validación local

`node scripts/check-seo-production.mjs` compila una copia temporal sin `.env`,
con dependencias existentes, credenciales ficticias y datos simulados en una
API de solo lectura en loopback. No sustituye el `.next` de trabajo.

Se conecta exclusivamente a `127.0.0.1`, enviando el Host virtual con `node:http`.
Esto importa porque el `fetch` de Node usado en este entorno sustituye un Host
personalizado por el de la URL de conexión. No se ha contactado con los dominios
reales para simular las peticiones.

Resultados:

- **432 respuestas HTTP** comprobadas. El mismo build se sirve primero con
  `VERCEL_ENV=production` y después con `VERCEL_ENV=preview`; `NODE_ENV=production`
  en ambos. La decisión por dominio es idéntica sin recompilar.
- Páginas públicas del restaurante, legales, tienda, categoría y producto,
  tanto limpias como con parámetros. Se comparan títulos, descripciones, H1,
  canonical y JSON-LD entre dominios; permanecen iguales.
- Dominio definitivo con y sin `www`, alias de producción `buey-tienda.vercel.app`,
  preview y dominio personalizado de pruebas. También subdominio de pruebas,
  sufijos parecidos, mayúsculas, puerto, punto final, localhost y loopback.
- Alternancia de dominios sobre páginas estáticas y dinámicas, GET y HEAD,
  parámetros, recurso público, sitemap XML y robots. Se verifica ausencia de
  cabeceras `noindex` en páginas públicas finales y presencia única donde procede.
- `X-Forwarded-Host` no cambia la decisión tomada por el Host recibido.
- Administración sin cookie o con cookie inválida conserva su redirección 307
  a login; una sesión firmada solo con la clave ficticia local permite leer el
  listado vacío y mantiene `noindex, nofollow`. No se inicia una sesión remota.
- **94 respuestas HTML** y las **101 fichas de Carta** de la regresión SEO anterior
  correctas, incluyendo cambios de datos sin recompilar y producto inexistente.
- TypeScript, sintaxis del script, compilación aislada y **256 pruebas Vitest**
  correctos. Permanecen los avisos previos de Next sobre middleware/Edge y región.

Informes ignorados por Git: `.seo-check.local/domains.json` y
`.seo-check.local/results.json`. El build temporal contiene un aviso de datos
ficticios y **no debe publicarse**. No se han creado pedidos, ejecutado pagos o
enviado correos.

## Configuración y comprobación pendiente en Vercel

La cabecera no requiere variables de entorno nuevas ni una lista manual de
previews: cualquier hostname distinto de los dos definitivos queda excluido.
Vercel añade su propia cabecera a determinadas URLs de despliegue, pero no
siempre a previews servidas mediante dominios personalizados; la regla del
proyecto cubre también esos dominios.

La preferencia de redirección **sin `www` → `www`** se conserva como configuración
del alojamiento. En el repositorio no existía una redirección entre dominios
(`vercel.json` solo declara la región), por lo que no se ha añadido otra que
pueda afectar a callbacks o peticiones operativas. **La producción local no
demuestra que la redirección ya esté configurada en Vercel.**

En Project Settings → Domains, comprobar que `www.restauranteelbueymadurado.com`
sirve el despliegue de Production y que `restauranteelbueymadurado.com` redirige
permanentemente a esa versión, conservando ruta y parámetros. Si ya está así,
no necesita cambios; si falta, queda pendiente configurarlo allí con autorización.
Conservar cualquier Deployment Protection o autenticación existente.

Cuando se autorice un despliegue normal, verificar las cabeceras efectivas con
GET/HEAD tanto en `www` como en `buey-tienda.vercel.app`, una preview y cualquier
dominio personalizado de pruebas. Confirmar también HTTPS y la redirección del
apex, y que la plataforma no añade un `noindex` inesperado a las páginas públicas
de `www`. Las respuestas generadas por el alojamiento antes de llegar a Next.js
dependen de su configuración y no se validan mediante `next start`.

Las URLs actualmente desplegadas no cambian hasta publicar esta configuración.
La retirada de URLs ya indexadas requiere que Google vuelva a rastrearlas y lea
la directiva; no se ha enviado ninguna petición a Search Console.

Referencias oficiales consultadas:
[cabeceras condicionales de Next.js](https://nextjs.org/docs/app/api-reference/config/next-config-js/headers),
[noindex y acceso al rastreador](https://developers.google.com/search/docs/crawling-indexing/block-indexing),
[cabeceras de Vercel](https://vercel.com/docs/headers/response-headers) y
[dominio principal y redirección](https://vercel.com/docs/domains/working-with-domains/deploying-and-redirecting).
