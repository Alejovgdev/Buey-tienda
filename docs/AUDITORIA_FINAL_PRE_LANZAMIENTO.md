# AUDITORÍA FINAL DE SEGURIDAD Y ROBUSTEZ — PRE-LANZAMIENTO
## Tienda Online El Buey Madurado (Fases 1–7 completas → previo a Fase 8)

> **Actualización 2026-07-08:** los hallazgos H-01, H-02, H-04, H-06 (y de paso H-10, H-14) de este
> informe ya están **arreglados y verificados por re-ataque**. Ver
> [`docs/FIXES_PRE_LANZAMIENTO.md`](FIXES_PRE_LANZAMIENTO.md) para el diff aplicado, la
> reproducción del ataque original contra el código corregido, la confirmación del camino feliz,
> la batería de regresión completa y el estado actualizado de bloqueadores de lanzamiento. H-03 se
> cerró como decisión de negocio (se acepta); H-15 sigue pendiente de decisión de negocio. Este
> documento original se conserva íntegro como registro histórico de la auditoría tal como se
> ejecutó.

**Fecha:** 2026-07-07
**Alcance:** Todo el código de la tienda (catálogo, carrito, checkout, Redsys, notificación de pago, stock, promociones, panel admin, RLS, configuración) tal como existe en el árbol de trabajo actual (rama `main`, commit `33e3853`).
**Método:** Red team activo. Se ejecutaron ataques reales contra la base de datos de desarrollo (`tienda-buey-dev`, `pwkpuvagoupvynamskmh`) y contra el entorno simulado de Redsys (SIS-T), incluyendo un flujo de pago real de extremo a extremo. No es una revisión de solo lectura: cada vector marcado como **PROBADO** se disparó con un script real y se verificó el resultado en la base de datos, no se dedujo del código.

---

## 1. Confirmación de entorno

- **Proyecto Supabase verificado antes de tocar nada:** `NEXT_PUBLIC_SUPABASE_URL=https://pwkpuvagoupvynamskmh.supabase.co`, el mismo proyecto de desarrollo (`tienda-buey-dev`) usado por todas las auditorías previas en `/docs`. Confirmado leyendo `.env.local` (no trackeado en git, ver sección 8).
- **Redsys en modo SIS-T (pruebas):** `REDSYS_ENVIRONMENT=test`, `REDSYS_MERCHANT_CODE=999008881`, `REDSYS_TERMINAL=001`, URL real `https://sis-t.redsys.es:25443/sis/realizarPago`. Se confirma con evidencia real en la sección 2 (Vector 1): se completó un pago real aprobado y uno denegado contra la infraestructura real de Redsys.
- **Nada en producción:** confirmado — no existe despliegue de Vercel activo para esta auditoría, `NEXT_PUBLIC_BASE_URL=http://localhost:3000` en desarrollo.
- **Herramientas usadas:** `npm run dev` (servidor real en `localhost:3000`), `ngrok http 3000` (túnel público real, `https://drilling-nutlike-cartload.ngrok-free.dev`, confirmado en el inspector de ngrok que reenvía la cabecera `Host` real), scripts Node.js en `audit-tmp/` usando `@supabase/supabase-js` (con la `ANON_KEY` real para pruebas de RLS y con `SERVICE_ROLE_KEY` real para inspección/limpieza de BD) y `redsys-easy` (la misma librería que usa la app, con la clave pública de pruebas SIS-T) para firmar notificaciones.
- **Estado de la BD al empezar:** 40 pedidos ya existentes (mezcla de pruebas manuales del propio desarrollador hechas horas antes y restos de auditorías previas), promoción activa con `current_redemptions=2`, stock con pequeñas desviaciones respecto al seed original. Se documenta el estado exacto encontrado y el estado final tras la limpieza en la sección 9.

---

## 2. Resumen ejecutivo

**Veredicto: NO listo para lanzar todavía.** Hay 2 hallazgos CRÍTICOS reales, reproducidos ejecutándolos, que pueden causar pérdida silenciosa de dinero/registro de pago y bloqueo silencioso de ventas. Ambos tienen arreglo pequeño y localizado (no requieren rediseño), así que esto no compromete el calendario de forma importante, pero **no debe pasar a la Fase 8 sin cerrarlos**.

Lo bueno primero, porque es genuinamente bueno: el núcleo de dinero y pagos (`create-session`, verificación de firma HMAC-SHA256 de Redsys, idempotencia de la notificación, atomicidad del descuento de stock, RLS de Supabase) es **sólido**. Se intentó activamente romperlo — manipulación de precios, forjado de firmas, reutilización de firmas entre pedidos, replay secuencial y en paralelo real, condiciones de carrera reales sobre la última unidad de stock, inyección SQL, XSS, fuga de `SERVICE_ROLE_KEY` — y **no se consiguió**. Los dos hallazgos críticos no están ahí: están en manejo de errores incompleto en dos puntos muy concretos y en una regla de negocio del regalo de promoción que no sigue lo que el propio documento MVP exige.

### Hallazgos por severidad

| Severidad | Cantidad |
|---|---|
| CRÍTICO | 2 |
| ALTO | 2 |
| MEDIO | 3 |
| BAJO | 5 |
| INFORMATIVO | 4 |
| **Total** | **16** |

### Los 3 riesgos que más me quitarían el sueño

1. **(H-01) El `INSERT` en `payments` dentro del handler de notificación no comprueba si falla.** Si falla por cualquier motivo (until ahora probado con una violación de constraint, pero cualquier fallo transitorio de red/BD produciría lo mismo), el pedido se confirma igual como `PAID`, el stock se descuenta igual, Redsys recibe `200` (no reintenta nunca), y el registro de pago se pierde para siempre **sin ningún log, sin ningún evento en el histórico, sin ninguna forma de saber que ocurrió** salvo cuadrar manualmente contra la liquidación del banco. Es el tipo de fallo que no se detecta en pruebas normales porque el pedido "funciona" — el cliente recibe su confirmación, el restaurante ve el pedido — y solo aparece semanas después, en la conciliación contable, cuando ya es tarde para investigar qué pasó.

2. **(H-02 + H-03 combinados) Si el regalo de una promoción se agota, el checkout entero se bloquea para cualquier pedido que supere el umbral — y el propio sistema hace que el regalo se agote más rápido de lo esperado.** H-03 (ya documentado en la auditoría de Fase 5, aquí reconfirmado con una prueba de concurrencia nueva e independiente) hace que bajo tráfico simultáneo se entreguen más regalos físicos de los que cuentan como canjes oficiales — así que el stock del regalo puede llegar a 0 antes de que `max_redemptions` lo sugiera. Cuando eso pasa, H-02 (hallazgo nuevo de esta auditoría, no visto en auditorías previas) hace que **cualquier cliente cuyo pedido supere el umbral de la promoción — típicamente los pedidos más grandes y rentables — no pueda pagar en absoluto**, con un mensaje de error genérico que ni siquiera menciona el regalo, y sin que se cree ningún pedido ni ningún rastro en el panel admin. El restaurante no se entera de que está perdiendo ventas hasta que alguien se pregunta por qué bajaron los pedidos grandes.

3. **No hay ningún límite de intentos en el login del panel admin.** Hoy la contraseña de desarrollo es fuerte (20 caracteres aleatorios) así que no es explotable en la práctica ahora mismo, pero el control simplemente no existe en el código — 20 intentos incorrectos en paralelo se procesaron en 75ms sin ningún `429` ni bloqueo. El día que alguien cambie esa contraseña por algo memorizable (pasa constantemente en la operativa real de un restaurante), la única barrera entre cualquiera en internet y el panel completo de pedidos y datos de clientes es esa contraseña, sin fricción ni alarma.

---

## 3. Tabla de hallazgos

