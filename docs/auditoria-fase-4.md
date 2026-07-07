# Auditoría — Fase 4 (Checkout y Redsys)

**Fecha:** 2026-07-06
**Alcance:** Checkout completo ya commiteado: `POST /api/checkout/create-session`, `GET /api/pedidos/estado`, `POST /api/pagos/notificacion` (stub), generación del payload Redsys, página de confirmación con polling. Incluye el fix de seguridad ya aplicado en `3413ac6` (recorte de `paidAt` en `/api/pedidos/estado`).

**Nivel:** intermedio — más profunda que la auditoría de Fase 3 (5 puntos, [docs/auditoria-fase-3.md](auditoria-fase-3.md)), pero no forense. La auditoría exhaustiva de nivel Fase 1 se reserva para el cierre de la Fase 5, cuando la notificación real mueva dinero y stock de principio a fin.

**Proyecto Supabase verificado:** `tienda-buey-dev` (`pwkpuvagoupvynamskmh`) — confirmado con `npx supabase projects list` antes de empezar.

**Postura:** solo lectura sobre código. Las pruebas de comportamiento se hicieron contra la BD de desarrollo real: se levantó `npm run dev`, se crearon 3 pedidos de prueba reales vía `curl` (`BM-2026-00014`, `BM-2026-00015`, más el pedido preexistente `BM-2026-00013` de una sesión anterior) y los tres se borraron al terminar (ver punto 6). También se generaron notificaciones de Redsys firmadas a mano (HMAC-SHA256 + 3DES, replicando el algoritmo interno de `redsys-easy` con la clave pública de pruebas SIS-T `sq7HjrUOBfKmC576ILgskD5srU870gJ7`, documentada en la sección 15 del MVP) para probar el stub de notificación sin depender de una llamada real de Redsys.

---

## Tabla de resultados

| # | Punto | Veredicto | Evidencia clave |
|---|-------|-----------|-----------------|
| 1 | Exposición de datos en las 3 rutas nuevas | **PASS** | Ver detalle abajo |
| 2 | Uso de `supabase-admin`/`redsys.ts` acotado + bundle limpio | **PASS** | Ver detalle abajo |
| 3 | RLS y permisos sin cambios | **PASS** | Ver detalle abajo |
| 4 | Integridad de `create-session` (precio, stock, unicidad, promoción) | **PASS** | Ver detalle abajo |
| 5 | Stub de notificación — alcance conocido | **PASS** (con TODO documentado, no bloqueante) | Ver detalle abajo |
| 6 | Pedidos huérfanos por cancelación | **WARN** (observación ya conocida, documentada) | Ver detalle abajo |

Ningún FAIL. Ningún cambio de código aplicado en esta auditoría — todo pasó tal cual estaba.

---

## 1 — Exposición de datos en las 3 rutas nuevas (crítico) — PASS

### a) `POST /api/checkout/create-session`

Pedido de prueba real creado con `curl` (carrito: 2× Entrecot Madurado 400g, variante `33333333-0000-0000-0000-000000000005`, precio real 2200 cts, sin promoción activa):

```
POST /api/checkout/create-session
```

Respuesta JSON completa y literal:

```json
{
  "orderNumber": "BM-2026-00014",
  "totalAmount": 5400,
  "redsys": {
    "actionUrl": "https://sis-t.redsys.es:25443/sis/realizarPago",
    "Ds_SignatureVersion": "HMAC_SHA256_V1",
    "Ds_MerchantParameters": "eyJEU19NRVJDSEFOVF9BTU9VTlQiOiI1NDAwIiwi...",
    "Ds_Signature": "MrPIPAr7k3Sd4dSyj3UGYGFKH64MazaTvG0MbWdo0Es="
  }
}
```

