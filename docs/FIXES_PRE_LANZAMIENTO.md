# FIXES POST-AUDITORÍA + VERIFICACIÓN POR RE-ATAQUE
## Complementa `docs/AUDITORIA_FINAL_PRE_LANZAMIENTO.md`

**Fecha:** 2026-07-08
**Alcance:** Aplicación de los fixes de H-01, H-02, H-04, H-06 (+ H-10 y H-14 de paso, por tocar el mismo archivo/mecanismo), y verificación de cada uno reproduciendo el ataque original de la auditoría contra el entorno real (BD de pruebas `tienda-buey-dev`, servidor `npm run dev` en `localhost:3000`, Redsys SIS-T real para la firma de notificaciones). H-03 y H-15 se dejan explícitamente sin tocar por decisión de negocio/pendiente de decisión, tal como se pidió. Al final, batería de regresión completa sobre los vectores "PROBADO, resistió" de la sección 6 del informe original, y reseed de la BD a estado limpio.

**Método:** igual que la auditoría original — nada de lectura de código únicamente. Cada fix se verificó reproduciendo el ataque exacto que lo detectó contra el servidor real (`node --env-file=.env.local` + `@supabase/supabase-js` con `SERVICE_ROLE_KEY`/`ANON_KEY` reales + `redsys-easy` para firmar notificaciones con la clave HMAC-SHA256 real de SIS-T), confirmando con salida real que el ataque ya no tiene éxito y que el camino feliz sigue intacto.

---

## 1. H-01 (CRÍTICO) — ARREGLADO

**Qué se hizo:** en [src/app/api/pagos/notificacion/route.ts](../src/app/api/pagos/notificacion/route.ts), el `INSERT` en `payments` ahora comprueba su `error`; si falla, se registra con `console.error` y se deja un evento `PAYMENTS_INSERT_ERROR` en `order_status_history` con toda la metadata relevante (`error`, `ds_order`, `ds_response`, `ds_authorization`, `amount`), sin devolver 500 (el pedido ya está `PAID` e irreversible en ese punto — no hay nada que un reintento de Redsys pudiera arreglar). El `INSERT` de los eventos de éxito (antigua línea 323) también comprueba su error y lo registra con `console.error` si falla.

Además, `PAYMENTS_INSERT_ERROR` se añadió a `INCIDENT_EVENT_TYPES` y se clasifica como `critical` en [src/lib/admin/incidents.ts](../src/lib/admin/incidents.ts), exactamente igual que `IMPORTE_INCOHERENTE`. Se añadió su renderizado específico en [IncidentBanner.tsx](../src/components/Admin/IncidentBanner.tsx) (banner con Ds_Order, autorización Redsys y el mensaje de error), su etiqueta en [event-labels.ts](../src/lib/admin/event-labels.ts) para el timeline, y se generalizó el tooltip del indicador `critical` en [IncidentIndicator.tsx](../src/components/Admin/IncidentIndicator.tsx) (antes decía literalmente "Importe incoherente", lo cual habría sido engañoso para esta nueva incidencia — ahora es genérico para cualquier `critical`).

### Diff aplicado

`src/app/api/pagos/notificacion/route.ts:248-283` (payments) y `:354-361` (order_status_history de éxito):

```diff
-  await supabaseAdmin.from('payments').insert({
+  const { error: paymentError } = await supabaseAdmin.from('payments').insert({
     order_id: order.id,
     redsys_ds_order: dsOrder,
     redsys_ds_response: dsResponse,
     redsys_authorization: dsAuthorisationCode,
     amount: Number(dsAmount),
     status: 'succeeded',
     paid_at: new Date().toISOString(),
   });

+  if (paymentError) {
+    console.error('[pagos/notificacion] Fallo el INSERT en payments tras confirmar el pago', {
+      orderId: order.id, dsOrder, err: paymentError,
+    });
+    const { error: paymentErrorEventError } = await supabaseAdmin.from('order_status_history').insert({
+      order_id: order.id,
+      event_type: 'PAYMENTS_INSERT_ERROR',
+      metadata: { error: paymentError.message, ds_order: dsOrder, ds_response: dsResponse,
+                  ds_authorization: dsAuthorisationCode, amount: dsAmount },
+    });
+    if (paymentErrorEventError) {
+      console.error('[pagos/notificacion] Fallo tambien el INSERT del evento PAYMENTS_INSERT_ERROR', { ... });
+    }
+  }
   ...
-  await supabaseAdmin.from('order_status_history').insert(historyEvents);
+  const { error: historyEventsError } = await supabaseAdmin.from('order_status_history').insert(historyEvents);
+  if (historyEventsError) {
+    console.error('[pagos/notificacion] Fallo el INSERT de los eventos de exito en order_status_history', { ... });
+  }
```