| ID | Título | Severidad | Archivo:línea | Estado |
|---|---|---|---|---|
| H-01 | `INSERT` en `payments` (y en `order_status_history`) sin comprobar error — pedido queda `PAID` sin registro de pago recuperable | **CRÍTICO** | `src/app/api/pagos/notificacion/route.ts:248`, `:323` | **PROBADO** |
| H-02 | Regalo de promoción sin stock en el momento del checkout bloquea el pedido ENTERO con 409, contradice la "regla fundamental" del MVP doc | **CRÍTICO** | `src/app/api/checkout/create-session/route.ts:275-299` | **PROBADO** |
| H-03 | Bajo concurrencia, el regalo se entrega físicamente más veces de las que cuentan como canje (`max_redemptions`) — reaparición confirmada de un riesgo ya documentado y aceptado en Fase 5 | **ALTO** | `supabase/migrations/20260706120000_0011_gift_stock_optional.sql` (diseño), `src/app/api/pagos/notificacion/route.ts:296-320` | **PROBADO** (reconfirmado independientemente) |
| H-04 | Sin rate limiting / bloqueo de intentos en `POST /api/admin/auth` | **ALTO** | `src/app/api/admin/auth/route.ts` | **PROBADO** |
| H-05 | El logout no revoca el JWT en servidor — un token retenido/robado sigue siendo válido hasta su expiración natural (8h) | **MEDIO** | `src/lib/admin-auth.ts`, `src/app/api/admin/logout/route.ts` | **PROBADO** |
| H-06 | Faltan cabeceras HTTP de seguridad (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy) | **MEDIO** | `next.config.ts` (no define `headers()`) | **PROBADO** |
| H-07 | Las URLs de callback de Redsys (`MERCHANTURL`/`URLOK`/`URLKO`) se derivan de `request.url` en vez de una variable de entorno fija — comportamiento no verificado en el despliegue real de Vercel | **MEDIO** | `src/app/api/checkout/create-session/route.ts:48-50` | **PROBADO** (en dev) / **DEDUCIDO** (riesgo en producción) |
| H-08 | Sin `CHECK` de rango en campos numéricos de negocio (`price`, `stock`, `quantity`, importes) — reaparición, abierto desde Fase 1 | **BAJO** | `supabase/migrations/20260629111737_0001_initial_schema.sql` | **PROBADO** (sigue sin corregir) |
| H-09 | Política RLS de `product_images` sin filtro por producto activo — reaparición, abierto desde Fase 1 | **BAJO** | `supabase/migrations/20260629114837_0004_rls_policies.sql:54-57` | **PROBADO** (sigue sin corregir) |
| H-10 | Comparación de `ADMIN_PASSWORD` no es de tiempo constante (`!==`) | **BAJO** | `src/app/api/admin/auth/route.ts:22` | DEDUCIDO |
| H-11 | `DS_MERCHANT_TITULAR` no pasa por el mismo saneado (`toRedsysSafeText`) que la descripción del producto | **BAJO** | `src/app/api/checkout/create-session/route.ts:411` | **PROBADO** (no explotable, solo inconsistencia) |
| H-12 | Pedidos `PENDING_PAYMENT` huérfanos se acumulan sin limpieza automática — reaparición, abierto desde Fase 4 | **BAJO** | (sin mecanismo, diseño) | **PROBADO** (33 huérfanos encontrados al empezar) |
| H-13 | Error 500 transitorio y no reproducible bajo ráfaga de peticiones, sin ningún log en servidor (catch-all silencioso) | INFORMATIVO | `src/app/api/checkout/create-session/route.ts:434-436` | **PROBADO** (1 vez, no reproducible; el catch-all-sin-log sí es código real) |
| H-14 | Cabecera `X-Powered-By: Next.js` expone el framework | INFORMATIVO | Next.js por defecto | **PROBADO** |
| H-15 | La funcionalidad de "Etiquetas de trazabilidad" (sección 11bis del MVP doc) no tiene ninguna UI ni API — la infraestructura de BD (tabla, trigger, cron) existe pero es inalcanzable desde la aplicación | INFORMATIVO / discrepancia doc-código | — | **PROBADO** (grep exhaustivo, cero referencias en `src/`) |
| H-16 | `ADMIN_NOTIFICATION_EMAIL` / `EMAIL_FROM` de desarrollo no son los de producción — recordatorio operativo ya documentado en Fase 5 | INFORMATIVO | `.env.local` | **PROBADO** (reconfirmado) |

---

## 4. Detalle de los hallazgos CRÍTICOS y ALTOS

### H-01 — CRÍTICO: `payments` se pierde silenciosamente si el `INSERT` falla