Verificación explícita: **no aparece** `id` (UUID interno del pedido), ni `customer_name`, `customer_email`, `customer_phone`, ni dirección de envío — todos datos que el frontend ya tiene desde el formulario que él mismo envió. Coincide exactamente con el tipo `CreateSessionSuccess` en [src/types/checkout.ts:8-12](../src/types/checkout.ts#L8-L12).

El propio `Ds_MerchantParameters` (que sí viaja con datos, pero *hacia Redsys*, no como dato reenviado al frontend para su propio uso) se decodificó para confirmar que solo lleva los campos que Redsys exige para el auto-submit:

```json
{
  "DS_MERCHANT_AMOUNT": "5400",
  "DS_MERCHANT_ORDER": "26000015",
  "DS_MERCHANT_MERCHANTCODE": "999008881",
  "DS_MERCHANT_CURRENCY": "978",
  "DS_MERCHANT_TRANSACTIONTYPE": "0",
  "DS_MERCHANT_TERMINAL": "001",
  "DS_MERCHANT_MERCHANTURL": "http://localhost:3000/api/pagos/notificacion",
  "DS_MERCHANT_URLOK": "http://localhost:3000/pedido/confirmacion?order=BM-2026-00014",
  "DS_MERCHANT_URLKO": "http://localhost:3000/carrito?pago=fallido",
  "DS_MERCHANT_PRODUCTDESCRIPTION": "Pedido BM-2026-00014",
  "DS_MERCHANT_TITULAR": "Auditoria Fase4"
}
```

`DS_MERCHANT_TITULAR` incluye nombre y apellidos porque Redsys lo exige como titular de la tarjeta — no es un reenvío al frontend, va cifrado/firmado hacia el TPV. No hay UUID interno en ningún punto de la respuesta al navegador.

### b) `GET /api/pedidos/estado`

Llamada real contra el pedido recién creado:

```
GET /api/pedidos/estado?order=BM-2026-00014
→ {"orderNumber":"BM-2026-00014","status":"PENDING_PAYMENT"}
```

Y contra un `order_number` inexistente (comprobando que tampoco hay diferencia de comportamiento explotable):

```
GET /api/pedidos/estado?order=BM-2026-99999
→ {"error":"PEDIDO_NO_ENCONTRADO"}
```

Confirmado: sigue devolviendo exactamente `{ orderNumber, status }`, sin `paidAt` (el campo recortado en `3413ac6`) ni ningún otro dato. Coincide con [src/types/checkout.ts:32-35](../src/types/checkout.ts#L32-L35), que ya documenta en un comentario por qué el endpoint es deliberadamente mínimo (`order_number` es enumerable).

### c) `POST /api/pagos/notificacion`

Esta ruta la llama Redsys, no el navegador — se probó generando una notificación válida firmada a mano para el pedido de prueba (`Ds_Order = 26000015`, `Ds_Response = 0000`):

```
POST /api/pagos/notificacion
Body: Ds_SignatureVersion=HMAC_SHA256_V1&Ds_MerchantParameters=...&Ds_Signature=...

→ HTTP 200
→ {"ok":true}
```

Respuesta literal: **solo** `{"ok":true}`. No hay eco de `order_id`, `status`, importes ni ningún dato interno del pedido — es el acuse de recibo mínimo que Redsys necesita para no reintentar.

**Conclusión punto 1:** las tres rutas están correctamente acotadas. No hay ningún hallazgo nuevo de tipo `paidAt` que corregir.

---

## 2 — Uso de `supabase-admin` acotado — PASS

```
grep -rln "supabase-admin" src/
```

```
src/app/api/checkout/create-session/route.ts
src/app/api/pagos/notificacion/route.ts
src/app/api/pedidos/estado/route.ts
src/app/api/tienda/promocion-activa/route.ts
src/lib/order-number.ts
```

Los 4 primeros son route handlers server-side (`export async function GET/POST`). El quinto, [src/lib/order-number.ts](../src/lib/order-number.ts), es un wrapper server-only (`import 'server-only'` en la línea 1) usado únicamente por `create-session/route.ts`. Ningún Client Component aparece en la lista.

`grep -rln "from '@/lib/redsys'" src/` devuelve únicamente:

```
src/app/api/checkout/create-session/route.ts
src/app/api/pagos/notificacion/route.ts
```

[src/lib/redsys.ts](../src/lib/redsys.ts) también importa `'server-only'` en la línea 1 — revienta el build si algún día se importa desde un Client Component. No aparece en ningún archivo de `src/components/`.

**Bundle de producción:** `next build` (Next.js 16.1.4, Turbopack) compiló correctamente. Búsqueda en `.next/static` (los chunks servidos al navegador):

```
grep -rl "SUPABASE_SERVICE_ROLE_KEY" .next/static  → sin resultados
grep -rl "<valor real de la key>"    .next/static  → sin resultados
grep -rl "REDSYS_SECRET_KEY"         .next/static  → sin resultados
grep -rl "sq7HjrUOBfKmC576ILgskD5srU870gJ7" .next/static → sin resultados
```

Ninguno de los dos nombres de variable ni sus valores reales aparece en el código servido al cliente.

---

## 3 — RLS y permisos: nada se ha movido sin querer — PASS

**Políticas activas** sobre las tablas sensibles de esta fase:

```sql
SELECT policyname, tablename, roles FROM pg_policies
WHERE tablename IN ('orders','order_items','payments','order_status_history','promotions','product_variants');
```

```json
[{"policyname":"anon puede leer variantes activas","roles":"{anon}","tablename":"product_variants"}]
```

Única fila. `orders`, `order_items`, `payments`, `order_status_history` y `promotions` **no tienen ninguna política para `anon`** — siguen bloqueadas por defecto (RLS activado, `relrowsecurity = true` confirmado para las 6 tablas, sin ninguna policy que abra acceso público).

**Migraciones aplicadas desde la 0009** (posteriores al cierre de la auditoría de Fase 3): `0009_fix_atomic_stock_rpc.sql`, `fix_seed_product_images_placeholder.sql`, `order_number_generator.sql`. Las tres se revisaron con grep de `POLICY|ROW LEVEL SECURITY`: ninguna toca RLS. Solo `GRANT`/`REVOKE EXECUTE` sobre funciones (`decrement_stock_and_confirm_order`, `generate_order_number`) y sobre la secuencia `order_number_seq` — hardening de privilegios, no política de fila.

**Prueba real con la anon key** (misma que usaría el navegador), vía PostgREST directo:

```
GET {SUPABASE_URL}/rest/v1/orders?select=*        → []
GET {SUPABASE_URL}/rest/v1/order_items?select=*   → []
GET {SUPABASE_URL}/rest/v1/payments?select=*       → []
```

Las tres devuelven array vacío pese a haber pedidos reales en la tabla en el momento de la prueba — confirma que `anon` no puede leer ninguna fila, no que la tabla estuviera vacía.

---

## 4 — Integridad de `create-session`: revalidación real — PASS

### a) Manipulación de precio

El esquema Zod de entrada ([src/lib/checkout-schema.ts:46-49](../src/lib/checkout-schema.ts#L46-L49)) define `cartLineItemSchema` con **únicamente** `variantId` y `quantity` — no existe ningún campo de precio en el esquema. Es diseño correcto por construcción: no hay que confirmar que "se ignora", porque no hay dónde meterlo.

Se probó igualmente en runtime, enviando campos espurios (`price`, `unitPrice`, `unit_price`, `totalAmount`, todos a `1`) junto al carrito real:

```
POST /api/checkout/create-session  (variantId real, quantity: 1, price: 1, ...)
→ {"orderNumber":"BM-2026-00015","totalAmount":3200, ...}
```

`3200 = 2200 (precio real de BD) + 1000 (envío)`. Confirmado en BD:

```sql
SELECT unit_price_snapshot, quantity, line_total FROM order_items WHERE order_id = (...);
→ {"line_total":2200,"quantity":1,"unit_price_snapshot":2200}
```

Zod descarta silenciosamente las claves no declaradas en el esquema (comportamiento por defecto de `z.object` sin `.passthrough()`); el backend nunca llega a ver esos campos.

### b) Sobreventa de stock

Variante de prueba con `stock = 20`. Petición pidiendo 50 unidades (dentro del límite de Zod `max(50)`, por encima del stock real):

```
POST /api/checkout/create-session  (quantity: 50)
→ HTTP 409
→ {"error":"STOCK_INSUFICIENTE","message":"...","items":[{"variantId":"...","productName":"Entrecot Madurado","variantName":"400 g","requestedQuantity":50,"availableStock":20,"isGift":false}]}
```

Confirmado **en BD, no solo por el código HTTP**, que no se creó nada:

```sql
SELECT order_number, customer_email FROM orders WHERE customer_email = 'auditoria.fase4.stock@example.com';
→ [] (sin filas)
```

### c) Unicidad de `order_number` / `redsys_ds_order`

Los dos pedidos de prueba creados en esta sesión con carritos equivalentes generaron valores distintos:

```
BM-2026-00014 → redsys_ds_order 26000015
BM-2026-00015 → redsys_ds_order 26000016
```

Ambos generados atómicamente vía RPC (`generate_order_number`, `generate_redsys_ds_order`), sin condición de carrera de conteo en JS.

### d) Criterio de desempate de promoción

La Fase 3 pidió explícitamente `ORDER BY created_at ASC LIMIT 1` para evitar depender del orden implícito de PostgREST. Confirmado en el código actual, [src/app/api/checkout/create-session/route.ts:141-148](../src/app/api/checkout/create-session/route.ts#L141-L148):

```typescript
const { data: promoRows, error: promoError } = await supabaseAdmin
  .from('promotions')
  .select('id, min_subtotal, max_redemptions, current_redemptions, gift_variant_id')
  .eq('is_active', true)
  .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
  .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
  .order('created_at', { ascending: true })
  .limit(1);
```

Se aplicó, no solo se pidió. (No se pudo re-probar el camino con regalo en esta sesión porque la promoción del seed sigue `is_active = false`, tal como quedó restaurada al cierre de la auditoría de Fase 3 — no se ha tocado ese estado aquí.)

---

## 5 — El stub de notificación: alcance conocido, confirmado de nuevo — PASS (con TODO ya aceptado)

Código actual leído en [src/app/api/pagos/notificacion/route.ts](../src/app/api/pagos/notificacion/route.ts): sin cambios respecto a lo confirmado en la sesión anterior — los ajustes de UI recientes no tocaron este archivo.

**Prueba en vivo — no distingue autorizado de denegado.** Se envió una notificación firmada con `Ds_Response = 0000` (autorizado) y, después, otra para el mismo pedido con `Ds_Response = 0596` (denegado en el rango real de Redsys):

```
Ds_Response=0000 → HTTP 200, {"ok":true}
Ds_Response=0596 → HTTP 200, {"ok":true}
```

Comportamiento idéntico en ambos casos: el handler solo verifica la firma HMAC-SHA256 (criptografía pura, no interpreta el valor) y registra el evento. Confirmado en BD que ambas notificaciones insertaron una fila `NOTIFICACION_RECIBIDA_STUB` en `order_status_history` con el `Ds_Response` correspondiente en `metadata`, sin ninguna rama de código que actúe distinto según su valor.

**Esto es el TODO ya conocido y aceptado para la Fase 5, no un hallazgo nuevo de esta auditoría.** Queda documentado aquí explícitamente para que no se pierda entre conversaciones — el propio código ya lo señala de forma muy visible en el comentario de cabecera del archivo (líneas 10-19).

**Confirmado de nuevo que el stub no cruza la línea que no debe cruzar hasta la Fase 5:**

```sql
-- Tras 2 notificaciones procesadas para el mismo pedido:
SELECT status FROM orders WHERE order_number = 'BM-2026-00014';        → PENDING_PAYMENT (sin cambio)
SELECT stock FROM product_variants WHERE id = '...-000005';            → 20 (sin cambio)
SELECT current_redemptions FROM promotions;                            → 0 (sin cambio)
SELECT count(*) FROM payments;                                          → 0 (sin cambio)
```

No toca `orders.status`, no llama a la RPC de stock, no incrementa `current_redemptions`, no inserta en `payments`. Además, la segunda notificación (con `Ds_Response` distinto) se procesó igualmente **sin comprobar si el pedido ya estaba en `PAID`** — el hueco de idempotencia está anotado en el propio TODO del archivo (línea 11-13) y coincide con lo ya señalado en la auditoría de Fase 1. No es un hallazgo nuevo; se deja registrado aquí como confirmación de que sigue siendo así.

---

## 6 — Pedidos huérfanos por cancelación — WARN (observación ya conocida, documentada)

Antes de esta auditoría existía un pedido `PENDING_PAYMENT` de una sesión de pruebas anterior (`BM-2026-00013`, creado 2026-07-05, más de 24 h de antigüedad respecto a esta auditoría) sin ningún pago asociado ni mecanismo que lo hubiera limpiado — exactamente el escenario ya observado: cliente que abandona el checkout antes de pagar deja el pedido colgado para siempre.

**Estado encontrado al empezar:** 1 pedido `PENDING_PAYMENT` huérfano (`BM-2026-00013`).
**Acción tomada:** se borró junto con los 2 pedidos de prueba generados en esta misma auditoría (`BM-2026-00014`, `BM-2026-00015`), en orden `order_status_history` → `order_items` → `payments` → `orders` (no hay `ON DELETE CASCADE` declarado en el esquema). Confirmado `SELECT count(*) FROM orders` → `0` tras la limpieza.

**No se implementa ningún mecanismo de limpieza automática** — está fuera de alcance del MVP, tal como se indicó. Queda anotado aquí como ítem conocido para el futuro (candidato natural: un `pg_cron` que marque como `EXPIRED` o borre pedidos `PENDING_PAYMENT` con más de N horas sin notificación, análogo al `pg_cron` de retención que ya existe para `product_labels` en la sección 11 bis del MVP).

---

## Veredicto

**La Fase 4 está lista para que la Fase 5 construya la notificación real, el descuento de stock y el consumo de promoción sobre ella.** No hay ningún FAIL. Las tres rutas nuevas exponen exactamente lo necesario y nada más, `supabase-admin` y el secreto de Redsys siguen acotados a código server-only y ausentes del bundle de cliente, RLS sigue cerrado para `anon` sin cambios colaterales en las migraciones recientes, `create-session` revalida precio y stock de verdad contra BD (con prueba real de manipulación de ambos) y genera identificadores únicos de forma atómica, y el stub de notificación se mantiene estrictamente dentro de los límites documentados (sin tocar stock, promoción ni estado del pedido).

Dos observaciones no bloqueantes para tener en cuenta en la Fase 5:

1. **Idempotencia del stub:** confirmado de nuevo que dos notificaciones para el mismo pedido se procesan por separado sin comprobar `status === 'PAID'`. Ya estaba anotado como TODO explícito en el código; la Fase 5 debe implementarlo antes de que el stub deje de ser un stub.
2. **Pedidos huérfanos:** sin mecanismo de limpieza para `PENDING_PAYMENT` abandonados. No bloquea el MVP, pero conviene decidir un criterio (TTL + `pg_cron`, o limpieza manual periódica desde el panel admin) antes de que el volumen real de tráfico haga esto visible en el panel de pedidos.
