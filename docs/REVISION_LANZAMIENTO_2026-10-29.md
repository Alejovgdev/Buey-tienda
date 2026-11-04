# Revisión de lanzamiento — 29 de octubre de 2026

## Veredicto y alcance

La tienda tiene construido el núcleo del MVP, pero no está lista para abrir a ventas reales. Quedan correcciones de pagos, actualización de dependencias, información alimentaria, validación legal y puesta en producción.

Revisión del árbol de trabajo completo, incluidos los cambios sin commit, documentación histórica y consultas de solo lectura a la base configurada en `.env.local`. No se han creado pedidos, enviado emails, cobrado pagos ni modificado datos remotos. Los fallos deducidos del código se distinguen de las comprobaciones ejecutadas.

La base conectada coincide con el proyecto de desarrollo documentado en las auditorías anteriores. No se ha accedido al panel de Vercel, a la configuración bancaria de Redsys ni al panel de Resend. Sus configuraciones de producción siguen sin verificar. El dominio público devolvió un control de seguridad de Vercel con HTTP 429 a las peticiones directas de esta revisión; no permite confirmar por este método qué versión está publicada ni si funciona el checkout público.

## Lo que ya existe

- Catálogo por categorías, productos y variantes, imágenes, precios y disponibilidad.
- Carrito persistente, resumen y cálculo de transporte: 10 euros, gratuito desde 150 euros.
- Checkout como invitado, validación de servidor y recálculo de precios y stock desde la base de datos.
- Restricción por prefijos postales de Baleares, Canarias, Ceuta y Melilla.
- Integración Redsys: formulario firmado, notificación firmada y comprobación del importe.
- Descuento transaccional de stock con bloqueo de filas y gestión de regalos promocionales. La protección frente a duplicados tiene el defecto descrito en T1.
- Emails de confirmación y aviso interno con Resend.
- Panel protegido: pedidos, detalle, histórico, notas, incidencias y cambios de estado.
- Etiquetado alimentario: perfiles, configuración por producto, preparación, vista previa, impresión, reimpresión y registro de trabajador.
- Páginas legales, aceptación contractual con versión y fecha, y consentimiento comercial opcional e independiente.
- Gestión de consentimiento de cookies, carga condicional de Analytics y mapas.

La carencia histórica de interfaz de etiquetas (H-15 de julio) está resuelta en el código. No debe seguir tratándose como funcionalidad pendiente de desarrollar. Su validación alimentaria y operativa es otra tarea.

## Comprobaciones ejecutadas

| Comprobación | Resultado |
|---|---|
| `npm test` | 47 pruebas correctas en 9 archivos. Son pruebas unitarias; no certifican el flujo bancario ni la impresión física. |
| `npm run build` | Correcto, incluida la comprobación TypeScript. Next.js instalado: 16.1.4. |
| `npm run lint` | Falla: el script sigue usando `next lint`, que no funciona con esta versión. |
| `npm audit --omit=dev` | 15 entradas de paquetes vulnerables: 1 crítica, 9 altas, 1 moderada y 4 bajas. No son 15 ataques demostrados contra la tienda. |
| Servidor local de producción | HTTP 200 en tienda, producto, carrito, checkout, condiciones y consulta de promoción. |
| Acceso anónimo a `/admin/pedidos` | Redirección a login. |
| Consulta de pedido inexistente | HTTP 404. |
| Lectura anónima de pedidos y pagos en Supabase | 0 filas visibles; el acceso de servidor sí encuentra pedidos. |
| Columnas de aceptación contractual y marketing | Presentes en la base de desarrollo conectada. No equivale a verificar el historial completo de migraciones ni producción. |
| Error temporal de consulta de pedido en la notificación | Reproducido ejecutando el handler con servicios simulados: devuelve HTTP 200 y `ok: true`, sin registrar ni procesar el pago. Ninguna escritura remota. |
| Caché de tienda y checkout | Ambas rutas prerenderizadas, `initialRevalidateSeconds: false` y respuesta local `x-nextjs-cache: HIT`. |

## Correcciones técnicas anteriores al lanzamiento

### T1 — Prioridad crítica: una notificación repetida puede descontar stock otra vez

En [la RPC de stock](../supabase/migrations/20260706120000_0011_gift_stock_optional.sql), línea 83, solo se reconoce como ya procesado un pedido cuyo estado actual es `PAID`. El panel permite después pasar a `PREPARING` o `CANCELLED`.

Según el SQL versionado, una nueva notificación autorizada del mismo cobro en esos estados puede ejecutar de nuevo el descuento y volver a poner el pedido en `PAID`. Si ya no queda stock, puede terminar en `STOCK_ERROR`. La restricción única de `payments.order_id` no evita el descuento, que ocurre antes del INSERT del pago. También puede repetirse la gestión del regalo.