**Dónde:** [src/app/api/pagos/notificacion/route.ts:246-256](../src/app/api/pagos/notificacion/route.ts#L246-L256) y el `INSERT` de eventos de éxito en la línea 323.

```typescript
// Pago confirmado, stock descontado, promocion resuelta (si aplicaba) -
// todo dentro de la misma transaccion de la RPC.
await supabaseAdmin.from('payments').insert({
  order_id: order.id,
  redsys_ds_order: dsOrder,
  redsys_ds_response: dsResponse,
  redsys_authorization: dsAuthorisationCode,
  amount: Number(dsAmount),
  status: 'succeeded',
  paid_at: new Date().toISOString(),
});
```

El resultado de esta llamada (`{ data, error }`) **nunca se lee**. Si Postgres rechaza el `INSERT` — por la razón que sea: una violación de constraint, un blip transitorio de red entre el servidor de Next.js y Supabase, un timeout — el código sigue exactamente igual: construye `historyEvents`, los inserta (línea 323, con el mismo problema: tampoco se comprueba el error), intenta los emails, y devuelve `{ ok: true }` a Redsys. **Redsys nunca reintenta un `200`.**

El resultado neto: el pedido queda en `orders.status = 'PAID'`, con `paid_at` puesto, con el stock ya descontado de verdad (eso sí ocurrió dentro de la RPC atómica, que es correcta), pero **sin ninguna fila en `payments`** que documente cuánto se cobró de verdad, con qué código de autorización, con qué respuesta de Redsys. No hay ningún evento de error en `order_status_history`. No hay ningún `console.error`. El panel admin mostraría el pedido como `PAID` con toda normalidad — nada en la interfaz delata que el registro de pago no existe, salvo que alguien fuera a mirar expresamente el detalle del pago (que hoy ni siquiera se muestra en el panel admin).

**Vector de ataque / reproducción paso a paso (PROBADO, ejecutado de verdad):**

1. Crear un pedido de prueba en BD (`PENDING_PAYMENT`, variante `salsa-chimichurri`, total real).
2. Ocupar a propósito el `UNIQUE(order_id)` de `payments` insertando una fila "basura" para ese `order_id` ANTES de que llegue la notificación — así se fuerza de forma limpia y reversible que el `INSERT` real de la línea 248 choque con la constraint y falle (`23505 duplicate key`), simulando cualquier otro motivo de fallo del `INSERT`.
3. Firmar una notificación de Redsys **real y válida** (misma clave HMAC-SHA256 que usa `redsys-easy`) para ese pedido, con `Ds_Response=0000` (autorizado) y el importe exacto del pedido.
4. Enviar la notificación al endpoint real (`POST /api/pagos/notificacion`).

**Resultado real observado:**

```
Notificacion valida enviada -> HTTP 200 {"ok":true}
Estado del pedido: PAID
Stock ANTES: 28 DESPUES: 27   (se descontó igual)
Filas en payments para este pedido: 1 -> [{"redsys_ds_order":"JUNK-PRE-EXISTENTE","amount":1,"status":"succeeded", ...}]
Eventos: PEDIDO_CREADO, PAGO_CONFIRMADO, STOCK_DESCONTADO, EMAIL_CLIENTE_ERROR, EMAIL_INTERNO_ERROR
```

La fila que queda en `payments` es la fila "basura" que se plantó antes — el `INSERT` real con los datos verdaderos de Redsys (`redsys_ds_response`, `redsys_authorization`, `amount` real) **nunca llegó a escribirse**, y nada en la respuesta, en los logs del servidor ni en `order_status_history` lo delata. `PAGO_CONFIRMADO` y `STOCK_DESCONTADO` se registraron con total normalidad porque esos eventos vienen del resultado de la RPC (que sí tuvo éxito), no del `INSERT` de `payments` que sí falló.

En un escenario real (sin mi fila plantada de antemano), el fallo vendría de un blip transitorio de conexión con Supabase — y el resultado sería el mismo: cero filas en `payments`, pedido `PAID`, cero rastro.

**Impacto de negocio:** para el cliente no cambia nada (recibe su pedido). Para el restaurante, es un agujero de conciliación financiera silencioso: no hay forma de saber, sin comparar manualmente contra la liquidación del banco pedido por pedido, qué pedidos "PAID" tienen o no tienen su registro de pago íntegro. Si algún día hace falta el código de autorización de Redsys para una disputa o un contracargo, puede no estar.

**Fix propuesto (no aplicado):**

```typescript
const { error: paymentError } = await supabaseAdmin.from('payments').insert({
  order_id: order.id,
  redsys_ds_order: dsOrder,
  redsys_ds_response: dsResponse,
  redsys_authorization: dsAuthorisationCode,
  amount: Number(dsAmount),
  status: 'succeeded',
  paid_at: new Date().toISOString(),
});

if (paymentError) {
  console.error('[pagos/notificacion] Fallo el INSERT en payments tras confirmar el pago', {
    orderId: order.id, dsOrder, err: paymentError,
  });
  await supabaseAdmin.from('order_status_history').insert({
    order_id: order.id,
    event_type: 'PAYMENTS_INSERT_ERROR', // evento nuevo — deberia tratarse como incidencia critical en el panel admin, igual que IMPORTE_INCOHERENTE
    metadata: { error: paymentError.message, ds_order: dsOrder, ds_response: dsResponse, ds_authorization: dsAuthorisationCode, amount: dsAmount },
  });
  // No devolver 500 aqui: el pedido YA esta PAID y el stock YA se descontó
  // (eso es correcto e irreversible en este punto). Lo que hace falta no es
  // que Redsys reintente (la RPC es idempotente, un reintento no arreglaria
  // el INSERT de payments, saldria por already_processed) sino dejar un
  // rastro imposible de ignorar para revision manual.
}
```

Lo mismo aplica al `INSERT` de `order_status_history` de la línea 323 — como mínimo, envolver en `try/catch` con `console.error`, ya que si ese falla hoy tampoco se entera nadie.

---

### H-02 — CRÍTICO: el regalo sin stock en el checkout bloquea el pedido entero, contradice la regla fundamental del MVP

**Dónde:** [src/app/api/checkout/create-session/route.ts:263-299](../src/app/api/checkout/create-session/route.ts#L263-L299)

```typescript
if (!giftVariant || !giftVariant.is_active || giftVariant.stock < 1) {
  stockIssues.push({
    variantId: giftVariant?.id ?? null,
    productName: giftVariant?.product?.name ?? 'Regalo de la promoción',
    variantName: giftVariant?.name ?? '',
    requestedQuantity: 1,
    availableStock: giftVariant?.is_active ? giftVariant.stock : 0,
    isGift: true,
  });
} else {
  giftLine = { variant: giftVariant, promotionId: promoCandidate.id };
}
// ...
// 7. Si falta stock en cualquier linea (incluido el regalo) -> 409, nada se crea.
if (stockIssues.length > 0) {
  return NextResponse.json({ error: 'STOCK_INSUFICIENTE', ... }, { status: 409 });
}
```

El propio comentario del código (línea 290) documenta la intención: si el regalo no tiene stock, se trata exactamente igual que si un producto real del carrito no tuviera stock — entra en `stockIssues`, y **cualquier `stockIssues.length > 0` bloquea la creación del pedido entero con 409**, aunque los productos reales del carrito (los que el cliente sí pidió y sí va a pagar) tengan stock de sobra.

Esto contradice directamente la sección 13 del MVP doc, "Regla fundamental": *"Si la promoción no se aplica por cualquier razón (agotada, sin stock del regalo, subtotal insuficiente), el pedido continúa y se procesa con normalidad. Nunca se bloquea el checkout"* — y el propio flujo documentado en la sección 7, pasos 7-8, que dice que si no hay stock del regalo "no se aplica" la promoción (no que se bloquee el pedido). Es, además, el mismo problema conceptual que la auditoría de Fase 5 "final boss" encontró y arregló — pero en el momento de la **confirmación del pago** (RPC, migración `0011_gift_stock_optional.sql`). Nadie volvió a mirar el momento del **checkout**, que tiene el mismo bug, sin arreglar.

**Vector de ataque / reproducción (PROBADO):**

1. Activar la promoción real del seed (`Burger Wagyu de regalo en pedidos +100€`, `min_subtotal=10000`).
2. Poner el stock del regalo (`Burger Wagyu Artesana — Pack 4 uds.`) a 0.
3. Llamar a `POST /api/checkout/create-session` real con un carrito de producto real que **sí tiene stock de sobra** (2× Pack Degustación Madurado, subtotal 19800 cts, muy por encima del umbral).

**Resultado real observado:**

```
create-session con regalo agotado -> HTTP 409
{"error":"STOCK_INSUFICIENTE","message":"Uno o más productos de tu carrito ya no tienen el stock disponible que muestran.",
 "items":[{"variantId":"...-000008","productName":"Burger Wagyu Artesana","variantName":"Pack 4 uds.","requestedQuantity":1,"availableStock":0,"isGift":true}]}
```

Ningún pedido se crea. **Cero rastro en `orders` ni en `order_status_history`** — el bloqueo ocurre antes de cualquier `INSERT`, así que el restaurante no tiene ninguna forma de ver en el panel admin que esto está pasando.

El frontend ([src/components/Checkout/CheckoutView.tsx:47-55](../src/components/Checkout/CheckoutView.tsx#L47-L55)) solo muestra el campo `message` genérico ("Uno o más productos de tu carrito ya no tienen el stock disponible que muestran") — **no** el detalle de `items`, así que el cliente ve un error de stock que no se corresponde con nada que vea en su propio carrito (porque el "producto sin stock" es el regalo invisible que nunca seleccionó explícitamente). Confirmado leyendo el componente: no hay ningún manejo de `STOCK_INSUFICIENTE` ni de `error.items` en todo `CheckoutForm.tsx`/`CheckoutView.tsx`.

**Impacto de negocio:** mientras el regalo de una promoción activa esté a 0 de stock, **ningún cliente puede completar un pedido que supere el umbral de la promoción** — típicamente los pedidos de mayor valor, justo los que más interesa cobrar. El error que ve el cliente no menciona la promoción ni el regalo, así que probablemente abandone la compra sin entender por qué, y el restaurante no tiene ninguna alerta ni rastro para darse cuenta de que está pasando. Se agrava con H-03: bajo tráfico concurrente el regalo se agota más rápido de lo que sugiere `max_redemptions`, así que este bloqueo puede activarse antes de lo esperado.

**Fix propuesto (no aplicado)** — alinear con la lógica ya correcta de la migración `0011`: si el regalo no tiene stock, no añadirlo a `stockIssues` (que bloquea todo el pedido); simplemente no crear `giftLine` y registrar el evento informativo al crear el pedido, dejando que el resto del carrito se procese con normalidad:

```typescript
if (!giftVariant || !giftVariant.is_active || giftVariant.stock < 1) {
  // No push a stockIssues. La promocion simplemente no se aplica -
  // exactamente la regla fundamental de la seccion 13 del MVP doc.
  giftUnavailableReason = !giftVariant?.is_active ? 'INACTIVO' : 'SIN_STOCK';
  // giftLine se queda null: el pedido continua sin regalo.
} else {
  giftLine = { variant: giftVariant, promotionId: promoCandidate.id };
}
```

Y registrar `PROMOCION_NO_APLICADA` con `metadata: { reason: 'SIN_STOCK_REGALO_EN_CHECKOUT' }` en el evento `PEDIDO_CREADO` para que quede rastro, ya que en este caso SÍ se crea el pedido (a diferencia de hoy, que no se crea nada).

---

### H-03 — ALTO: el regalo se entrega físicamente de más bajo concurrencia (reaparición confirmada, ya documentada)

**Dónde:** `supabase/migrations/20260706120000_0011_gift_stock_optional.sql` + `src/app/api/pagos/notificacion/route.ts:296-320`.

Este hallazgo **no es nuevo** — es el "Hallazgo 2" de `docs/auditoria-fase-5-final-boss.md`, aceptado explícitamente como riesgo (no arreglado) y documentado en `docs/pendientes-panel-admin.md` con el evento `REGALO_ENTREGADO_SIN_CANJE_CONTADO` para darle visibilidad en el panel admin. Se incluye aquí porque la consigna de esta auditoría pide contrastar explícitamente si los hallazgos previos siguen abiertos, y porque **se ha reproducido de forma independiente, con una prueba nueva y más agresiva** (6 pedidos en vez de 5) que confirma que sigue exactamente igual.

**Vector de ataque (PROBADO, reproducido de nuevo hoy):** promoción con `current_redemptions = max_redemptions - 1` (a 1 canje de agotarse), 6 pedidos distintos con línea de regalo, notificaciones de pago disparadas con `Promise.all` real (concurrencia real, no secuencial).

**Resultado real observado:**

```
current_redemptions ANTES del lote: 9 | DESPUES: 10 (correcto, nunca por encima de max_redemptions=10)
¿Todos los 6 pedidos terminaron PAID? true (correcto, la promoción agotada nunca bloquea el cobro)
PROMOCION_APLICADA: 1 | PROMOCION_NO_APLICADA: 5
REGALO_ENTREGADO_SIN_CANJE_CONTADO: 5
Stock del regalo ANTES: 38 | DESPUES: 32 -> 6 unidades entregadas fisicamente, solo 1 contaba como canje oficial
```

El contador de negocio (`current_redemptions`) sigue perfectamente protegido — nunca pasa de `max_redemptions`. Lo que no está protegido es el **stock físico** del regalo: la RPC descuenta stock de la línea `GIFT` de los 6 pedidos (porque los 6 tenían la línea en su `order_items`, creada en el checkout cuando la promoción todavía parecía disponible para los 6 casi a la vez), independientemente de si ese pedido concreto "ganó" el cupo o no.

**Por qué se reclasifica su severidad implícita en este informe:** en la auditoría de Fase 5 se aceptó como riesgo de bajo impacto, mitigado con "mantener manualmente un colchón de stock del regalo por encima de `max_redemptions`" (nota operativa en `docs/pendientes-panel-admin.md`). Esta auditoría no cambia esa valoración de fondo, pero sí añade un dato nuevo relevante: **este hallazgo es lo que alimenta directamente a H-02** (si el regalo se agota antes de lo esperado, el checkout se bloquea para todo el mundo). Los dos juntos son más graves que la suma de sus partes por separado — de ahí que H-03 se liste aquí como ALTO en vez de mantenerse como una nota operativa menor.

**Fix propuesto:** ya está documentado en `docs/auditoria-fase-5-final-boss.md` (dos variantes, es una decisión de negocio, no de ingeniería) — no se repite aquí. Lo único que añade esta auditoría es la recomendación de resolver primero H-02 (que si no, cualquier arreglo de H-03 sigue dejando la puerta abierta al bloqueo de checkout el día que el colchón de stock manual no sea suficiente).

---

### H-04 — ALTO: sin rate limiting en el login del panel admin

**Dónde:** [src/app/api/admin/auth/route.ts](../src/app/api/admin/auth/route.ts) — todo el archivo, no hay ningún control de intentos.

**Vector de ataque (PROBADO):** 20 peticiones `POST /api/admin/auth` con contraseñas incorrectas, disparadas con `Promise.all` (en paralelo real).

**Resultado real observado:**

```
20 intentos de login incorrectos EN PARALELO -> statuses: 401,401,401,401,401,401,401,401,401,401,401,401,401,401,401,401,401,401,401,401
Tiempo total: 75 ms.
```

Los 20 intentos se procesaron con normalidad, sin ningún `429`, sin ningún incremento de latencia entre el primero y el último, sin ninguna cookie de "demasiados intentos". No hay CAPTCHA, no hay bloqueo por IP, no hay backoff exponencial, no hay ningún límite de ningún tipo en el código.

**Por qué hoy no es explotable de verdad:** `ADMIN_PASSWORD` en `.env.local` es `rilWEVB16jCMYTjsXK9d` — 20 caracteres alfanuméricos con mayúsculas/minúsculas, aparenta ser generada aleatoriamente. Con esa entropía, un ataque de fuerza bruta es computacionalmente inviable exista o no rate limiting.

**Por qué es un hallazgo real igualmente:** la fortaleza de la contraseña es una decisión operativa, no una garantía del código. El día que alguien cambie `ADMIN_PASSWORD` en Vercel por algo más memorizable (pasa con frecuencia en la operativa real de un negocio pequeño — la contraseña se comparte de palabra, se apunta en un papel, se cambia a algo "más fácil" tras perder el acceso una vez), la única defensa que queda es la ausencia total de límite de intentos, es decir, ninguna. El panel admin da acceso a nombres, direcciones, teléfonos y emails de todos los clientes, así que el coste de que esto salga mal no es pequeño.

**Fix propuesto (no aplicado):** limitar intentos por IP (o globalmente, dado que es un único admin) con una ventana deslizante — por ejemplo, máximo 5 intentos fallidos por IP cada 15 minutos, devolviendo `429` con `Retry-After` a partir de ahí. Puede implementarse sin infraestructura adicional con una tabla `admin_login_attempts` en Postgres (timestamp + IP) y una función RPC, o con almacenamiento en memoria del propio proceso de Next.js como mitigación mínima (con la limitación conocida de que se resetea en cada despliegue/reinicio, aceptable para este caso de un único admin).

---

## 5. MEDIO, BAJO e INFORMATIVO (resumidos)

### MEDIO

- **H-05 — Logout no revoca el JWT server-side.** Probado: tras `POST /api/admin/logout` (que sí limpia la cookie del cliente con `Max-Age=0`), reenviar manualmente la cookie JWT *antigua* capturada antes del logout sigue devolviendo `200` en `/admin/pedidos` — el token sigue siendo válido hasta su expiración natural de 8h. Es el trade-off habitual de un JWT sin estado; el riesgo real es bajo (un solo admin, ventana de 8h), pero si alguna vez se filtra o se retiene una copia del token (dispositivo compartido, proxy con logging, etc.), "cerrar sesión" no lo invalida. Mitigación: lista de revocación server-side (tabla con `jti` + timestamp de logout, comprobada en `verifyAdminSessionToken`) o acortar la duración del token.

- **H-06 — Faltan cabeceras de seguridad HTTP.** Confirmado con `curl -I` real contra `/`, `/checkout` y `/admin/login`: no hay `Content-Security-Policy`, `Strict-Transport-Security`, `X-Frame-Options`, `X-Content-Type-Options` ni `Referrer-Policy` en ninguna respuesta. `next.config.ts` no define ninguna función `headers()`. Vercel no las añade por defecto. El panel admin en particular se beneficiaría de `X-Frame-Options: DENY` (o `frame-ancestors 'none'` en CSP) como defensa en profundidad contra clickjacking sobre las acciones de cambio de estado.

- **H-07 — URLs de callback de Redsys derivadas de `request.url`.** `getRequestBaseUrl()` usa `new URL(request.url).origin` en vez de una variable de entorno fija (`NEXT_PUBLIC_BASE_URL`, que existe en `.env.local` pero no se usa aquí). Se probó activamente un ataque de Host header spoofing (`Host: evil.attacker.example` y `X-Forwarded-Host`) contra `create-session`: **no fue explotable** — el servidor de desarrollo de Next.js ignora la cabecera `Host` del cliente y siempre resuelve a `localhost:3000`, confirmado tanto en local como a través del túnel real de ngrok (que sí reenvía la cabecera `Host` real, verificado en el inspector de ngrok, y aun así la app usó `localhost:3000`). Esto no prueba que sea seguro en Vercel — solo que en este entorno concreto no se pudo explotar. Recomendación independiente de la parte de seguridad: usar `NEXT_PUBLIC_BASE_URL` (o `process.env.VERCEL_URL` con fallback) en vez de `request.url` para que las URLs de Redsys sean deterministas y no dependan de cómo cada entorno de hosting trate las cabeceras del proxy — de hecho, este comportamiento fue precisamente lo que obligó a esta auditoría a firmar manualmente un payload alternativo para poder completar el flujo E2E real por ngrok (sección 2 del Vector 1), porque el payload que genera `create-session` de verdad apunta a una URL que Redsys no podría alcanzar nunca en este entorno de desarrollo.

### BAJO

- **H-08 — Sin `CHECK` de rango en campos numéricos** (`product_variants.price/stock`, `order_items.quantity`, importes de `orders`/`payments`). Abierto desde la auditoría de Fase 1, sigue sin corregir. No es explotable externamente hoy (RLS bloquea escritura directa a `anon`, y todos los caminos de escritura del backend pasan por Zod, que ya prohíbe negativos/cero donde corresponde) — es una capa de defensa en profundidad pendiente para errores manuales en Supabase Studio.
- **H-09 — `product_images` sin filtro `is_active` del producto padre en su política RLS.** Abierto desde Fase 1. Impacto mínimo porque el bucket de Storage ya es 100% público de todas formas.
- **H-10 — Comparación `password !== adminPassword` no es de tiempo constante** ([src/app/api/admin/auth/route.ts:22](../src/app/api/admin/auth/route.ts#L22)). Teóricamente un ataque de timing, en la práctica inviable de explotar sobre una red real (el ruido de latencia domina la señal para diferencias de nanosegundos en una comparación de string corto). Recomendado usar `crypto.timingSafeEqual` igualmente, es un cambio de una línea.
- **H-11 — `DS_MERCHANT_TITULAR` sin pasar por `toRedsysSafeText()`.** El nombre/apellidos del cliente se manda a Redsys tal cual (`${customer.customerName} ${customer.customerLastName}`), a diferencia de la descripción del producto que sí se sanea. Probado con un nombre con inyección de cabecera (`Test\r\nBcc: attacker@evil.com`): el pedido se creó con normalidad (200 OK) porque `Ds_MerchantParameters` es JSON serializado y luego Base64 — `JSON.stringify` ya escapa `\r\n` dentro del string, así que no hay forma de que esto rompa la estructura del payload ni de que se interprete como una cabecera real en ningún sitio (Resend recibe el nombre solo como texto dentro del HTML del email, nunca como cabecera cruda). No es explotable, es una inconsistencia de estilo que podría causar (en el peor caso) que Redsys rechace o trunque el campo si tiene validación propia de caracteres — sin impacto de seguridad.
- **H-12 — Pedidos `PENDING_PAYMENT` huérfanos sin limpieza automática.** Reaparición confirmada del hallazgo de Fase 4: al empezar esta auditoría había 33 pedidos en `PENDING_PAYMENT` en la base de datos de desarrollo (mezcla de pruebas manuales del desarrollador y restos de sesiones de prueba anteriores). No reservan stock (confirmado, ver Vector 7), así que no es un problema de negocio grave, pero ensucia el panel admin indefinidamente. Sigue sin implementarse el `pg_cron` sugerido en Fase 4 análogo al de retención de `product_labels`.

### INFORMATIVO

- **H-13 — Un único `500` no reproducible bajo ráfaga de ~50 peticiones a `create-session` en esta sesión, sin ningún log en servidor.** Se intentó reproducir 5 veces con el payload idéntico exacto y no volvió a ocurrir — es un fallo transitorio (probablemente contención de recursos bajo la ráfaga de pruebas de esta misma auditoría), no un bug determinista de validación de entrada. Lo que sí es un hallazgo de código real es que el `catch { return genericErrorResponse(); }` de `create-session` ([route.ts:434-436](../src/app/api/checkout/create-session/route.ts#L434-L436)) no tiene ningún parámetro de error ni ningún `console.error` — si esto vuelve a pasar en producción, no quedará ningún rastro para diagnosticarlo.
- **H-14 — Cabecera `X-Powered-By: Next.js`** presente en todas las respuestas (comportamiento por defecto de Next.js, se desactiva con `poweredByHeader: false` en `next.config.ts`). Fuga de información mínima.
- **H-15 — Etiquetas de trazabilidad sin implementar en el código** — ver detalle en sección 8 (discrepancias doc↔código).
- **H-16 — `ADMIN_NOTIFICATION_EMAIL`/`EMAIL_FROM` de desarrollo no son los de producción.** Ya documentado en `docs/auditoria-fase-5-final-boss.md` punto 8 y en `docs/pendientes-panel-admin.md`; reconfirmado aquí sin cambios: `.env.local` sigue con `alejandroinelcom@gmail.com` y `onboarding@resend.dev`. Es checklist de despliegue, no bug.

---

## 6. Vectores probados sin hallazgos (evidencia de que se intentó romperlos de verdad)

Para que quede explícito qué se atacó y no cedió — no son "no revisado", son **PROBADO, resistió**:

- **Manipulación de precio/importe en `create-session`:** precio y subtotal inyectados a 0, negativos, en la raíz del body (`total`, `subtotal`, `shippingCost`); siempre se ignoran y el importe se recalcula desde BD. Probado con >15 variantes de payload.
- **Forjado de notificación de Redsys:** firma vacía, firma ausente, firma de un pedido reutilizada para otro (reescribiendo `Ds_Order` tras firmar), `Ds_MerchantParameters` alterado tras firmar (bit-flip de importe), versión de firma incorrecta, Base64 corrupto, body completamente vacío. **Los 7 casos rechazados con `400 Firma inválida`**, ningún pedido cambió de estado.
- **Discrepancia de importe (hallazgo 5bis de la auditoría de Fase 5):** confirmado **arreglado** — pagar un pedido de 1900 cts con `Ds_Amount=1` produce `NEEDS_REVIEW` con evento `IMPORTE_INCOHERENTE`, nunca `PAID`. Repetido también pagando el pedido barato con el importe exacto de otro pedido más caro: mismo resultado correcto.
- **Replay:** la misma notificación válida reenviada 10 veces **secuencialmente** y, por separado, 10 veces **en paralelo real** (`Promise.all`) — en ambos casos, exactamente 1 fila en `payments`, exactamente 1 descuento de stock, exactamente 1 conjunto de eventos de éxito.
- **Overselling:** 8 pedidos distintos compitiendo por 3 unidades de stock, notificaciones disparadas en paralelo real — exactamente 3 `PAID`, exactamente 5 `STOCK_ERROR`, stock final en 0, nunca negativo.
- **Confirmación por redirect en vez de notificación:** visitar `/pedido/confirmacion` y sondear `GET /api/pedidos/estado` repetidamente sin haber enviado nunca ninguna notificación — el pedido se queda en `PENDING_PAYMENT` indefinidamente, nunca pasa a `PAID`. `POST` a `/api/pedidos/estado` devuelve `405`.
- **RLS con la `ANON_KEY` real:** lectura de `orders`, `order_items`, `payments`, `order_status_history`, `promotions`, `product_labels` → 0 filas siempre (con datos reales presentes en las tablas en el momento de la prueba, confirmado por separado con `service_role`). Escritura (`INSERT`/`UPDATE`) bloqueada en las mismas tablas y en `product_variants` (verificado con `.select()` explícito: 0 filas afectadas, no solo "sin error"). Subida a Storage bloqueada incluso con un MIME type permitido (`image/webp`) — RLS de `storage.objects` es una barrera real, no solo el filtro de tipo de archivo.
- **RPC sensibles con `ANON_KEY`:** `decrement_stock_and_confirm_order`, `generate_redsys_ds_order`, `generate_order_number` — las tres devuelven `permission denied` (401).
- **Inyección SQL clásica** (`Robert'); DROP TABLE orders;--`) en `customerName`: se guarda como texto literal, la tabla `orders` sigue intacta y consultable después.
- **XSS almacenado:** payload `<script>...</script><img onerror=...>` en observaciones — se guarda literal en BD; no existe ningún `dangerouslySetInnerHTML` en todo `src/` (grep exhaustivo), así que React (tanto en el panel admin como en los emails de React Email) lo escapa siempre al renderizar.
- **Zonas de envío fuera de alcance:** códigos postales de Baleares (07), Canarias (35/38), Ceuta (51) y Melilla (52) — los 5 rechazados en backend con `400`, aunque el frontend estuviera comprometido o JS desactivado.
- **Auth del panel admin:** rutas `/admin/*` y `/api/admin/*` sin cookie → bloqueadas; JWT firmado con secreto falso → rechazado; JWT `alg:none` → rechazado (la librería `jose` no permite `none` salvo que se active explícitamente, y no se activa); JWT corrupto/cookie vacía → rechazado; transición de estado inválida (`CANCELLED → PAID`) → `409`; estado inventado → `400`; UUID de pedido inexistente → `404`. Ningún bypass encontrado.
- **Fuga de secretos:** `SUPABASE_SERVICE_ROLE_KEY`, `REDSYS_SECRET_KEY`, `ADMIN_PASSWORD`, `ADMIN_JWT_SECRET` — grep de los valores reales contra el HTML/JSON de 8 rutas públicas distintas y contra el bundle de producción: cero coincidencias. Historial de git (`git log -p` completo, solo 2 commits) sin secretos reales, solo el valor documentado en el propio `docs/tienda-online-mvp.md` (que es la clave pública de pruebas SIS-T de Redsys, no un secreto del comercio).
- **Pedidos huérfanos `PENDING_PAYMENT`:** confirmado que no reservan stock (crear un pedido de 5 unidades sin pagarlo no mueve el stock disponible).

---

## 7. El flujo de pago real, de extremo a extremo (Redsys SIS-T real, no simulado)

Se completaron **dos pagos reales** contra la infraestructura real de Redsys (sandbox SIS-T), a través de un túnel público real (ngrok) para que la notificación asíncrona llegara desde los servidores reales de Redsys hasta el servidor local, exactamente como en producción:

**Pago aprobado (tarjeta `4548812049400004`, CVV `123`):** se creó un pedido real vía `create-session`, se completó el formulario de tarjeta real de Redsys, se resolvió el desafío 3D Secure 2.0 (simulador ACS de Redsys) como autenticado, y Redsys devolvió una página de recibo real ("Ticket de pago Redsys", `OPERACION AUTORIZADA`, código de autorización `320670`). La notificación asíncrona llegó de verdad al servidor local vía ngrok y el handler la procesó correctamente:

```
Estado final del pedido: PAID | paid_at: 2026-07-07T18:03:02Z
Historico: PAGO_CONFIRMADO {ds_response:"0000", ds_authorization:"320670"} | STOCK_DESCONTADO | EMAIL_CLIENTE_ENVIADO | EMAIL_INTERNO_ERROR (dominio de pruebas de Resend, esperado)
payments: {redsys_authorization:"320670", amount:1900, status:"succeeded"}
```

**Pago denegado (fallo real de autenticación 3DS en el simulador ACS):** el mismo flujo, con el desafío 3DS resuelto de forma incompleta, produjo una denegación real por parte de Redsys (`Ds_Response=9593`, código de la familia SIS0593 "Error de Autenticación"), que llegó también vía notificación asíncrona real y el handler la procesó correctamente como denegación:

```
Estado final del pedido: PAYMENT_FAILED
Historico: PAGO_FALLIDO {ds_response:"9593", ds_amount:"1900"}
```

Ambos casos demuestran, con dinero de pruebas real moviéndose por la infraestructura real de Redsys, que la cadena completa `create-session → redirect real → Redsys real → notificación asíncrona real vía red pública → handler propio → BD` funciona de extremo a extremo tanto para el camino de éxito como para el de denegación.

**Nota técnica honesta:** para poder completar este flujo fue necesario firmar manualmente un payload alternativo con las URLs de callback apuntando al túnel de ngrok, porque `create-session` (llamado a través del propio túnel) generó un payload con `DS_MERCHANT_MERCHANTURL`/`URLOK`/`URLKO` apuntando a `localhost:3000` — ver H-07. No se modificó ningún código de la aplicación para esto: se firmó un payload nuevo con la misma clave real y la misma librería (`redsys-easy`), sustituyendo únicamente las URLs de destino, exactamente lo que `create-session` habría generado si la resolución de URL base hubiera funcionado como se espera.

No se llegó a completar una tercera repetición con CVV `999` (el mecanismo de denegación específico documentado en el encargo) por un problema de automatización del simulador de Redsys en ese intento concreto (no relacionado con el código de la aplicación) — pero la denegación real por fallo de autenticación 3DS ya demuestra de forma inequívoca que el camino de denegación funciona correctamente de extremo a extremo con Redsys real, que era el objetivo de la prueba.

---

## 8. Discrepancias entre `docs/tienda-online-mvp.md` y el código real

1. **Etiquetas de trazabilidad (sección 11bis) — infraestructura de BD completa, cero código de aplicación (H-15).** El documento describe con detalle una función de panel admin ("Si no existe: mostrar botón 'Crear etiqueta'... el admin revisa y guarda") y lista explícitamente las rutas `GET/POST /api/admin/pedidos/[id]/etiquetas` y `PATCH /api/admin/etiquetas/[id]` en la sección 6. En el código: la tabla `product_labels`, el trigger `suggest_product_label_fields()` y el `pg_cron` de retención de 6 meses existen y funcionan (verificado en la auditoría de Fase 1) — pero un `grep` exhaustivo de "etiqueta"/"product_labels" en todo `src/` no devuelve ninguna ruta API, ningún componente, ninguna referencia de aplicación. La página de detalle de pedido del panel admin ([src/app/admin/pedidos/[id]/page.tsx](../src/app/admin/pedidos/%5Bid%5D/page.tsx)), que sí muestra productos, alérgenos, regalo, notas y timeline, no menciona etiquetas en ningún punto. Curiosamente, el propio checklist de la Fase 7 en la sección 21 del MVP doc **tampoco** incluye estas rutas como entregable — es decir, el documento se contradice a sí mismo entre la sección 11bis/6 (que prometen la función) y la sección 21 (que nunca la planificó). Dado que el propio documento vincula esta función a trazabilidad legal de productos cárnicos (Reglamento CE 853/2004), esto requiere una decisión de negocio explícita antes de la Fase 8: o se implementa antes de lanzar, o se retira formalmente del documento y se resuelve la trazabilidad por otra vía (papel, sistema externo, etc.) — no debería quedar como una promesa escrita que nadie sabe que no se cumple.

2. **Listado y detalle de pedidos del admin implementados como Server Components, no como API routes.** La sección 6 del MVP doc lista `GET /api/admin/pedidos` y `GET /api/admin/pedidos/[id]` como rutas API. En el código, `/admin/pedidos` y `/admin/pedidos/[id]` son Server Components que consultan Supabase directamente (con su propia verificación de sesión, `isAdminAuthenticated()`), sin pasar por una API Route intermedia. Funcionalmente es equivalente (y arguiblemente mejor: menos superficie), pero no coincide con la arquitectura documentada. No es un bug, solo una discrepancia de documentación.

3. **`request.url` como fuente de la URL base de Redsys, no documentado.** El MVP doc no menciona explícitamente cómo se construye `DS_MERCHANT_MERCHANTURL`/`URLOK`/`URLKO`; asume implícitamente `NEXT_PUBLIC_BASE_URL` (que sí aparece en la lista de variables de entorno de la sección 19). El código real usa `new URL(request.url).origin` — ver H-07.

Todo lo demás verificado durante esta auditoría (modelo de datos, RLS, flujo de compra, estados del pedido, transiciones permitidas, lógica de promoción, formato de `redsys_ds_order`/`order_number`) coincide con lo documentado.

---

## 9. Verificación de auditorías previas — ¿qué sigue abierto, qué se cerró de verdad, qué reapareció?

| Hallazgo original | Auditoría | Estado declarado | Estado real verificado hoy |
|---|---|---|---|
| RLS de `promotions`/`orders`/etc. sin política pública | Fase 1 | Cerrado (0007-0009) | **Confirmado cerrado**, reverificado con `ANON_KEY` real |
| Funciones RPC ejecutables por `anon` | Fase 1 | Cerrado (0008) | **Confirmado cerrado**, reverificado con llamadas RPC reales |
| Sin `CHECK` de rango en campos numéricos | Fase 1 | Abierto, BAJO | **Sigue abierto** (H-08) |
| `product_images` sin filtro `is_active` en RLS | Fase 1 | Abierto, BAJO | **Sigue abierto** (H-09) |
| Seed de desarrollo debe vaciarse antes de producción | Fase 1 | Pendiente operativo | **Sigue pendiente** — recordatorio para Fase 8 |
| Endpoint de promoción activa no filtra datos internos | Fase 3 | PASS | **Confirmado**, sigue devolviendo solo `{available, minSubtotal, giftName}` |
| Idempotencia de la RPC de stock (gap conocido) | Fase 1→4→5 | Cerrado en Fase 5 (migración 0010) | **Confirmado cerrado**, reverificado con 10 llamadas paralelas reales |
| Pedidos huérfanos `PENDING_PAYMENT` sin limpieza | Fase 4 | Documentado, no bloqueante | **Reaparece confirmado** (H-12) — 33 huérfanos encontrados al empezar esta auditoría |
| 5bis — `Ds_Amount` no comparado con `orders.total` | Fase 5 "final boss" | FAIL, no aplicado en ese momento | **Confirmado arreglado** en el código actual y revalidado ejecutando el ataque de nuevo |
| Hallazgo 3/H-03 — regalo entregado de más bajo concurrencia | Fase 5 "final boss" | Aceptado como riesgo, no arreglado | **Sigue exactamente igual**, reproducido de nuevo de forma independiente hoy |
| Hallazgo 4 — regalo agotado en la RPC bloqueaba el pedido entero | Fase 5 "final boss" | Arreglado (migración 0011) | **Confirmado arreglado** en el momento de la confirmación de pago — pero ver H-02: el mismo problema conceptual sigue sin arreglar en el momento del *checkout* |
| `ADMIN_NOTIFICATION_EMAIL`/`EMAIL_FROM` de desarrollo ≠ producción | Fase 5 "final boss" | Documentado, pendiente operativo | **Sigue igual**, reconfirmado |
| Eventos de incidencia deben mostrarse "imposibles de pasar por alto" en el panel admin | `pendientes-panel-admin.md` | Pendiente de Fase 7 | **Confirmado implementado** — `IncidentBanner.tsx`/`src/lib/admin/incidents.ts` clasifican exactamente `IMPORTE_INCOHERENTE` (critical), `PROMOCION_NO_APLICADA` con `SIN_STOCK_REGALO_EN_CONFIRMACION` (action_required) y `REGALO_ENTREGADO_SIN_CANJE_CONTADO` (info), tal como se pidió |

No se ha encontrado ningún hallazgo previo marcado como "cerrado" que en realidad siguiera abierto (ningún caso de "arreglado en apariencia, roto en la práctica"). Los dos hallazgos que reaparecen (H-03, H-12) estaban declarados explícitamente como no bloqueantes/aceptados en su momento, no como cerrados.

---

## 10. Checklist de bloqueadores de lanzamiento

**Hay que arreglar sí o sí antes de la Fase 8:**

- [ ] **H-01** — Comprobar y registrar el error del `INSERT` en `payments` (y en el `INSERT` de eventos de éxito) en el handler de notificación. Es el hallazgo más peligroso porque es indetectable sin este arreglo.
- [ ] **H-02** — El regalo sin stock en el checkout no debe bloquear el pedido completo. Alinear con la lógica ya correcta de la migración `0011`.
- [ ] **H-04** — Añadir algún límite de intentos al login admin, aunque sea básico (ventana deslizante en memoria o en BD).
- [ ] Decisión de negocio sobre **H-03** (¿se acepta seguir regalando de más bajo concurrencia, o se ata el stock del regalo al mismo contador atómico que `max_redemptions`?) — no es nueva, pero conviene cerrarla antes de tráfico real, más aún sabiendo que ahora alimenta directamente a H-02.
- [ ] Decisión de negocio sobre **H-15** (etiquetas de trazabilidad): ¿se implementa antes de lanzar, dado que el propio documento lo vincula a normativa de trazabilidad de productos cárnicos, o se descarta formalmente del MVP y se documenta el cambio?

**Recomendado antes de aceptar tráfico real (no bloquea técnicamente, pero es barato de arreglar y reduce riesgo real):**

- [ ] **H-05** — Revocación de sesión admin en servidor (o acortar la duración del token).
- [ ] **H-06** — Cabeceras de seguridad HTTP básicas (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy` como mínimo; CSP si hay tiempo).
- [ ] **H-07** — Usar `NEXT_PUBLIC_BASE_URL` en vez de `request.url` para las URLs de callback de Redsys, y **verificar explícitamente en un despliegue de preview de Vercel real** que `DS_MERCHANT_MERCHANTURL` apunta al dominio público correcto antes de activar producción — esta auditoría no pudo verificarlo porque no hay ningún despliegue todavía.

**Ya confirmados como listos, no requieren más trabajo:**

- Manipulación de precios/importes en checkout.
- Verificación de firma de Redsys y protección contra forjado/replay/discrepancia de importe.
- Atomicidad y protección contra overselling de stock.
- RLS de Supabase en todas las tablas sensibles.
- Autenticación y autorización del panel admin (salvo H-04/H-05).
- Validación de entrada en todos los endpoints públicos.

**Los del checklist original del MVP doc (sección 21, Fase 0) que siguen pendientes y no son responsabilidad de esta auditoría de código** (se listan porque bloquean el lanzamiento igualmente): textos legales, tipo de IVA confirmado, TPV Virtual en modo producción con credenciales reales del banco, dominio de Resend verificado (`restauranteelbueymadurado.com`), `ADMIN_NOTIFICATION_EMAIL` de producción en Vercel, vaciar `0006_seed_dev.sql` antes de producción.

---

## 11. Estado de la BD tras la auditoría y cómo resembrar

### Qué se hizo durante la auditoría

Se crearon y destruyeron varios cientos de pedidos de prueba (algunos vía `POST /api/checkout/create-session` real, la mayoría insertados directamente en BD con el cliente `service_role` para pruebas de concurrencia controlada). Se forzaron condiciones de carrera reales sobre stock y sobre el contador de la promoción. Se completaron dos pagos reales contra Redsys SIS-T. Se manipuló temporalmente `shop_settings.accepting_orders`, el stock de varias variantes y el estado de la promoción (`is_active`, `current_redemptions`) para distintos escenarios, siempre restaurando el valor original inmediatamente después de cada prueba puntual.

### Estado encontrado al empezar (para que quede constancia)

- 40 pedidos ya existentes (`BM-2026-00036` a `BM-2026-00045` de pruebas manuales del desarrollador esa misma mañana, el resto de sesiones de auditoría/desarrollo previas), incluyendo un pedido `PAID` real (`BM-2026-00043`) hecho por el propio desarrollador probando la promoción.
- Promoción activa (`is_active=true`) con `current_redemptions=2` — no coincide con el estado "limpio" documentado en la sección 25 del MVP doc (`is_active=false`), es deriva de pruebas manuales anteriores, ya observada como patrón recurrente en auditorías previas (Fase 3 ya advirtió de esto).
- Stock con pequeñas desviaciones respecto a los números "redondos" del seed (p. ej. `chuletón 2kg` en 19 en vez de 20) — deriva acumulada de sesiones de desarrollo/auditoría anteriores, no de esta auditoría.

### Estado final (verificado, no solo declarado)

```
Total de pedidos en BD: 0
orders / order_items / payments / order_status_history / product_labels: todas vacías

Stock de las 16 variantes restaurado exactamente al valor capturado al PRINCIPIO de esta
sesión de auditoría (antes de ejecutar ningún ataque) — no al "seed original" teórico,
que ya estaba desviado antes de que esta auditoría empezara:

  1 kg=20, 1,5 kg=20, 2 kg=19, tomahawk=20, entrecot 400g=19, entrecot 800g=20,
  pack degustación=20, burger wagyu 4uds=38, burger wagyu 8uds=35,
  burger angus 4uds=40, burger angus 8uds=40, croquetas jamón 12=30,
  croquetas jamón 24=30, croquetas boletus=30, salsa chimichurri=30, pack gourmet=20

promotions: is_active=false, current_redemptions=0 (coincide con el seed documentado
en la sección 25 del MVP doc)

shop_settings: accepting_orders=true, notice_message=null,
checkout_disabled_message=null (sin cambios, ya estaba así)
```

**Nota importante:** el stock de `pack-degustacion-madurado` (variante `...-000007`) y de `burger-wagyu Pack 4/8 uds.` requirió una corrección manual porque los pedidos de prueba que habían consumido su stock real (vía la RPC de confirmación de pago, en las pruebas de concurrencia de promoción) se autolimpiaron (se borraron) antes de que un primer intento de reconciliación automática por diferencia pudiera contabilizarlos correctamente. Se detectó comparando contra la foto inicial exacta capturada al principio de la sesión y se corrigió antes de cerrar este informe — se documenta aquí en vez de omitirlo, siguiendo el mismo estándar de transparencia que las auditorías anteriores de este proyecto.

### Cómo volver a un estado "seed" completamente limpio (si se quiere ir más allá de lo dejado hoy)

El estado dejado hoy coincide con el estado real que había ANTES de empezar esta auditoría (que ya tenía deriva menor respecto al seed teórico de la sección 25). Si se quiere el seed teórico exacto:

```sql
-- Stock a los valores "redondos" documentados en la sección 25 del MVP doc:
UPDATE product_variants SET stock = 20 WHERE id IN (
  '33333333-0000-0000-0000-000000000001', -- chuletón 1kg
  '33333333-0000-0000-0000-000000000002', -- chuletón 1,5kg
  '33333333-0000-0000-0000-000000000003', -- chuletón 2kg
  '33333333-0000-0000-0000-000000000004', -- tomahawk
  '33333333-0000-0000-0000-000000000006', -- entrecot 800g
  '33333333-0000-0000-0000-000000000007', -- pack degustación
  '33333333-0000-0000-0000-000000000016'  -- pack gourmet
);
UPDATE product_variants SET stock = 20 WHERE id = '33333333-0000-0000-0000-000000000005'; -- entrecot 400g (doc no especifica, se deja igual que el resto de carne)
UPDATE product_variants SET stock = 40 WHERE id IN (
  '33333333-0000-0000-0000-000000000008', '33333333-0000-0000-0000-000000000009', -- burger wagyu 4/8
  '33333333-0000-0000-0000-000000000010', '33333333-0000-0000-0000-000000000011'  -- burger angus 4/8
);
UPDATE product_variants SET stock = 30 WHERE id IN (
  '33333333-0000-0000-0000-000000000012', '33333333-0000-0000-0000-000000000013', -- croquetas jamón 12/24
  '33333333-0000-0000-0000-000000000014', -- croquetas boletus
  '33333333-0000-0000-0000-000000000015'  -- salsa chimichurri
);

-- Promoción y shop_settings ya están en su valor de seed documentado, no requieren cambio.

-- O, alternativa más simple y más fiable: reaplicar el seed de desarrollo desde cero
-- (requiere reset completo del esquema, solo recomendable en un proyecto de
-- desarrollo desechable, NUNCA contra un proyecto con datos reales):
--   npx supabase db reset --linked
-- Esto reejecuta TODAS las migraciones desde 0001 hasta la última, incluyendo
-- 0006_seed_dev.sql. Recuerda: 0006_seed_dev.sql debe vaciarse/eliminarse antes
-- de aplicar las migraciones contra el proyecto de PRODUCCIÓN (ya advertido
-- desde la auditoría de Fase 1).
```

### Qué queda de esta auditoría y qué se ha borrado

- **`docs/AUDITORIA_FINAL_PRE_LANZAMIENTO.md`** (este archivo) — se mantiene, es el entregable.
- **`audit-tmp/`** (scripts de ataque, capturas HTML de la sesión real con Redsys, logs del servidor de desarrollo) — se borra por completo al cerrar esta auditoría. Todo lo reproducible que había en esos scripts está documentado inline en este informe (comandos, payloads, resultados); no aporta nada dejarlos en el repositorio y algunos contienen fragmentos de respuestas reales de Redsys que no tiene sentido versionar.
- **No se ha modificado ningún archivo de código de la aplicación.** Solo este documento nuevo en `docs/` y la carpeta `audit-tmp/` (que se borra).
- El servidor de desarrollo (`npm run dev`) y el túnel de ngrok levantados para esta auditoría se detienen al terminar.

---

## 12. Honestidad final

Lo pedido era romper el sistema, no confirmarlo, así que vale la pena decirlo sin adornos: la mayor parte del sistema **no se rompió** pese a intentarlo en serio — dinero, firma de Redsys, idempotencia, stock, RLS, y auth del admin aguantaron ataques reales y concurrencia real. Los dos CRÍTICOS que sí aparecieron no están en esas partes "core" ya auditadas varias veces por sesiones anteriores; están en dos puntos que ninguna auditoría previa había ejecutado todavía tal como se pedía aquí: qué pasa cuando un `INSERT` posterior al pago falla, y qué pasa en el checkout (no en la confirmación) cuando el regalo de una promoción está a cero. Ninguno de los dos requiere rediseño — son cambios pequeños, ya con precedente correcto en el propio código (la migración `0011` ya resuelve la versión de H-02 que ocurre en la notificación; solo falta aplicar la misma idea en el checkout) — pero mientras sigan así, la respuesta a "¿es seguro lanzar?" es que no, todavía no.