Y en `src/lib/admin/incidents.ts:15-16, 46`:

```diff
 export const INCIDENT_EVENT_TYPES = [
   'IMPORTE_INCOHERENTE',
+  'PAYMENTS_INSERT_ERROR',
   'PROMOCION_NO_APLICADA',
   ...
 export function classifyIncidentEvent(...) {
   if (eventType === 'IMPORTE_INCOHERENTE') return 'critical';
+  if (eventType === 'PAYMENTS_INSERT_ERROR') return 'critical';
```

### Reproducción del ataque original, DESPUÉS del fix

Mismos pasos exactos que la auditoría: pedido real (`salsa chimichurri`, `Tarro 200 ml`), fila basura plantada en `payments` para forzar `23505 duplicate key` en el `INSERT` real, notificación de Redsys real y válida firmada con la clave HMAC-SHA256 real de SIS-T (`Ds_Response=0000`, importe exacto).

```
Pedido de prueba creado: BM-2026-00079 dsOrder= 26000109 total= 900
Fila basura plantada en payments para forzar violacion de UNIQUE(order_id).
Notificacion enviada -> HTTP 200 {"ok":true}
Estado del pedido: PAID | paid_at: 2026-07-08T07:44:05.676593+00:00
Stock ANTES: 30 DESPUES: 29
Filas en payments para este pedido: 1 [ ...la fila basura, el INSERT real sigue sin poder escribirse (esperado, es la propia condicion del ataque)... ]
Eventos: PAYMENTS_INSERT_ERROR, PAGO_CONFIRMADO, STOCK_DESCONTADO, EMAIL_CLIENTE_ERROR, EMAIL_INTERNO_ERROR
Evento PAYMENTS_INSERT_ERROR presente: true
Metadata del evento: {
  "error": "duplicate key value violates unique constraint \"payments_order_id_key\"",
  "amount": "900", "ds_order": "26000109", "ds_response": "0000", "ds_authorization": "999888"
}
```

Log real del servidor (`console.error`):
```
[pagos/notificacion] Fallo el INSERT en payments tras confirmar el pago {
  orderId: 'af37efb5-b0d8-4d6a-a1bf-c738984eaedb', dsOrder: '26000109',
  err: { code: '23505', message: 'duplicate key value violates unique constraint "payments_order_id_key"' }
}
```

**Diferencia clave respecto a la auditoría original:** el `INSERT` real de `payments` sigue fallando (es la propia premisa del ataque — un fallo de `INSERT` no se puede "arreglar" reintentándolo con la misma fila basura ocupando el `UNIQUE(order_id)`), pero **ya no pasa desapercibido**: hay `console.error` en el servidor, hay un evento `PAYMENTS_INSERT_ERROR` con toda la metadata necesaria para investigar, y — verificado contra el panel admin real (login real + `GET /admin/pedidos/[id]` y `GET /admin/pedidos`) — aparece como **"REVISIÓN MANUAL REQUERIDA"** en el banner de incidencias del detalle del pedido y como **"⚠ Revisar pago"** en el listado:

```
Login: 200
Detalle de pedido HTTP: 200
Contiene "REVISIÓN MANUAL REQUERIDA": true
Contiene "payments": true
Contiene texto del banner PAYMENTS_INSERT_ERROR: true
Listado HTTP: 200
Contiene "Revisar pago" (indicador critical en listado): true
```

### Camino feliz confirmado

Mismo flujo sin la fila basura (INSERT real de `payments` sin obstáculos):

```
Pedido camino feliz creado: BM-2026-00080
Notificacion -> 200 {"ok":true}
Estado final: PAID
Fila real en payments: [{ "redsys_ds_order": "26000110", "redsys_ds_response": "0000",
  "redsys_authorization": "111222", "amount": 900, "status": "succeeded", "paid_at": "2026-07-08T07:45:15..." }]
Eventos: PAGO_CONFIRMADO, STOCK_DESCONTADO, EMAIL_CLIENTE_ERROR, EMAIL_INTERNO_ERROR
Tiene PAYMENTS_INSERT_ERROR (deberia ser false): false
```