Acción: guardar/comprobar que el cobro y el descuento ya se procesaron con independencia del estado operativo del pedido. Añadir regresión de duplicados después de preparar y cancelar. Hallazgo por inspección del SQL y del handler, sin dispararlo contra pedidos reales. No se ha verificado la definición remota de la función.

**Actualización — 4 de noviembre de 2026: corregido y validado localmente; pendiente de migración y despliegue.** Se ha contrastado el árbol actual: la última definición anterior de la RPC sigue siendo la de `0011`, y el handler insertaba `payments` después de su transacción. El defecto se ha reproducido en PostgreSQL local con ese SQL, incluso existiendo ya el registro del pago. No se ha consultado la definición remota ni el historial remoto de migraciones.

La nueva [migración 0023](../supabase/migrations/20261104100000_0023_atomic_redsys_payment.sql) bloquea primero `orders` y comprueba `paid_at` y `payments` antes de tocar stock, regalos o estado. La confirmación de stock, el canje y el INSERT del pago forman una sola transacción: si falla ese INSERT se revierte todo. Un duplicado coherente conserva el estado operativo y las fechas, sin repetir histórico ni intentos de email desde el handler. La comprobación del importe y los estados de error también se resuelven bajo el bloqueo, evitando que una lectura previa desde JavaScript sobrescriba un estado posterior.

No hay columnas nuevas, backfill ni pagos reconstruidos. Los pedidos con `paid_at` sin pago, pagos sin evidencia de confirmación de stock, importes incoherentes o estados operativos sin evidencias se bloquean para conciliación (`review_required` y error registrado en el servidor), sin cambiar sus datos. Un primer cobro autorizado sin stock se registra en `payments` como cobro recibido y deja el pedido en `STOCK_ERROR`, sin descuento parcial; su repetición no vuelve a intentar servirlo, aunque se reponga stock. La resolución sigue siendo manual.

Validación de esta corrección:

- `npm test`: 141 pruebas correctas en 17 archivos; 10 son del handler de notificación, con Redsys, Supabase y correos simulados.
- `npx tsc --noEmit --incremental false`: correcto.
- `node scripts/check-redsys-postgres.mjs`, con `PG_BIN` apuntando a una distribución completa de PostgreSQL: 21 comprobaciones correctas en PostgreSQL 18.6 local. El script crea y elimina su propio clúster desechable en `127.0.0.1` y no lee `.env`. Incluye reproducción con el SQL anterior, primer pago válido, duplicados en `PAID`/`PREPARING`/`CANCELLED`, dos sesiones con espera real de bloqueo, rollback ante fallo de registro del pago, regalos disponibles/agotados/con variante compartida, cupo agotado y casos históricos incoherentes.

La migración debe aplicarse junto con el handler actualizado: cambia la firma de la RPC y retira las firmas antiguas para impedir que sigan confirmando sin registrar el pago atómicamente. No se han alterado migraciones anteriores ni ejecutado migraciones u operaciones contra servicios remotos, cobros o envíos reales. La prueba local carga el esquema inicial y las migraciones de esta RPC; no certifica el conjunto de Supabase, RLS bajo sus roles reales, PostgREST ni la integración bancaria desplegada. No se ha ejecutado `next build`, porque el prerenderizado actual consulta la base configurada. El histórico de éxito y el envío de emails siguen fuera de la transacción: una caída tras confirmar el pago puede requerir recuperación manual; esta corrección no añade una cola de correos ni resuelve T2.

### T2 — Prioridad alta: errores de base de datos se confirman como recibidos

En [la notificación Redsys](../src/app/api/pagos/notificacion/route.ts), línea 114, `orderError` y pedido inexistente comparten una rama que devuelve HTTP 200. Una indisponibilidad temporal de Supabase puede dejar un cobro autorizado sin procesar en la tienda, aunque el endpoint responda como correcto.

Acción: distinguir errores transitorios de ausencia real del pedido, tratar adecuadamente el fallo y definir recuperación/conciliación. Reproducción aislada con servicios simulados realizada. Revisar también los UPDATE e INSERT de las ramas de error cuyo resultado no se comprueba.

### T3 — Prioridad alta: dependencias con avisos actuales de seguridad

