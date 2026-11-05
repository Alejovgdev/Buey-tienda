# Disponibilidad del MVP — 5 de noviembre de 2026

Catálogo, categorías, fichas y checkout se sirven por petición. Las lecturas
públicas de Supabase usan `cache: 'no-store'`. `React.cache` solo comparte la
lectura entre metadata y contenido dentro de una petición. No hay nuevas
migraciones, servicios, reservas de stock, Realtime ni consultas periódicas.

Los cambios de Studio se ven al cargar, recargar o entrar de nuevo a una ruta
comercial. Se mantienen el renderizado HTML y los enlaces existentes. Next
16.1.4 no precarga contenido de estas rutas dinámicas sin `loading.tsx`; no se
añade esa convención ni `prefetch={true}`. Para atrás/adelante y restauración
desde la caché del navegador, un componente sin interfaz recarga únicamente
`/tienda`, sus descendientes y `/checkout`. No actualiza una pestaña abierta ni
cambia la navegación del restaurante.

La apertura se consulta en cada página comercial. Un fallo de lectura muestra
que no se ha podido comprobar. Los filtros explícitos de activos complementan
las políticas RLS existentes, sin cambiar los permisos.

## Carritos antiguos y precios

Al entrar al checkout, `POST /api/checkout/review` consulta apertura y variantes
con sus productos. Solo lee: devuelve cantidades, precios y total actuales o
los productos que deben corregirse. El formulario no permite pagar mientras
se consulta o si el carrito no es válido. Los mensajes dan acceso al carrito
y permiten volver a comprobar; el contenido histórico del carrito se conserva.

`create-session` repite la misma validación antes de cualquier escritura:
producto y variante activos, relación y slug coherentes, cantidades agregadas
por variante dentro de los límites existentes, stock suficiente y datos de
precio/stock válidos. Una consulta fallida impide iniciar el pago.

Los precios esperados y el total enviado solo detectan diferencias con lo que
vio el cliente. Todos los importes del pedido y del formulario firmado salen
de los datos actuales del servidor. Si cambian antes de pulsar pagar, se
responde 409 con el nuevo resumen, sin crear pedido ni formulario bancario;
el cliente debe revisar y volver a pulsar pagar. También se notifican bajadas
de precio. Si cambian antes de entrar al checkout, el primer resumen ya
muestra el total actual con un aviso.

No se modifica la notificación Redsys ni la RPC de T1. T2, bloqueos,
idempotencia, descuento al confirmar, regalos, recuperación de pagos, estados,
administración y etiqueta de caja conservan su comportamiento. Esta validación
no garantiza stock durante el tiempo que el cliente pasa en el banco: T1 sigue
resolviendo esa comprobación transaccional.

## Verificación local

- `node node_modules/typescript/bin/tsc --noEmit --incremental false`.
- `node node_modules/vitest/vitest.mjs run`: 194 pruebas, incluidos 26 casos de
  disponibilidad, las 28 pruebas del handler T1/T2 y las pruebas administrativas.
- `node scripts/check-availability-production.mjs`: compilación de producción
  con webpack y servidor Next local contra un fixture HTTP mutable. Sustituye
  las credenciales por valores ficticios y bloquea fetch externos en Node;
  Chrome también bloquea peticiones a otros orígenes. No lee la referencia.
  La prueba requiere Chrome; puede indicarse su ejecutable con `CHROME_PATH`.
- En un mismo build se cambian nombre, precio, stock, activos y apertura: se
  comprueban las respuestas HTML, los 404 de productos retirados y los rechazos
  de las API sin pedidos. La caída simulada de la base produce un 503 esperado.
- Chrome comprueba atrás/adelante con caché habilitada, actualización de un
  carrito antiguo al entrar al checkout, cambio de precio al pulsar pagar sin
  pérdida del formulario, bloqueo de producto retirado y recuperación posterior.
- El flujo válido genera un payload firmado con el importe actual y un pedido
  exclusivamente en memoria del fixture. No se envía el formulario al banco,
  no se confirma un pago, no se descuenta stock y no se envían emails.

Los artefactos privados se guardan en `.availability-check.local/`. El build
resultante contiene configuración ficticia: **no debe publicarse**. Recompilar
normalmente con la configuración del entorno de destino antes de desplegar.
`--skip-build` repite las comprobaciones con los mismos puertos y el build
anterior; usarlo solo si no ha cambiado el código de la aplicación.

Quedan fuera la versión desplegada, el esquema y los permisos remotos, y la
integración bancaria y de correo real. No se ejecutan migraciones ni la prueba
SQL de concurrencia de T1: su SQL no ha cambiado.

Referencias de configuración:
[caché sin Cache Components](https://nextjs.org/docs/app/guides/caching-without-cache-components),
[caché de navegación y atrás/adelante](https://nextjs.org/docs/app/api-reference/config/next-config-js/staleTimes),
[inicialización y fetch personalizado de Supabase](https://supabase.com/docs/reference/javascript/initializing).