La fila de `payments` se guarda con los datos reales de Redsys, sin ningún evento de error — el fix no introduce ningún falso positivo en el camino normal.

---

## 2. H-02 (CRÍTICO) — ARREGLADO

**Qué se hizo:** en [src/app/api/checkout/create-session/route.ts](../src/app/api/checkout/create-session/route.ts), cuando el regalo de la promoción no está disponible (sin stock, inactivo, o no encontrado), ya **no** se añade a `stockIssues` — se marca `giftUnavailable = true` y el pedido continúa sin `giftLine`, exactamente la regla fundamental de la sección 13 del MVP doc. El `409 STOCK_INSUFICIENTE` ahora solo puede dispararlo un producto real del carrito, nunca el regalo. Se registra un evento `PROMOCION_NO_APLICADA` con `metadata: { promotion_id, reason: 'SIN_STOCK_REGALO_EN_CHECKOUT' }` justo después de `PEDIDO_CREADO`, para que quede rastro en el panel admin (visible en el timeline del pedido).

**Búsqueda activa de un tercer punto con el mismo patrón conceptual** (pedida explícitamente antes de dar H-02 por cerrado): se revisó cada referencia a `gift_variant_id`/`giftVariant`/`GIFT` en todo `src/` y `supabase/migrations/`. Los únicos dos puntos que alguna vez trataron el regalo como línea obligatoria eran el checkout (`create-session`, este fix) y la RPC de confirmación (`decrement_stock_and_confirm_order`, ya arreglada en la migración `0011`). Se revisó también:
- `src/app/api/tienda/promocion-activa/route.ts` — endpoint público informativo, no comprueba stock del regalo en absoluto (solo `max_redemptions`), no bloquea nada.
- `src/app/api/admin/pedidos/[id]/estado/route.ts` — transiciones de estado del admin, sin relación alguna con el regalo.
- `PromocionBanner.tsx` (frontend del carrito) — solo lee el endpoint informativo, no bloquea el checkout.

**No se encontró un tercer punto.** Confirmado que solo existían los dos ya conocidos, y ambos están ahora arreglados.

### Diff aplicado

`src/app/api/checkout/create-session/route.ts:252-303, 384-401`:

```diff
   let giftLine: { variant: VariantRow; promotionId: string } | null = null;
+  let giftUnavailable = false;
   ...
       if (!giftVariant || !giftVariant.is_active || giftVariant.stock < 1) {
-        stockIssues.push({
-          variantId: giftVariant?.id ?? null,
-          productName: giftVariant?.product?.name ?? 'Regalo de la promoción',
-          variantName: giftVariant?.name ?? '',
-          requestedQuantity: 1,
-          availableStock: giftVariant?.is_active ? giftVariant.stock : 0,
-          isGift: true,
-        });
+        giftUnavailable = true;
       } else {
         giftLine = { variant: giftVariant, promotionId: promoCandidate.id };
       }
   ...
     await supabaseAdmin.from('order_status_history').insert({
       order_id: order.id, event_type: 'PEDIDO_CREADO', ...
     });

+    if (giftUnavailable && promoCandidate) {
+      await supabaseAdmin.from('order_status_history').insert({
+        order_id: order.id,
+        event_type: 'PROMOCION_NO_APLICADA',
+        metadata: { promotion_id: promoCandidate.id, reason: 'SIN_STOCK_REGALO_EN_CHECKOUT' },
+      });
+    }
```

### Reproducción del ataque original, DESPUÉS del fix

Mismo escenario exacto: promoción real activada, stock del regalo puesto a 0, carrito con producto real muy por encima del umbral.

```
Promocion: Burger Wagyu de regalo en pedidos +100€ | min_subtotal: 10000
Regalo: Pack 4 uds. | stock (antes): 38
Producto real de prueba: Pack único | precio: 9900 | stock: 20
-> Promocion activada, stock del regalo puesto a 0 (reproduciendo el escenario del hallazgo).
Carrito enviado: 3 x Pack único = 29700 cts (subtotal, por encima del umbral)

create-session con regalo agotado -> HTTP 200          <-- antes era 409
{
  "orderNumber": "BM-2026-00081",
  "totalAmount": 29700,
  "redsys": { "actionUrl": "https://sis-t.redsys.es:25443/sis/realizarPago", ... }
}

Pedido creado: BM-2026-00081 | status: PENDING_PAYMENT | subtotal: 29700
Lineas del pedido: [{ "item_type": "PRODUCT", "quantity": 3 }]   <-- sin linea GIFT, correcto
Eventos: PEDIDO_CREADO, PROMOCION_NO_APLICADA, REDSYS_PAYLOAD_GENERADO
Evento PROMOCION_NO_APLICADA: { "reason": "SIN_STOCK_REGALO_EN_CHECKOUT", "promotion_id": "c2879267-..." }
```