`npm audit --omit=dev` señala Next.js como crítico, además de avisos altos en Zod, next-cloudinary y dependencias transitivas. La versión instalada de Next.js es 16.1.4. El [aviso oficial de Next.js sobre AVIF](https://github.com/vercel/next.js/security/advisories/GHSA-2xp9-vwfh-vxw4) incluye esa versión en el rango afectado.

Acción: actualizar a versiones corregidas y compatibles, revisar la aplicabilidad de los avisos restantes y repetir compilación y compra de prueba. No aplicar actualizaciones mayores automáticas sin comprobar compatibilidad. Esta revisión no intentó explotar las vulnerabilidades.

### T4 — Prioridad alta: apertura, cierre y catálogo quedan congelados en páginas estáticas

[Tienda](../src/app/tienda/page.tsx) y [checkout](../src/app/checkout/page.tsx) consultan Supabase durante el prerenderizado y quedan sin revalidación. Los cambios posteriores de catálogo, avisos y `accepting_orders` no se reflejan automáticamente en esas páginas.

El endpoint de creación de pedido sí comprueba la apertura en cada petición, por lo que mantiene la protección de servidor al cerrar. Pero la interfaz puede ofrecer comprar estando cerrado o seguir deshabilitada después de abrir.

Acción: definir actualización dinámica o revalidación apropiada y comprobar apertura/cierre sin redesplegar.

### T5 — Prioridad alta: completar la información alimentaria visible antes de comprar

[La consulta pública del producto](../src/lib/tienda.ts) y [su ficha](../src/components/Tienda/ProductDetail.tsx) presentan descripción y alérgenos, pero no los campos estructurados de ingredientes, conservación y origen que ya se guardan para etiquetas. Tampoco existe una presentación estructurada de información nutricional y cantidad neta para todos los formatos.

En la base de desarrollo, 9 de 10 productos no tienen ingredientes informados y 6 no tienen conservación ni origen propios. No implica que todos esos campos sean exigibles por igual a todos los productos; deben determinarse por producto y forma de comercialización.

Acción: completar datos reales y publicar los que correspondan en la ficha. Las etiquetas físicas no sustituyen la información anterior al pago. Véase [AESAN: venta de alimentos por internet](https://www.aesan.gob.es/AECOSAN/docs/documentos/publicaciones/seguridad_alimentaria/VENTA_DE_ALIMENTOS_POR_INTERNET.pdf).

### T6 — Prioridad importante: productos retirados y estados de confirmación

- En [create-session](../src/app/api/checkout/create-session/route.ts), líneas 207 y 234, se comprueba `is_active` de la variante, pero no se consulta/comprueba `is_active` del producto. Con el cliente de servidor, que omite RLS, un carrito antiguo puede seguir comprando un producto desactivado si su variante permanece activa. Validar la disponibilidad completa también en servidor. Hallazgo por inspección.
- [ConfirmacionPolling](../src/components/Pedido/ConfirmacionPolling.tsx) solo muestra confirmación para `PAID`; `PREPARING`, `PAYMENT_FAILED`, `STOCK_ERROR` y `NEEDS_REVIEW` terminan en el mensaje genérico de espera. Además, el `return` dentro de `poll()` no cancela el intervalo. Presentar una respuesta clara para cada estado y detener las consultas cuando corresponda.

## Datos y gestiones necesarios para vender

### P1 — Entorno real de producción

La configuración local comprobada usa `REDSYS_ENVIRONMENT=test`, el comercio público de pruebas, `NEXT_PUBLIC_BASE_URL=http://localhost:3000` y remitente de `resend.dev`.

Antes de abrir:

- Configurar y verificar las credenciales reales del TPV y su modo de producción.
- Verificar el dominio de envío en Resend y el remitente y destinatario interno del restaurante; probar recepción real de ambos correos.
- Revisar dominio, HTTPS y variables de producción en Vercel.
- Elegir y verificar la base de producción, sus migraciones, permisos, almacenamiento y copias de seguridad. El seed de desarrollo sigue dentro del historial: evitar cargar el catálogo de ejemplo como catálogo definitivo.
- Verificar las URLs de notificación y retorno generadas en el despliegue real. Siguen derivándose de `request.url`, no del helper de URL pública de los emails.
- Revisar y versionar los cambios locales pendientes antes del despliegue. Hay páginas legales, helpers, tests y migraciones todavía sin seguimiento en Git.

### P2 — Catálogo definitivo y validación alimentaria

Confirmar productos, formatos, precios con IVA aplicable, stock vendible, fotos de cada producto y composición de packs. Las imágenes de desarrollo se reutilizan entre productos distintos y no deben darse por definitivas.

Los cuatro perfiles de etiquetas están cargados, pero son los perfiles provisionales documentados. Confirmar con el responsable APPCC las reglas, fechas, vida útil, conservación y trazabilidad. En la base el código de registro sanitario figura como `777`: verificar el dato y la inscripción que realmente corresponda, sin asumir que el valor es válido ni que deba aplicarse la misma marca a todos los productos.

Existe un perfil de congelados con conservación a -18 °C, mientras que las condiciones describen transporte SEUR Frío entre 0 y 4 °C. Aclarar con el responsable alimentario qué se vende congelado o refrigerado y qué circuito de transporte procede para cada producto.

Probar preparación, impresión de etiquetas 100 × 70 mm y legibilidad con la impresora real; comprobar también edición, reimpresión y registro del trabajador.

### P3 — Cierre legal y coherencia con lo implementado

[Condiciones](legal/condiciones-generales-contratacion.md), [privacidad](legal/politica-de-privacidad.md) y [aviso legal](legal/aviso-legal.md) siguen con estado «pendiente de validación jurídica».

Las condiciones ya documentan como pendientes la redacción del desistimiento («0%»), las cláusulas sobre entregas fallidas y garantías, y las reglas de regalos promocionales. Privacidad deja pendientes la confirmación de contratos con proveedores, razones sociales y entidad bancaria. Confirmar también que las afirmaciones de regiones y tratamiento de datos coinciden con las cuentas reales; fijar una región de ejecución no verifica por sí solo todos los tratamientos del proveedor.

Las condiciones publicadas prometen un correo automático de expedición con tracking de SEUR. Solo existen envíos de confirmación y aviso interno; cambiar de estado no envía tracking. Implementar ese flujo o corregir la promesa en la fuente legal y en la página con la validación correspondiente.

Confirmar una vía efectiva para retirar el consentimiento comercial guardado en los pedidos antes de utilizarlo en campañas. La baja de la newsletter se tramita por Apps Script, mientras que el consentimiento del checkout solo se guarda en Supabase; no asumir que ambos circuitos están sincronizados.

### P4 — Operativa y recuperación

- Cerrar recogidas, embalaje, frío, calendario de expediciones, cobertura y gestión de entregas fallidas con el transportista. No hace falta una integración API para lanzar si existe un circuito manual probado y el texto público lo refleja.
- Definir quién revisa pedidos e incidencias y cómo tramita un cobro sin stock, una cancelación o un reembolso. Cancelar en el panel no equivale a devolver el dinero en Redsys.
- Definir facturación e IVA con la asesoría y su herramienta: la tienda no tiene un sistema de facturación ni desglose fiscal por línea.
- Establecer recuperación de emails: se registran `EMAIL_CLIENTE_ERROR` y `EMAIL_INTERNO_ERROR`, pero no hay cola de reintento ni acción de reenvío en el panel. Una notificación duplicada de un pedido todavía `PAID` sale antes de intentar esos correos.
- Establecer revisión de errores de pagos y conciliación con el TPV, además de verificar copias y restauración de datos.

## Prueba de aceptación anterior a la apertura

Tras las correcciones, ejecutar en un despliegue accesible al TPV y con la configuración prevista para lanzamiento:

1. Compra en móvil y escritorio, retorno y confirmación, recepción de ambos emails, stock y registro del pago correctos.
2. Pago denegado y abandono: carrito y mensajes comprensibles.
3. Notificaciones repetidas antes y después de preparar/cancelar: un solo descuento y un solo procesamiento del cobro.
4. Falta de stock, producto retirado y pérdida de conexión a Supabase: recuperación y avisos correctos.
5. Apertura/cierre y cambios de catálogo visibles sin redesplegar.
6. Envío de pago y envío gratuito en el límite de 150 euros; exclusiones territoriales y cobertura real.
7. Preparación, etiquetado físico y expedición con seguimiento por el circuito acordado.
8. Cancelación/reembolso de prueba y comprobación de conciliación.

No se ha ejecutado esta aceptación bancaria/logística en esta revisión. Las auditorías de julio documentan compras en sandbox, pero no certifican el despliegue y la configuración actuales.

## Mejoras que pueden ir después

- Sitemap, robots y metadatos sociales/de producto; no hay sitemap ni robots propios en el código revisado.
- Panel de gestión general de catálogo, precios, stock, promociones y apertura, si al principio se gestionan mediante un procedimiento controlado en Supabase.
- Seguimiento y estados de expedición más completos si se adopta inicialmente un circuito manual coherente con el contrato.
- Revocación de sesiones admin, protección de intentos compartida entre instancias y CSP tras comprobar compatibilidad.
- Limpieza de pedidos abandonados con una política de conservación definida.
- Sustituir el README heredado de Vite, reparar lint y automatizar verificaciones. El warning de migración de `middleware` a `proxy` también queda pendiente.
- Cuentas de cliente, cupones y otras ampliaciones comerciales no son necesarias para este MVP.

Orden recomendado: corregir pagos y dependencias; resolver actualización de páginas y fichas alimentarias; cerrar catálogo, APPCC y textos legales en paralelo con las altas de proveedores; configurar producción; completar la prueba de aceptación; abrir ventas.