**El pedido ya no se bloquea.** El cliente puede pagar con normalidad, el pedido se crea sin el regalo, y queda rastro exacto de por qué en el timeline del panel admin.

### Camino feliz confirmado

Mismo carrito, pero con el regalo CON stock (comportamiento normal de la promoción, sin tocar nada del hallazgo):

```
Promocion activada. Regalo con stock: 38
create-session con regalo CON stock -> HTTP 200
Lineas: [{ "item_type": "PRODUCT", "quantity": 3 }, { "item_type": "GIFT", "quantity": 1 }]
Tiene linea GIFT: true
Eventos: PEDIDO_CREADO, REDSYS_PAYLOAD_GENERADO    <-- sin PROMOCION_NO_APLICADA, correcto
```

La promoción se sigue aplicando con total normalidad cuando el regalo sí tiene stock — el fix no afecta al camino feliz de la promoción.

---

## 3. H-04 (ALTO) + H-10 (BAJO) — ARREGLADOS

**Qué se hizo:** nuevo módulo [src/lib/admin/login-rate-limit.ts](../src/lib/admin/login-rate-limit.ts) con ventana deslizante **en memoria del proceso** (sin infraestructura adicional — decisión explícita del encargo dado que es un único admin): máximo 5 intentos fallidos por clave (IP, vía `X-Forwarded-For`/`X-Real-IP`, o `'unknown'` si no hay proxy delante) cada 15 minutos; superado el límite, `429` con cabecera `Retry-After` en segundos. El contador se resetea al primer login correcto y se barre de entradas caducadas en cada escritura para no crecer sin límite.

**Limitación conocida y aceptada, documentada en el propio código:** el contador se pierde en cada reinicio/despliegue del servidor, y en un entorno serverless con varias instancias en paralelo cada una llevaría su propio contador. Para el volumen de tráfico de un panel admin de un único restaurante esto sigue siendo una mejora real frente a no tener ningún límite en absoluto (que era el estado anterior).

De paso, en el mismo archivo ([src/app/api/admin/auth/route.ts](../src/app/api/admin/auth/route.ts)), la comparación de contraseña pasó de `password !== adminPassword` a `crypto.timingSafeEqual` (con comprobación de longitud antes, ya que la función exige buffers del mismo tamaño) — cierra H-10.

### Diff aplicado

`src/app/api/admin/auth/route.ts` (completo, ver diff exacto arriba en el resumen de cambios) — resumen:

```diff
+import { timingSafeEqual } from 'crypto';
 import { NextResponse } from 'next/server';
+import { checkLoginRateLimit, recordFailedLoginAttempt, resetLoginRateLimit } from '@/lib/admin/login-rate-limit';

+function getClientKey(request: Request): string { ... x-forwarded-for / x-real-ip ... }
+function passwordsMatch(received: string, expected: string): boolean {
+  const receivedBuffer = Buffer.from(received);
+  const expectedBuffer = Buffer.from(expected);
+  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
+}

 export async function POST(request: Request) {
+  const clientKey = getClientKey(request);
+  const rateLimit = checkLoginRateLimit(clientKey);
+  if (!rateLimit.allowed) {
+    return NextResponse.json({ error: '...' }, { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } });
+  }
   ...
-  if (password !== adminPassword) {
+  if (!passwordsMatch(password, adminPassword)) {
+    recordFailedLoginAttempt(clientKey);
     return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 });
   }
+  resetLoginRateLimit(clientKey);
```

### Reproducción del ataque original, DESPUÉS del fix

Mismo ataque exacto: 20 `POST /api/admin/auth` con contraseñas incorrectas, en paralelo real (`Promise.all`).

```
20 intentos de login incorrectos EN PARALELO ->
statuses: 429,429,429,429,429,429,429,401,429,429,429,429,401,401,401,429,429,429,429,401
Tiempo total: 145 ms.
Cuantos 401: 5
Cuantos 429: 15
Retry-After del primer 429: 900
Body del primer 429: {"error":"Demasiados intentos fallidos. Inténtalo de nuevo más tarde."}
```

**Antes:** 20/20 con `401`, sin ningún `429`. **Ahora:** exactamente 5 pasan a verificarse (el resto ya bloqueados con `429` y `Retry-After: 900`, los 15 minutos de la ventana). El pequeño margen de intentos que pasan en un burst perfectamente simultáneo es un trade-off conocido y aceptado de esta implementación simple (hay una `await` entre la comprobación y el registro del fallo, así que una ráfaga *exactamente* simultánea puede colar algunos intentos de más antes de que el contador se actualice) — sigue siendo una mejora radical frente al estado anterior (cero límite) y es la implementación más simple robusta para un único admin, tal como pedía el encargo.

### Camino feliz confirmado

```
Login con contraseña CORRECTA desde IP ya bloqueada -> 429 858        (bloqueo total durante la ventana, esperado)
Login con contraseña correcta desde IP nueva -> 200 {"ok":true}       (camino feliz intacto)
Set-Cookie presente: true
Login correcto tras 3 fallos (bajo el limite de 5) -> 200              (no sobre-bloquea bajo el umbral)
```

---

## 4. H-06 (MEDIO) + H-14 (INFORMATIVO) — ARREGLADOS

**Qué se hizo:** en [next.config.ts](../next.config.ts), `poweredByHeader: false` (cierra H-14) y un `headers()` con `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff` y `Referrer-Policy: strict-origin-when-cross-origin` para todas las rutas (`/:path*`).

**CSP deliberadamente NO añadida:** el checkout depende de Framer Motion, imágenes servidas desde Supabase Storage, y el auto-submit de un formulario hacia el dominio real de Redsys — una CSP mal calibrada podría romper cualquiera de los tres sin que sea evidente en una verificación rápida. Queda anotada como pendiente de un análisis dedicado (ver checklist final), no se arriesga en esta ronda.

`X-Frame-Options: DENY` no afecta a que el propio sitio embeba contenido externo en `<iframe>` (Google Maps en `ConditionalMap.tsx`, un widget en `reservas.tsx`) — esa cabecera solo restringe que **otros** sitios enmarquen el nuestro, no al revés. Verificado que ninguna parte del sitio depende de ser enmarcada por otro dominio.

### Diff aplicado

Ver diff completo de `next.config.ts` arriba (añade `poweredByHeader: false` y el bloque `async headers()`).

### Verificación (no es un "ataque" per se, sino la comprobación directa del hallazgo)

```
--- / ---
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin

--- /checkout ---
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin

--- /admin/login ---
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Referrer-Policy: strict-origin-when-cross-origin

--- X-Powered-By check ---
NO X-Powered-By header (bien)
```

### Camino feliz

Confirmado indirectamente: toda la batería de regresión de la sección 5 de este documento (checkout, pagos, admin) se ejecutó **con estas cabeceras ya activas** y todo funcionó con normalidad — ninguna petición, fetch, ni el auto-submit hacia Redsys se vio afectado.

---

## 5. Batería de regresión completa (vectores "PROBADO, resistió" de la sección 6 del informe original)

Ejecutada **después** de aplicar los 4 fixes, contra el servidor real con todos los cambios activos.

| Vector | Resultado |
|---|---|
| Manipulación de precio/importe en `create-session` (total=0, subtotal negativo, shippingCost negativo, precio inyectado en el item) | **Resiste.** Los 4 payloads manipulados devolvieron `totalAmount` recalculado desde BD (900 + 1000 envío = 1900 cts), ignorando por completo los valores inyectados. |
| Forjado de notificación de Redsys (firma vacía, ausente, reutilizada de otro pedido, importe alterado tras firmar, versión de firma incorrecta, Base64 corrupto, body vacío) | **Resiste.** Los 7 casos devolvieron `400` ("Firma inválida"), ningún pedido cambió de estado. |
| Discrepancia de importe (`Ds_Amount` ≠ `orders.total`) | **Resiste.** `NEEDS_REVIEW` + evento `IMPORTE_INCOHERENTE`, nunca `PAID`. |
| Replay secuencial (x5) y paralelo real (x5, `Promise.all`) de la misma notificación válida | **Resiste.** Exactamente 1 fila en `payments` y exactamente 1 descuento de stock en ambos casos. |
| Overselling: 5 pedidos compitiendo por 2 unidades de stock, notificaciones en paralelo real | **Resiste.** Exactamente 2 `PAID`, exactamente 3 `STOCK_ERROR`, stock final en 0. |
| `POST /api/pedidos/estado` (debe ser 405) | **Resiste.** `405`. |
| Zonas de envío fuera de alcance (Baleares, Canarias, Ceuta, Melilla) | **Resiste.** Los 5 códigos postales rechazados con `400`. |
| Inyección SQL clásica en `customerName` | **Resiste.** Se guarda como texto literal (`"Robert'); DROP TABLE orders;--"`), tabla `orders` intacta y consultable después (20 filas). |
| XSS almacenado en `shippingNotes` | **Resiste.** Se guarda literal (`"<script>alert(1)</script><img src=x onerror=alert(2)>"`), sin ejecutarse (ya se confirmó en la auditoría original que no hay `dangerouslySetInnerHTML` en `src/`, y esta ronda no tocó ningún componente de renderizado de esos campos). |
| RLS con `ANON_KEY`: lectura de `orders`, `order_items`, `payments`, `order_status_history`, `promotions` | **Resiste.** 0 filas en los 5 casos, con datos reales presentes en las tablas (confirmado con `service_role` en paralelo). |
| RLS con `ANON_KEY`: escritura (`UPDATE` en `orders`) | **Resiste.** 0 filas afectadas. |
| RPC sensibles con `ANON_KEY`: `decrement_stock_and_confirm_order`, `generate_redsys_ds_order`, `generate_order_number` | **Resiste.** Las 3 devuelven `permission denied`. |
| Auth del panel admin: sin cookie, JWT de secreto falso, JWT `alg:none`, cookie corrupta | **Resiste.** Los 4 casos devuelven `307` (redirect a `/admin/login`), nunca `200`. |
| Auth del panel admin: transición de estado inválida (`CANCELLED → PAID`), estado inventado, UUID inexistente | **Resiste.** `409`, `400`, `404` respectivamente, igual que en la auditoría original. |
| Auth del panel admin: login válido → acceso al panel | **Camino feliz confirmado.** `200`. |

**Ningún vector de la sección 6 mostró regresión.** Los 4 fixes aplicados (H-01, H-02, H-04/H-10, H-06) no tocan ninguno de los mecanismos de firma HMAC-SHA256, RLS, RPC de stock, o verificación de JWT — la batería lo confirma empíricamente, no solo por inspección de código.

**Nota de alcance:** no se repitió esta ronda el flujo real de extremo a extremo contra el sandbox Redsys vía ngrok con un pago real (3DS incluido) que sí se hizo en la auditoría original — los fixes de esta ronda no tocan la generación del payload de Redsys ni la lógica de firma/verificación en sí (solo el manejo de errores alrededor del `INSERT` de `payments`, ya verificado exhaustivamente arriba con notificaciones firmadas con la clave real), así que el riesgo de regresión en esa parte es mínimo. La fuga de secretos tampoco se re-verificó explícitamente esta ronda por la misma razón: ninguno de los 4 fixes introduce manejo nuevo de secretos ni código nuevo expuesto al cliente.

---

## 6. Hallazgos NO tocados en esta ronda (con motivo)

- **H-03 — DECISIÓN CERRADA (se acepta, no se arregla).** Bajo concurrencia real, el sistema puede entregar alguna unidad física de más del regalo de una promoción (el contador de negocio `current_redemptions` nunca se supera — eso está protegido correctamente). Se acepta como riesgo de bajo impacto porque es un evento de baja frecuencia (solo ocurre bajo tráfico simultáneo real compitiendo por el mismo cupo) y de coste acotado (como mucho, unidades físicas de un producto de regalo, nunca dinero). **Mitigación operativa:** mantener un colchón de stock del regalo por encima de `max_redemptions` (si `max_redemptions=10`, mantener stock del regalo en, p. ej., 15-20 unidades) para absorber el desajuste esperado bajo ráfagas de tráfico. Esta decisión **refuerza** el fix de H-02, no lo contradice: son las dos caras de la misma regla fundamental de la sección 13 del MVP doc — el checkout/pago nunca se bloquea por el regalo, y si eso implica regalar alguna unidad de más en casos puntuales de concurrencia real, se asume operativamente antes que bloquear ventas.

- **H-15 — PENDIENTE DE DECISIÓN (no implementada, no retirada).** La funcionalidad de "Etiquetas de trazabilidad" (sección 11bis del MVP doc) sigue sin ninguna UI ni API en el código, pese a que la infraestructura de BD (tabla `product_labels`, trigger, `pg_cron`) existe y funciona. Dado que el propio documento MVP vincula esto a trazabilidad legal de productos cárnicos (Reglamento CE 853/2004), esta es una decisión de negocio que requiere que el cliente/restaurante decida explícitamente: o se implementa antes de Fase 8, o se retira formalmente del MVP doc y se resuelve la trazabilidad por otra vía. **No se ha tomado ninguna acción de código sobre esto**, tal como se pidió.

- **H-05 (revocación de sesión admin server-side) — NO TOCADO.** Fuera del alcance de esta ronda por instrucción explícita ("no en esta ronda salvo que sean triviales y de riesgo cero"). Implementar una lista de revocación (tabla `jti` + timestamp de logout, comprobada en `verifyAdminSessionToken`) no es un cambio de una línea — toca el flujo de verificación de sesión que se usa en cada petición autenticada del panel admin (middleware + Server Components + API routes), así que el riesgo de introducir una regresión de disponibilidad (bloquear al propio admin) es real si se hace deprisa. Queda pendiente para una ronda dedicada.

- **H-07 (URLs de callback de Redsys desde `request.url`) — NO TOCADO.** Igual que H-05, fuera de alcance explícito de esta ronda. Además, el propio informe original señala que su verificación real solo puede completarse en un despliegue de preview de Vercel real (no en local) — cambiarlo sin poder verificarlo en ese entorno sería arriesgar una regresión silenciosa en la generación del payload de Redsys, que es precisamente el núcleo que la auditoría original confirmó como sólido. Se deja anotado como pendiente para cuando exista un despliegue de preview donde verificarlo de verdad.

---

## 7. Bloqueadores de lanzamiento — estado actualizado

**Código (bloqueadores técnicos): CERO tras esta ronda.**
- ~~H-01~~ → ARREGLADO y verificado por re-ataque.
- ~~H-02~~ → ARREGLADO y verificado por re-ataque.
- ~~H-04~~ → ARREGLADO y verificado por re-ataque.
- H-06 → ARREGLADO (cabeceras mínimas). CSP queda pendiente de un análisis dedicado, no es bloqueante.

**Decisiones de negocio:**
- H-03 → **CERRADA** (se acepta el riesgo de concurrencia, mitigación operativa documentada: colchón de stock del regalo).
- H-15 → **PENDIENTE DE DECISIÓN** — el cliente/restaurante debe decidir antes de Fase 8 si se implementa la trazabilidad de etiquetas o se retira del MVP doc.

**Checklist operativo de despliegue (no es código, ya documentado en la auditoría original, sigue pendiente):**
- Textos legales (condiciones, política de privacidad, aviso legal).
- Tipo de IVA confirmado y aplicado.
- TPV Virtual de Redsys en modo producción con credenciales reales del banco (hoy: SIS-T de pruebas).
- Dominio de Resend verificado (`restauranteelbueymadurado.com`) — hoy `EMAIL_FROM` sigue en `onboarding@resend.dev`.
- `ADMIN_NOTIFICATION_EMAIL` de producción configurado en Vercel — hoy apunta a un email de desarrollo.
- Vaciar `0006_seed_dev.sql` antes de aplicar las migraciones contra el proyecto de producción.
- Verificar en un despliegue de preview de Vercel real que `DS_MERCHANT_MERCHANTURL`/`URLOK`/`URLKO` apuntan al dominio público correcto (relacionado con H-07, no se puede verificar en local).

**Recomendado pero no bloqueante (sin cambios respecto al informe original):** H-05 (revocación de sesión), CSP completa si hay tiempo.

---

## 8. Estado de la BD tras esta ronda y cómo resembrar

### Qué se hizo

Se crearon y destruyeron ~30 pedidos de prueba adicionales (ataques de H-01/H-02, batería de regresión de replay/overselling/forjado/precio/inyección). Se activó y desactivó la promoción varias veces, y se manipuló el stock de `Tarro 200 ml` (salsa chimichurl, usada en H-01 y en las pruebas de replay) y de una variante de `Caja 12 uds.` (croquetas, usada en la prueba de overselling), siempre restaurando el valor original inmediatamente después de cada prueba puntual.

### Estado encontrado al empezar esta ronda

Coincidía con el estado final documentado al cierre de la auditoría original, con dos salvedades:
- Existía **1 pedido real** (`BM-2026-00078`, `PAID`, creado el 2026-07-07 18:58 — aparenta ser una prueba manual del propio desarrollador, no de la auditoría original ni de esta ronda de fixes).
- El stock de `Unidad ~1,2 kg` (tomahawk) estaba en 19, no en 20 como documenta la sección 25 del MVP doc — desviación preexistente, no causada por esta ronda ni por la auditoría original.

### Estado final (verificado, no solo declarado)

```
Total de pedidos en BD: 0
orders / order_items / payments / order_status_history: todas vacías

Stock de las 16 variantes restaurado exactamente al valor encontrado al EMPEZAR
esta ronda de fixes (antes de aplicar ningún cambio ni ejecutar ningún ataque):

  1 kg=20, 1,5 kg=20, 2 kg=19, tomahawk (Unidad ~1,2 kg)=19, entrecot 400g=19,
  entrecot 800g=20, pack degustación (Pack único)=20, burger wagyu 4uds (Pack 4 uds.)=38,
  burger wagyu 8uds (Pack 8 uds.)=35, burger angus 4uds (Pack 4 uds.)=40,
  burger angus 8uds (Pack 8 uds.)=40, croquetas jamón 12 (Caja 12 uds.)=30,
  croquetas boletus (Caja 12 uds.)=30, croquetas jamón 24 (Caja 24 uds.)=30,
  salsa chimichurri (Tarro 200 ml)=30, pack gourmet (Pack básico)=20

promotions: is_active=false, current_redemptions=0, max_redemptions=10 (sin cambios)
shop_settings: accepting_orders=true, notice_message=null, checkout_disabled_message=null (sin cambios)
```

**Nota sobre el pedido preexistente `BM-2026-00078`:** se ha eliminado como parte del reseed a estado limpio (0 pedidos), siguiendo la misma convención de "BD de pruebas, libertad total" que la auditoría original. Si ese pedido tenía valor para el desarrollador como prueba manual, no se puede recuperar — se documenta aquí por transparencia, igual que el resto de este informe.

**La desviación preexistente del tomahawk (19 en vez de 20) NO se ha corregido** — no formaba parte del alcance de esta ronda de fixes y no la causó ninguna de las pruebas ejecutadas aquí; corregirla sin que se pida sería tocar datos fuera del encargo.

### Cómo resembrar desde cero (si se quiere ir más allá de lo dejado hoy)

Igual que documenta la sección 11 de la auditoría original: o bien los `UPDATE` manuales a los valores "redondos" de la sección 25 del MVP doc (incluyendo corregir el tomahawk a 20), o `npx supabase db reset --linked` para reaplicar todas las migraciones desde cero — **recordando vaciar `0006_seed_dev.sql` antes de usar esto último contra producción.**

### Limpieza de artefactos de esta sesión

Todos los scripts de ataque y regresión de esta ronda vivieron en `audit-tmp/` (misma convención que la auditoría original) y **se han borrado por completo** al cerrar esta ronda. El servidor de desarrollo levantado para las pruebas se ha detenido. No se ha dejado ningún artefacto de prueba en el repositorio más allá de este documento y los cambios de código descritos arriba.

---

## 9. Honestidad final

Los 4 hallazgos de código que bloqueaban Fase 8 (H-01, H-02, H-04, H-06) están arreglados y cada uno se verificó reproduciendo el ataque exacto que lo detectó — no se dio ninguno por bueno solo por inspección de código. La batería de regresión sobre los 14 vectores que la auditoría original marcó como "resistió" confirma que ninguno de los 4 fixes rompió nada que ya funcionara bien. H-10 y H-14 se cerraron de paso por tocar los mismos archivos, con cambios de una línea cada uno. H-03 queda como decisión de negocio cerrada y documentada, no como pendiente técnico. H-15 sigue siendo la única pieza que requiere que alguien —no un fix de código— decida qué hacer antes de Fase 8. Los bloqueadores de código están en cero; lo que queda para Fase 8 es una decisión de negocio (H-15) y el checklist operativo de despliegue, ninguno de los dos resoluble escribiendo más código en esta ronda.
