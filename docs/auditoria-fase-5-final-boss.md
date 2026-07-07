# Auditoría forense de Fase 5 — "Final Boss" (notificación real, idempotencia, stock, promoción, emails)

**Fecha:** 2026-07-06
**Alcance:** Todo lo construido en Fase 5 sobre las bases de Fase 4: `decrement_stock_and_confirm_order` (migración `20260706090000_0010_idempotent_stock_rpc.sql`), `POST /api/pagos/notificacion` (allowlist de `Ds_Response`, camino de éxito, idempotencia, consumo de promoción), envío de emails con Resend (`src/lib/email/send-order-notifications.ts`, plantillas en `src/emails/`).
**Nivel:** forense, esfuerzo Extra/Max — la auditoría exhaustiva prometida al cierre de [docs/fase-5-cierre-idempotencia.md](fase-5-cierre-idempotencia.md).

**Regla de oro aplicada:** ninguno de los resultados reportados por la sesión que construyó la Fase 5 (ni los de `docs/fase-5-cierre-idempotencia.md`, ni los de las auditorías previas) se ha dado por bueno sin reproducirlo aquí de forma independiente. Todas las pruebas de concurrencia de este informe se dispararon con llamadas `Promise.all` reales, escritas y ejecutadas en esta sesión, contra el servidor Next.js real (`npm run dev`, `localhost:3000`) y la base de datos real de `tienda-buey-dev`, con lecturas de BD antes/después capturadas en esta misma sesión — no se leyeron logs ni resúmenes de sesiones anteriores como prueba.

## Preflight

```
npx supabase projects list
→ tienda-buey-dev (pwkpuvagoupvynamskmh), ACTIVE_HEALTHY, linked: true
```

Confirmado antes de tocar nada. Es el mismo proyecto usado en las auditorías de Fase 1, 3 y 4.

## Método

- Servidor real levantado con `npm run dev` (Next.js 16.1.4 / Turbopack), notificación probada contra `http://localhost:3000/api/pagos/notificacion` real, no un mock.
- Notificaciones de Redsys **forjadas con firma criptográficamente válida**: se importó `redsys-easy` (la misma librería que usa la app) con la clave pública de pruebas SIS-T (`sq7HjrUOBfKmC576ILgskD5srU870gJ7`, documentada en la sección 15 del MVP y en el propio `.env.local` de desarrollo) y se usó `createRedirectForm()` — la misma función que `create-session` usa para firmar *hacia* Redsys — para construir el body `{ Ds_SignatureVersion, Ds_MerchantParameters, Ds_Signature }` con cualquier contenido bajo control total (incluidos campos incoherentes a propósito, para el punto 5bis). Se verificó primero, con un roundtrip de auto-verificación (`processRestNotification`), que la firma generada es indistinguible de una firma real.
- Los pedidos de prueba de los puntos 1, 2, 3, 4, 5, 5bis y 5ter se insertaron **directamente en BD** con el cliente `service_role` (mismo esquema exacto que produce `create-session`: `orders` + `order_items` con snapshots), para tener control total sobre la concurrencia sin depender de la latencia de 5-10 llamadas HTTP reales a `create-session`. El punto 9 usó el **flujo real completo** (`POST /api/checkout/create-session` de verdad) para cerrar el círculo de extremo a extremo.
- Todos los datos de prueba (pedidos, líneas, pagos, histórico) se borraron al terminar cada prueba. Todo el stock y la promoción tocados se restauraron a sus valores de seed originales — confirmado con una lectura final de comparación (ver sección de cierre). Dos variantes (`Pack Gourmet El Buey` y `Burger Wagyu Pack 4`, usadas en los puntos 3 y 9) quedaron con stock desincronizado tras las primeras pruebas por un descuido de limpieza en este mismo informe — se detectó y se corrigió antes de cerrar la auditoría (ver "Cierre y verificación final del entorno").

---

## Tabla de resultados

| # | Punto | Veredicto | Concurrencia reproducida |
|---|-------|-----------|--------------------------|
| 1 | Idempotencia de la RPC | **PASS** | 5 llamadas paralelas reales, independientes |
| 2 | Última unidad disputada | **PASS** | 5 pedidos distintos, 5 notificaciones paralelas reales |
| 3 | Promoción en el límite | **PASS** (contador) + **HALLAZGO NUEVO severidad ALTA** (stock del regalo) | 5 pedidos distintos, 5 notificaciones paralelas reales |
| 4 | Regalo agotado entre checkout y notificación | **HALLAZGO DE DISEÑO — severidad ALTA** | N/A (caso de un solo pedido) |
| 5 | Allowlist `Ds_Response` — casos límite | **PASS** | N/A (rechazo, no concurrencia) |
| 5bis | Notificación forjada con importe incoherente | **FAIL — severidad ALTA** | N/A |
| 5ter | Bloqueo por variante + deadlock multi-línea | **PASS** | 8 rondas × 2 pedidos en paralelo (16 notificaciones) |
| 6 | Emails: fallo controlado, sin duplicados | **PASS** | Reutiliza la reproducción del punto 1 (5 llamadas paralelas) |
| 7 | El trío de siempre | **PASS** | N/A |
| 8 | Housekeeping (documentar, no arreglar) | Documentado | N/A |
| 9 | Coherencia de importe extremo a extremo | **PASS** | N/A (flujo real completo, no concurrencia) |

Dos **FAIL/hallazgos de severidad alta** (puntos 3-extra, 4, 5bis) que no bloquean el uso interno con datos reales controlados, pero **sí deberían cerrarse antes de exponer el sistema a tráfico de producción real**, especialmente 5bis (defensa en profundidad de la notificación) y el hallazgo del punto 3 (control de coste real de la promoción).

---

## 1 — Idempotencia de la RPC (crítico, re-verificación independiente) — PASS

### Lectura del código actual

Código vivo de `supabase/migrations/20260706090000_0010_idempotent_stock_rpc.sql` (leído completo, no solo el fragmento del MVP doc):

```sql
CREATE OR REPLACE FUNCTION public.decrement_stock_and_confirm_order(
  p_order_id uuid,
  p_line_items jsonb,
  p_promotion_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  item record;
  v_stock int;
  v_status text;
  v_promo_rowcount int;
  v_promotion_consumed boolean := false;
BEGIN
  IF p_line_items IS NULL
     OR jsonb_typeof(p_line_items) <> 'array'
     OR jsonb_array_length(p_line_items) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'LINE_ITEMS_INVALIDOS');
  END IF;

  -- Bloqueo real de la fila del pedido + comprobacion de idempotencia.
  SELECT status
  INTO v_status
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PEDIDO_NO_ENCONTRADO', 'order_id', p_order_id);
  END IF;

  IF v_status = 'PAID' THEN
    RETURN jsonb_build_object('ok', true, 'already_processed', true);
  END IF;

  -- (primera pasada: bloquea variantes y valida sin descontar)
  -- (segunda pasada: descuenta)
  -- (consumo de promoción)
  -- (UPDATE orders SET status='PAID' ...)
```

**Confirmado leyendo el SQL, no asumido:**
- La única comprobación que ocurre *antes* del `SELECT ... FOR UPDATE` sobre `orders` es la validación de formato de `p_line_items` (que no toca ninguna tabla — es JSON puro en memoria). No hay ninguna lectura ni escritura de `product_variants` antes del bloqueo del pedido.
- La salida temprana por `already_processed: true` ocurre **dentro** de la misma transacción que abrió el `FOR UPDATE` — es la siguiente sentencia después de comprobar `NOT FOUND`, en el mismo bloque `BEGIN...END`. No hay una comprobación separada fuera de una transacción bloqueada; PL/pgSQL ejecuta toda la función como una única transacción implícita, y el `FOR UPDATE` mantiene el lock de fila hasta el `RETURN` (que termina la función/transacción).
- Esto es exactamente lo que hace que la idempotencia sea real bajo concurrencia y no solo un `if` de buena fe: una segunda llamada para el mismo `p_order_id` que llegue mientras la primera todavía no ha terminado se **queda bloqueada en el `SELECT ... FOR UPDATE`** hasta que la primera transacción termine (haya dejado `status = 'PAID'` o no). Solo entonces lee el `status` ya actualizado.

### Reproducción independiente — 5 llamadas paralelas reales

Pedido de prueba real creado directamente en BD (Entrecot Madurado 400g, `33333333-0000-0000-0000-000000000005`, 2 unidades, stock inicial 20):

```
Stock ANTES: 20
Pedido creado: BM-AUDIT-1783341410849-1 | redsys_ds_order 88065001 | total: 5400
Disparando 5 notificaciones EN PARALELO (Promise.all real) para el mismo pedido...
  Llamada 1: HTTP 200 -> {"ok":true}
  Llamada 2: HTTP 200 -> {"ok":true}
  Llamada 3: HTTP 200 -> {"ok":true}
  Llamada 4: HTTP 200 -> {"ok":true}
  Llamada 5: HTTP 200 -> {"ok":true}
Stock DESPUES: 18 (esperado: 18)
Estado del pedido: PAID
Filas en payments: 1
Eventos en order_status_history:
  - PEDIDO_CREADO
  - PAGO_CONFIRMADO {"ds_response":"0000","ds_authorization":"123456"}
  - STOCK_DESCONTADO
  - EMAIL_CLIENTE_ERROR {...}
  - EMAIL_INTERNO_ERROR {...}
Conteo PAGO_CONFIRMADO: 1 | STOCK_DESCONTADO: 1 | EMAIL_CLIENTE_*: 1 | EMAIL_INTERNO_*: 1
```

Las 5 llamadas devolvieron `HTTP 200` (Redsys nunca ve un error ni reintenta), el stock se descontó **exactamente una vez** (20→18, no 20→10 como habría pasado sin idempotencia), hay **exactamente 1 fila** en `payments`, y **exactamente un juego** de eventos de éxito en `order_status_history` — no 5. Las 4 llamadas restantes salieron por la rama `already_processed: true` sin tocar nada. (Los errores de email son un hallazgo esperado del punto 6, no de este punto — ver más abajo.)

**Veredicto: PASS.** Reproducido de forma independiente con 5 llamadas paralelas reales (no 2, tal como pedía la consigna).

---

## 2 — Última unidad disputada (crítico, re-verificación con más presión) — PASS

Variante distinta a la del punto 1 para evitar contaminación cruzada: Entrecot Madurado 800g (`...006`), stock puesto a 1. **5 pedidos distintos** (filas distintas de `orders`), cada uno pidiendo 1 unidad, con **5 notificaciones de éxito disparadas en paralelo real**.

```
Stock puesto a 1 para la prueba.
5 pedidos distintos creados: BM-AUDIT-...1, ...2, ...3, ...4, ...5
Disparando 5 notificaciones EN PARALELO (Promise.all real) para 5 pedidos DISTINTOS sobre la misma variante...
  Pedido 1: HTTP 200 -> {"ok":true}
  Pedido 2: HTTP 200 -> {"ok":true}
  Pedido 3: HTTP 200 -> {"ok":true}
  Pedido 4: HTTP 200 -> {"ok":true}
  Pedido 5: HTTP 200 -> {"ok":true}
Stock DESPUES: 0 (esperado: 0)
Muestras de stock durante la carrera (sondeo concurrente, best-effort):
  1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0
Se observo stock negativo en algun momento: false
  Pedido 1: status=STOCK_ERROR  (metadata: available:0, requested:1, variant_id:...006)
  Pedido 2: status=PAID
  Pedido 3: status=STOCK_ERROR
  Pedido 4: status=STOCK_ERROR
  Pedido 5: status=STOCK_ERROR
Conteo PAID: 1 (esperado 1) | Conteo STOCK_ERROR: 4 (esperado 4)
```

Se lanzó además un sondeo de lectura de `stock` en un bucle paralelo mientras las 5 notificaciones estaban en vuelo, para intentar capturar un valor intermedio real (no solo el antes/después): las 16 muestras tomadas durante la carrera solo devolvieron `1` o `0`, nunca un valor negativo ni un valor intermedio inconsistente — coherente con que el `FOR UPDATE` sobre la variante serializa las 5 transacciones una detrás de otra.

**Veredicto: PASS.** Exactamente 1 `PAID` con stock en 0, los otros 4 `STOCK_ERROR`, nunca stock negativo. Reproducido de forma independiente con 5 pedidos y 5 notificaciones paralelas reales (no 2).

---

## 3 — Promoción en el límite (crítico, re-verificación con más presión) — PASS + HALLAZGO NUEVO

Promoción del seed puesta a **1 canje de agotarse** (`current_redemptions = 9`, `max_redemptions = 10`, `is_active = true`). **5 pedidos distintos**, cada uno con una línea `PRODUCT` (Pack Gourmet El Buey ×2, supera el `min_subtotal` de 100€) y una línea `GIFT` (Burger Wagyu Pack 4, la misma que en el seed), **5 notificaciones de éxito en paralelo real**.

```
Promocion puesta a current_redemptions=9 (max=10), is_active=true
5 pedidos con regalo creados: ...
Disparando 5 notificaciones EN PARALELO...
  Pedido 1: HTTP 200 -> {"ok":true}   ... (los 5 devuelven 200)
current_redemptions DESPUES: 10 (esperado: 10, NUNCA 11)
  Pedido 1: status=PAID | PROMOCION_NO_APLICADA reason=AGOTADA
  Pedido 2: status=PAID | PROMOCION_NO_APLICADA reason=AGOTADA
  Pedido 3: status=PAID | PROMOCION_APLICADA
  Pedido 4: status=PAID | PROMOCION_NO_APLICADA reason=AGOTADA
  Pedido 5: status=PAID | PROMOCION_NO_APLICADA reason=AGOTADA
Conteo PAID: 5 (esperado 5) | PROMOCION_APLICADA: 1 (esperado 1) | PROMOCION_NO_APLICADA: 4 (esperado 4)

Stock del regalo ANTES/DESPUES: 40 / 35
```

La parte "documentada" pasa exactamente como predijo el cierre de Fase 5: `current_redemptions` termina en `10`, nunca en `11` (el `WHERE ... AND (max_redemptions IS NULL OR current_redemptions < max_redemptions)` de la RPC protege el contador de forma atómica), exactamente 1 pedido `PROMOCION_APLICADA`, los otros 4 `PROMOCION_NO_APLICADA (AGOTADA)`, y **los 5 pedidos terminan `PAID`** — la promoción agotada nunca bloquea el cobro, tal como exige la sección 13 del MVP.

### Hallazgo nuevo — severidad ALTA: el stock del regalo se descuenta para los 5 pedidos, no solo para el que gana la promoción

El cierre de Fase 5 (`docs/fase-5-cierre-idempotencia.md`) solo comprobó `current_redemptions` y los eventos de histórico — **no comprobó el stock del regalo**. Esta re-verificación independiente sí lo hizo, y el resultado es preocupante: el stock del `gift_variant_id` bajó de **40 a 35** — se descontó **una unidad por cada uno de los 5 pedidos**, no solo por el que legítimamente ganó el último canje.

**Por qué ocurre:** el handler de notificación (`src/app/api/pagos/notificacion/route.ts:159-161`) construye `lineItems` a partir de **todas** las filas de `order_items` que tengan `product_variant_id`, sin distinguir `item_type`:

```typescript
const lineItems = itemRows
  .filter((item): item is OrderItemRow & { product_variant_id: string } => item.product_variant_id !== null)
  .map((item) => ({ variant_id: item.product_variant_id, quantity: item.quantity }));
```

La RPC descuenta stock para **cada línea de `p_line_items`**, sin ninguna condición sobre si la promoción terminó consumiéndose (`promotion_consumed`) o no. El consumo del contador (`current_redemptions`) y el descuento de stock del regalo son dos mecanismos independientes que deberían estar acoplados y no lo están.

**Por qué importa:** `order_items` se crea en `create-session` (Fase 4) cuando el cliente compra, en el momento en que la promoción *parecía* disponible (lectura no bloqueada de `current_redemptions`). Si varios clientes hacen checkout casi a la vez cuando queda 1 canje, **los 5 pueden pasar la comprobación de disponibilidad en `create-session`** (nada la bloquea ahí — es una simple lectura, no un `FOR UPDATE`) y los 5 acaban con una línea `GIFT` en su pedido. Cuando llegan los 5 pagos, la RPC protege correctamente el **contador** de negocio (`current_redemptions` nunca pasa de `max_redemptions`), pero **no protege el stock físico del regalo** — los 5 pedidos reciben el regalo de verdad (aparece en su `order_items`, en su email de confirmación, en el email interno con `[REGALO PROMO]`, y su stock se descuenta), aunque solo 1 de ellos está contado como canje legítimo.

**Consecuencia de negocio:** `max_redemptions` deja de ser un límite real de coste. Una promoción configurada como "regalo para los primeros 10 pedidos" puede en la práctica regalar más de 10 unidades si hay ráfagas de pedidos concurrentes cerca del límite — justo el escenario que una promoción de "primeros N pedidos" (marketing de escasez) invita a que ocurra. El contador de `promotions` subestimará silenciosamente cuántos regalos se han entregado de verdad.

**Propuesta de arreglo (no aplicada — tiene matiz de decisión de producto):** condicionar el descuento de stock de la línea `GIFT` al resultado de `v_promotion_consumed`. Dos variantes posibles, y la elección entre ellas SÍ es una decisión de negocio:

1. **Honrar siempre el regalo prometido en el checkout** (comportamiento actual, pero corrigiendo el contador): si se decide que un cliente que ya vio "regalo incluido" en su checkout debe recibirlo siempre, entonces el contador `current_redemptions` debería reflejar la realidad — es decir, no debería haber "ganadores" y "perdedores" de una carrera que el cliente nunca vio, porque el pedido ya prometía el regalo. Esto requeriría repensar dónde se reserva realmente el cupo (¿en `create-session`, con un `FOR UPDATE` sobre `promotions` en ese momento?).
2. **No honrar el regalo si se pierde la carrera en el pago** (alinear el descuento de stock con `v_promotion_consumed`): en la RPC, excluir del `UPDATE product_variants SET stock = stock - quantity` cualquier línea cuyo `variant_id` sea el `gift_variant_id` de una promoción cuyo cupo no se consumió. Esto protege el stock/coste real, pero dejaría al cliente con una línea `GIFT` en su pedido y su email de confirmación que en realidad no recibirá — un problema de expectativa con el cliente, no solo de código.

Ninguna de las dos se ha aplicado. Requiere una decisión de negocio explícita antes de tocar código.

**Veredicto: PASS** en lo que la Fase 5 se propuso proteger (contador, bloqueo de pedidos), **hallazgo nuevo de severidad ALTA** en algo que nadie había comprobado hasta ahora (stock físico del regalo bajo la misma carrera).

---

## 4 — Caso límite nuevo: stock del regalo agotado entre checkout y notificación — HALLAZGO DE DISEÑO, severidad ALTA

Escenario reproducido con un único pedido, tal como pide la consigna:

1. Pedido creado con una línea `PRODUCT` real (Croquetas de Jamón Ibérico 12uds ×3, con stock de sobra) y una línea `GIFT` (Burger Wagyu Pack 4), exactamente como si `create-session` lo hubiera aceptado con la promoción disponible en ese momento.
2. **Antes** de disparar la notificación, se agota el stock del regalo a 0 por otra vía (simulando que otro pedido se lo llevó, o un ajuste manual en Supabase Studio).
3. Se dispara la notificación de éxito (`Ds_Response=0000`, importe correcto) para el pedido.

```
Stock regalo ANTES: 40 | Stock producto real ANTES: 30
Pedido creado con regalo: BM-AUDIT-... total: 5200
Stock del regalo agotado a 0 ANTES de que llegue la notificacion de este pedido.
Notificacion disparada -> HTTP 200 {"ok":true}
Estado FINAL del pedido: STOCK_ERROR
Eventos: PEDIDO_CREADO
  STOCK_ERROR {"available":0,"requested":1,"rpc_error":"STOCK_INSUFICIENTE","variant_id":"...-000008"}
Stock del producto REAL (Croquetas) despues: 30 (sin cambio — nunca se cobra ni se descuenta)

=== PREGUNTA DE DISEÑO ===
¿El pedido quedo bloqueado con STOCK_ERROR por culpa UNICAMENTE del regalo, a pesar de que el producto real (Croquetas) si tenia stock?
Respuesta: SI - el pedido completo bloqueado
```

**Respuesta a la pregunta de diseño, con evidencia:** sí. La RPC trata la falta de stock del regalo **exactamente igual** que la falta de stock de un producto normal: la primera pasada de validación (`FOR item IN ... LOOP` sobre todas las líneas agrupadas) no distingue `item_type`, así que en cuanto encuentra `v_stock < item.quantity` para *cualquier* `variant_id` — incluido el del regalo — devuelve `STOCK_INSUFICIENTE` y el handler marca **todo el pedido** como `STOCK_ERROR`. El cliente ya fue cobrado por Redsys (el `Ds_Response=0000` es real en este escenario), pero el pedido se queda sin confirmar por un producto de coste cero que él nunca pidió explícitamente — solo por haber superado un umbral de importe.

**¿Contradice el principio ya establecido de que "una promoción no disponible nunca bloquea el pedido"?** Formalmente no, porque ese principio (sección 13 del MVP) está definido para el momento de `create-session` — ahí sí funciona: si el regalo no tiene stock *en el momento del checkout*, la promoción simplemente no se aplica y el pedido continúa con normalidad. Pero el efecto para el cliente en este caso límite nuevo es idéntico al que ese principio pretende evitar: **no cobrar/confirmar un pedido por culpa de un producto de regalo**. La diferencia es solo el momento en que se detecta la falta de stock (checkout vs. confirmación de pago), y el sistema da una respuesta opuesta según el momento — protege al cliente si se detecta antes de pagar, pero lo penaliza (bloqueo del pedido entero, incluidos productos que sí pagó y que sí hay stock) si se detecta después de pagar.

**Severidad:** ALTA. No es un bug de concurrencia con probabilidad baja como el punto 3 — es un camino determinista: cualquier ajuste de stock del regalo a 0 (manual en Supabase Studio, u otro pedido que se lo lleve) entre el checkout y la notificación bloquea instantáneamente cualquier pedido pendiente que llevara ese regalo, sin importar cuántos productos reales sí tuvieran stock.

**Propuesta de arreglo (no aplicada — decisión de negocio explícita, tal como pide la consigna):** dado que el regalo tiene `unit_price_snapshot = 0` y es identificable por `item_type = 'GIFT'`, la RPC podría:
- **Opción A:** si la línea sin stock es `GIFT`, no fallar todo el pedido — simplemente omitir esa línea del descuento (no restar stock, ya en 0) y no marcar `promotion_consumed`, registrando un evento equivalente a `PROMOCION_NO_APLICADA (reason: SIN_STOCK_REGALO_EN_CONFIRMACION)`, dejando que el resto del pedido (los productos reales) se procese con normalidad y el pedido llegue a `PAID`.
- **Opción B (la actual):** mantener el bloqueo total, aceptando que es un caso raro y que el restaurante lo resuelve manualmente (igual que cualquier otro `STOCK_ERROR`), quizá comunicando proactivamente al cliente que el regalo ya no está disponible pero manteniendo la compra.

La opción A es más favorable al cliente y protege el ingreso real del pedido, pero requiere decidir explícitamente qué le llega al cliente en su email (¿"tu pedido está confirmado, sin el regalo" o simplemente confirmarlo con el regalo igual y aceptar el coste, dado que además el punto 3 ya evidencia que a veces el regalo se entrega sin contar como canje)? No se ha aplicado ningún cambio de código para este punto — es, tal como pide la consigna, una cuestión de negocio antes que de ingeniería.

---

## 5 — Allowlist de `Ds_Response`: casos límite adicionales — PASS

Además de los ya probados en sesiones anteriores (`0000`, `0596`, `9999`), se probaron los tres casos pedidos, cada uno contra un pedido de prueba nuevo:

```
[Ds_Response AUSENTE]     HTTP 200 -> {"ok":true} | order.status=PAYMENT_FAILED
[Ds_Response = "0"]       HTTP 200 -> {"ok":true} | order.status=PAYMENT_FAILED
[Ds_Response = "99"]      HTTP 200 -> {"ok":true} | order.status=PAYMENT_FAILED
[Ds_Response = "ABCD"]    HTTP 200 -> {"ok":true} | order.status=PAYMENT_FAILED
```

Los 4 casos fueron rechazados de forma ordenada por `isAuthorizedDsResponse()` (exige `/^\d{4}$/`, formato de 4 dígitos exactos, antes incluso de comprobar el rango numérico) y cayeron en la rama de `PAYMENT_FAILED`, nunca en la de éxito. Ninguno provocó una excepción sin capturar ni un `500` — los 4 respondieron `200` de forma controlada, tal como exige el contrato con Redsys.

**Veredicto: PASS.** El diseño "allowlist estricta, nunca blocklist" es robusto ante entradas ausentes, truncadas o no numéricas.

---

## 5bis — Notificación forjada con firma VÁLIDA pero contenido incoherente — FAIL, severidad ALTA

### Caso A — `Ds_Amount` incoherente con el total real del pedido

```
Pedido real: total en BD = 6400 cts
Notificacion con Ds_Amount=1 (real: 6400) -> HTTP 200 {"ok":true}
Estado del pedido: PAID
Fila en payments -> amount guardado: 1  (el importe FALSO, no el real)
```

El handler **nunca compara `Ds_Amount` con `orders.total`**. Se confirmó leyendo el código (`src/app/api/pagos/notificacion/route.ts`): `dsAmount` se extrae de la notificación (línea 91) y se usa únicamente para guardarlo tal cual en `payments.amount` (línea 221: `amount: Number(dsAmount)`) — no aparece en ninguna condición, ni se compara contra `order.total` en ningún punto del archivo. La firma HMAC-SHA256 (con la clave pública de pruebas SIS-T) es válida, así que el pedido se confirma como `PAID` con un importe que no tiene ninguna relación con lo que el pedido realmente vale.

### Caso B — `Ds_Order` de un pedido, `Ds_Amount` de otro

```
Pedido X: total real 2800 | Pedido Y (nunca notificado): total real 18000
Notificacion para pedido X con el importe de Y (18000) -> HTTP 200 {"ok":true}
Estado del pedido X: PAID
payments.amount guardado para X: 18000 (deberia ser 2800)
```

Mismo resultado: el pedido `X` se confirma como `PAID` con el importe del pedido `Y`, sin ninguna comprobación cruzada.

### Caso C — pedido ya `PAID` + notificación nueva con importe absurdo (control de idempotencia)

```
1a notificacion real (importe correcto): status=PAID | payments: 1
2a notificacion (Ds_Amount=999999) sobre el MISMO pedido ya PAID -> HTTP 200 {"ok":true}
Estado tras 2a notificacion: PAID | payments (sigue en 1)
Stock tras 1er pago: 27 | Stock tras 2o intento: 27 (identico, no se vuelve a descontar)
```

Aquí sí funciona correctamente: como el pedido ya está `PAID`, la RPC sale por `already_processed: true` **antes** de leer o comparar ningún importe — la idempotencia del punto 1 protege este caso concreto (una notificación repetida con datos disparatados sobre un pedido ya cerrado no hace nada). El problema es específicamente la **primera** confirmación de un pedido, que no tiene ninguna barrera de coherencia de importe.

### Por qué es un FAIL de severidad alta

La clave de firma del comercio de pruebas SIS-T es **pública y está documentada** (aparece en la sección 15 del propio MVP y en el `.env.local` de desarrollo). Cualquiera que conozca esa clave — que en el entorno de pruebas es de dominio público — puede construir una notificación con firma criptográficamente válida y cualquier contenido. En producción la clave será secreta y este vector concreto no será replicable externamente sin conocerla, **pero la defensa en profundidad estándar de una integración de TPV es no depender solo de la firma**: el contenido debe ser coherente con lo que el pedido realmente vale. Hoy, si por cualquier motivo (bug de Redsys, un proxy intermedio, una futura migración de clave mal hecha, o simplemente la clave real filtrándose en el futuro) llegara una notificación con un importe distinto al esperado, el sistema la aceptaría igualmente y marcaría el pedido como pagado.

### Propuesta de arreglo (no aplicada — se reporta antes de aplicar, tal como pide la consigna)

Comparar `Ds_Amount` con `orders.total` antes de llamar a la RPC de confirmación:

```typescript
if (Number(dsAmount) !== order.total) {
  await supabaseAdmin
    .from('orders')
    .update({ status: 'NEEDS_REVIEW', updated_at: new Date().toISOString() })
    .eq('id', order.id);

  await supabaseAdmin.from('order_status_history').insert({
    order_id: order.id,
    event_type: 'NEEDS_REVIEW', // o un event_type nuevo tipo 'IMPORTE_INCOHERENTE'
    previous_status: order.status,
    new_status: 'NEEDS_REVIEW',
    metadata: { ds_amount: dsAmount, order_total: order.total, ds_order: dsOrder },
  });

  return NextResponse.json({ ok: true }); // 200 a Redsys igualmente — no es un problema suyo, es nuestro de revisar
}
```

Esta comprobación es una invariante de integridad (importe cobrado == importe esperado), no una decisión de negocio — a diferencia de los puntos 3 y 4, aquí no hay ambigüedad sobre qué debería pasar: un importe incoherente **nunca** debería confirmar un pedido en silencio. Aun así, siguiendo la instrucción explícita de la consigna, **no se ha aplicado** — queda pendiente de confirmación antes de tocar código de producción.

**Veredicto: FAIL, severidad ALTA.** No hay ninguna comprobación de coherencia de importe entre lo firmado por Redsys y lo que el pedido vale en BD.

---

## 5ter — El bloqueo que protege la última unidad + deadlock multi-línea — PASS

### Confirmación del bloqueo por variante tras el `CREATE OR REPLACE`

Se leyó explícitamente el SQL vivo de la migración `0010` (reproducido en el punto 1): el `SELECT stock ... FOR UPDATE` sobre `product_variants`, dentro del bucle `FOR item IN (... GROUP BY parsed.variant_id ORDER BY parsed.variant_id) LOOP`, **sigue presente sin cambios de fondo** respecto a la versión de `0009_fix_atomic_stock_rpc.sql` que ya había verificado la auditoría de Fase 1. El único cambio de la migración `0010` fue añadir el bloqueo de `orders` *antes* de este bucle y el parámetro `p_promotion_id` — no tocó el bloqueo por variante. Esto confirma que el resultado del punto 2 (última unidad) es protección real, no suerte de temporización: el mecanismo que serializa a los 5 pedidos compitiendo por la variante es precisamente este `FOR UPDATE`.

### Orden determinista de bloqueo (protección anti-deadlock)

Ambas pasadas de la RPC (validación y descuento) iteran con:

```sql
SELECT parsed.variant_id, SUM(parsed.quantity)::int AS quantity
FROM (...) parsed
GROUP BY parsed.variant_id
ORDER BY parsed.variant_id
```

El `ORDER BY parsed.variant_id` (orden ascendente del UUID) es lo que garantiza que **dos transacciones que comparten las mismas variantes siempre las bloquean en el mismo orden**, sin importar en qué orden llegaron esas variantes en el array `p_line_items` de cada llamada — condición necesaria y suficiente para descartar deadlocks por espera circular en este patrón de acceso.

### Prueba real: dos pedidos con las mismas 2 variantes en orden inverso

Chuletón de Vaca Madurada 1kg (`A`) y 1,5kg (`B`), stock 20 cada una. 8 rondas, cada una con un pedido `A→B` (líneas en ese orden) y otro `B→A` (líneas invertidas), notificaciones de ambos disparadas en paralelo real:

```
Ronda 1: pedido A→B: HTTP 200 status=PAID | pedido B→A: HTTP 200 status=PAID
Ronda 2: pedido A→B: HTTP 200 status=PAID | pedido B→A: HTTP 200 status=PAID
...
Ronda 8: pedido A→B: HTTP 200 status=PAID | pedido B→A: HTTP 200 status=PAID

Deadlock detectado en alguna ronda: false
Pedidos PAID: 16 / 16
Stock A/B despues: 4, 4 (esperado: 4, 4 — 20 - 8×2)
```

**0 deadlocks en 16 notificaciones reales disparadas en paralelo** (8 rondas × 2 pedidos por ronda), con las líneas deliberadamente en orden inverso entre los dos pedidos de cada ronda.

### Si la RPC pudiera morir por deadlock, ¿el handler lo captura?

Sí — confirmado leyendo el código, no solo asumido: la llamada a la RPC en el handler está envuelta en un `try/catch` explícito:

```typescript
try {
  const { data, error } = await supabaseAdmin.rpc('decrement_stock_and_confirm_order', {...});
  if (error || !data) throw error ?? new Error('RPC sin datos');
  rpcResult = data as StockRpcResult;
} catch (err) {
  console.error('[pagos/notificacion] Error inesperado llamando a la RPC de stock', {...});
  return new NextResponse('Error interno', { status: 500 });
}
```

Cualquier error de la RPC (incluido un hipotético `40P01 deadlock detected`, que hoy no se ha observado empíricamente) cae en este `catch` y produce una respuesta `500` controlada — nunca una excepción sin capturar. Un `500` aquí hace que Redsys reintente (hasta 3 veces según la sección 15 del MVP), y gracias a la idempotencia del punto 1 ese reintento es seguro: no duplicaría el descuento de stock ni el pago. Este comportamiento es coherente con la tabla de "Errores de la notificación contemplados" de la sección 15 del propio MVP doc (`Error inesperado → 500 → Redsys reintentará`).

**Veredicto: PASS.** El bloqueo por variante sigue vigente tras el `CREATE OR REPLACE`, el orden de bloqueo es determinista por diseño (no por suerte), no se observó ningún deadlock en 16 notificaciones reales con líneas invertidas, y si ocurriera, el handler ya está preparado para responder de forma controlada en vez de reventar.

---

## 6 — Emails: fallo controlado y ausencia de duplicados — PASS

### a) Fallo de Resend no bloquea la confirmación del pago

Evidencia real, no forzada artificialmente: durante la reproducción del punto 1, **ambos** envíos de email (cliente e interno) fallaron de verdad contra la API real de Resend, porque el remitente configurado en desarrollo (`EMAIL_FROM=onboarding@resend.dev`) es el dominio de pruebas de Resend, que solo permite enviar a la dirección propia de la cuenta verificada:

```
EMAIL_CLIENTE_ERROR: "Resend error (cliente): You can only send testing emails to your own email
  address (alejandrodam2simarro@gmail.com). To send emails to other recipients, please verify a
  domain at resend.com/domains, and change the `from` address to an email using this domain."
EMAIL_INTERNO_ERROR: mismo error.
```

Pese a que **ambos** emails fallaron, el pedido terminó en `status=PAID`, con la fila en `payments` creada y el stock descontado — el fallo de email no revirtió ni bloqueó nada, y el handler respondió `HTTP 200` a Redsys en las 5 llamadas paralelas. Se confirma también leyendo el código: cada envío está en su propio `try/catch` en `route.ts` (líneas 287-315), que solo registra `EMAIL_CLIENTE_ERROR`/`EMAIL_INTERNO_ERROR` en el histórico sin relanzar la excepción — el flujo continúa hasta el `return NextResponse.json({ ok: true })` final.

### b) Sin duplicados de email en la notificación repetida (punto 1)

No basta con que "los eventos sean correctos" — se contó explícitamente: de las **5 llamadas paralelas** del punto 1, solo se registró **1** evento `EMAIL_CLIENTE_ERROR` y **1** evento `EMAIL_INTERNO_ERROR` en `order_status_history`, pese a que Resend fue invocado (y falló) una sola vez por tipo de email en total. Las otras 4 notificaciones nunca llegaron a la sección de emails del handler porque la RPC ya les devolvió `already_processed: true` antes de llegar a esa parte del código. No hay ningún camino en el que la idempotencia de la RPC permita que la sección de emails se ejecute más de una vez para el mismo pedido.

### c) Plantillas sin datos que no deberían viajar

- **`src/emails/OrderConfirmationEmail.tsx`** (email al cliente): revisado campo por campo — no incluye ningún UUID interno (`order.id`, `variant_id`, `promotion_id`), ni tokens, ni ningún dato que no sea el propio de su pedido (nombre, dirección, productos, alérgenos, importes). Usa `data.orderNumber` (el identificador público `BM-2026-00001`), nunca `data.orderId`.
- **`src/emails/InternalOrderNotificationEmail.tsx`** (email interno al restaurante): sí incluye `data.orderId` (UUID interno), pero **únicamente** como parte del enlace `href={`${baseUrl}/admin/pedidos/${data.orderId}`}` al panel admin — necesario para que el enlace funcione, y este email solo lo recibe el propio restaurante (`ADMIN_NOTIFICATION_EMAIL`), no el cliente. No se considera un hallazgo: es exactamente el tipo de dato que sí debe viajar en un email interno dirigido a quien ya tiene acceso al panel admin.

**Veredicto: PASS.** El fallo de email está genuinamente aislado del flujo de pago (confirmado con un fallo real de la API, no simulado), no hay duplicados de envío bajo concurrencia, y las plantillas no filtran datos internos hacia el cliente.

---

## 7 — El trío de siempre (repetido, con la Fase 5 añadida) — PASS

### `grep -rln "supabase-admin"`

```
src/app/api/checkout/create-session/route.ts
src/app/api/pagos/notificacion/route.ts
src/app/api/pedidos/estado/route.ts
src/app/api/tienda/promocion-activa/route.ts
src/lib/order-number.ts
```

Los 4 primeros son route handlers server-side; el quinto es un wrapper `server-only`. Ninguno es un Client Component. `grep -rln "from '@/lib/redsys'" src/` devuelve solo `create-session/route.ts` y `pagos/notificacion/route.ts`. Los 4 módulos sensibles (`supabase-admin.ts`, `redsys.ts`, `resend.ts`, `email/send-order-notifications.ts`) importan `'server-only'` como primera línea — confirmado con `head -1` sobre los 4 archivos.

### RLS: prueba real con `anon` key

```sql
SELECT tablename, policyname, roles::text, cmd FROM pg_policies
WHERE tablename IN ('orders','order_items','payments','order_status_history','promotions');
→ 0 filas
```

Y con el cliente `anon` real (`@supabase/supabase-js`, la misma clave que usaría el navegador):

```
orders:                status=200 data=[] error=null
order_items:            status=200 data=[] error=null
payments:               status=200 data=[] error=null
order_status_history:   status=200 data=[] error=null
promotions:             status=200 data=[] error=null
```

Combinado con la consulta de `pg_policies` (0 políticas → con RLS activo, deniega todo por defecto), confirma que ninguna de las 5 tablas sensibles tiene una vía pública de lectura para `anon`.

### `next build` + grep de secretos en el bundle

```
npm run build → "✓ Compiled successfully" (Next.js 16.1.4, Turbopack)

grep -rl "SUPABASE_SERVICE_ROLE_KEY"            .next/static → sin resultados
grep -rl "REDSYS_SECRET_KEY"                    .next/static → sin resultados
grep -rl "RESEND_API_KEY"                       .next/static → sin resultados
grep -rl "<valor real de SUPABASE_SERVICE_ROLE_KEY>" .next/static → sin resultados
grep -rl "sq7HjrUOBfKmC576ILgskD5srU870gJ7"     .next/static → sin resultados
grep -rl "<valor real de RESEND_API_KEY>"       .next/static → sin resultados
```

Ni los nombres de variable ni sus valores reales aparecen en ningún chunk servido al navegador.

### Permisos `EXECUTE` de la RPC tras el `CREATE OR REPLACE` de la Unidad 1

La migración `0010` cambió la firma de la función (2 args → 3 args, con `DROP FUNCTION IF EXISTS` explícito antes del `CREATE OR REPLACE`). Se verificó **en vivo**, no asumido, que los `GRANT`/`REVOKE` de la nueva firma se aplicaron correctamente:

```sql
SELECT has_function_privilege('anon', 'decrement_stock_and_confirm_order(uuid,jsonb,uuid)', 'EXECUTE'),
       has_function_privilege('authenticated', ..., 'EXECUTE'),
       has_function_privilege('service_role', ..., 'EXECUTE');
→ anon_exec: false | auth_exec: false | service_exec: true
```

Y con una llamada real usando la clave `anon`:

```
anon.rpc('decrement_stock_and_confirm_order', {...}) → status 401, error 42501:
  "permission denied for function decrement_stock_and_confirm_order"
```

Frente a la misma llamada con `service_role` (con un `p_order_id` inexistente a propósito, para comprobar que el error es de **lógica de negocio** y no de permisos):

```
service_role.rpc(...) → status 200, sin error de permisos (PEDIDO_NO_ENCONTRADO dentro de data.error)
```

**Veredicto: PASS.** El `CREATE OR REPLACE` con nueva firma no dejó ningún grant abierto — la migración 0010 incluye explícitamente su propio `REVOKE`/`GRANT` sobre la firma de 3 argumentos, y se ha verificado en vivo que surte efecto.

---

## 8 — Hallazgos de housekeeping (solo documentar, no arreglar código)

### `ADMIN_NOTIFICATION_EMAIL` en desarrollo

Valor actual en `.env.local` de desarrollo: `alejandroinelcom@gmail.com`. **No es** la dirección de producción documentada en la sección 16 del MVP (`elbueymaduradoxativa@gmail.com`). Esto es correcto y esperado para un entorno de desarrollo — pero debe quedar explícito como pendiente antes de producción: **cambiar `ADMIN_NOTIFICATION_EMAIL` a `elbueymaduradoxativa@gmail.com` en las variables de entorno de Vercel** (no en `.env.local`, que es solo de desarrollo). El checklist de la Fase 8 del MVP (sección 21, "Pruebas y lanzamiento") ya incluye genéricamente "Actualizar variables de entorno en Vercel" y "Configurar todas las variables de entorno de producción en Vercel" — se recomienda añadir esta variable explícitamente a esa lista, dado que es fácil de pasar por alto por no ser una de las credenciales "obvias" (Redsys/Resend).

### Restricción del dominio de pruebas de Resend

Confirmado con evidencia real (ver punto 6a): con `EMAIL_FROM=onboarding@resend.dev` (dominio de pruebas de Resend), **todos** los envíos a direcciones distintas de la propia cuenta verificada de Resend fallan — tanto el email al cliente (dirección de ejemplo) como el email interno (`alejandroinelcom@gmail.com`, que tampoco coincide con la dirección verificada de la cuenta de Resend, `alejandrodam2simarro@gmail.com`). Esto significa que **en este entorno de desarrollo concreto, tanto el email al cliente como el email interno fallarán siempre**, no solo el del cliente — es una limitación conocida y esperada del entorno de pruebas (documentada también en la sección 16 del MVP: "Sin esta verificación, los emails no se envían"), no un bug. Antes de producción, el dominio `restauranteelbueymadurado.com` debe quedar verificado en Resend (SPF/DKIM/DMARC) y `EMAIL_FROM` apuntando a `pedidos@restauranteelbueymadurado.com`, tal como ya especifica la sección 16.

---

## 9 — Coherencia del importe en los dos extremos del flujo — PASS

Prueba de **extremo a extremo real**, usando el flujo completo (`POST /api/checkout/create-session` real, no una inserción directa en BD), con la promoción activada temporalmente para forzar una línea `GIFT`:

```
Promocion activada para la prueba (is_active=true, current_redemptions=0).
create-session -> HTTP 200
orderNumber: BM-2026-00026 | totalAmount (respuesta): 17800
DS_MERCHANT_AMOUNT firmado hacia Redsys: 17800
DS_MERCHANT_ORDER: 26000027

Pedido en BD -> subtotal: 17800 | shipping_cost: 0 | total: 17800
Lineas PRODUCT: 1 | suma line_total PRODUCT: 17800
Lineas GIFT: 1 | unit_price_snapshot=0, line_total=0

¿Regalo tiene precio 0 y NO aparece sumado en DS_MERCHANT_AMOUNT? true
¿DS_MERCHANT_AMOUNT == subtotal(PRODUCT) + envio, excluyendo el regalo? true
¿DS_MERCHANT_AMOUNT (enviado a Redsys) == orders.total en BD? true
¿DS_MERCHANT_ORDER == orders.redsys_ds_order? true

Notificacion de vuelta con el MISMO importe firmado -> 200 {"ok":true}
Estado final del pedido: PAID
payments.amount: 17800 | orders.total: 17800 | coinciden: true
```

Se verificó explícitamente, decodificando el `Ds_MerchantParameters` real que `create-session` firma hacia Redsys, que `DS_MERCHANT_AMOUNT` (17800) es exactamente la suma de las líneas `PRODUCT` (17800) más el envío (0, porque el subtotal supera el umbral de envío gratis) — **excluyendo** la línea `GIFT` (que sí existe en BD con `unit_price_snapshot=0`, pero no se suma porque ya vale 0). Se cerró el círculo completo: el mismo importe que salió firmado hacia Redsys se usó para forjar la notificación de vuelta, y `payments.amount` terminó coincidiendo con `orders.total` en BD — la cadena `BD → Redsys → notificación → BD` es consistente en este caso feliz. (El punto 5bis, arriba, es precisamente la comprobación de qué pasa cuando esa cadena se rompe a propósito — y ahí sí hay un hallazgo.)

**Veredicto: PASS.**

---

## Cierre y verificación final del entorno

Al terminar todas las pruebas se comprobó que las 4 tablas de pedidos están vacías (`orders`, `order_items`, `payments`, `order_status_history` → `count: 0` las 4) y que `product_variants` y `promotions` coinciden exactamente con el estado de seed leído al principio de esta auditoría. **Nota de transparencia:** dos variantes (`Pack Gourmet El Buey`, usada como línea `PRODUCT` en los puntos 3 y 9; y `Burger Wagyu Pack 4`, el regalo consumido realmente en el punto 9) quedaron con stock desincronizado tras la limpieza automática de cada script individual, porque esos scripts solo restauraban las variantes que habían tocado *directamente* y no contemplaban el consumo real vía RPC del punto 9. Se detectó comparando el estado antes/después de toda la sesión y se corrigió manualmente antes de cerrar este informe (`Pack Gourmet`: 8→20; `Burger Wagyu Pack 4`: 39→40). Se deja constancia explícita aquí en vez de omitirlo, en línea con el espíritu de esta auditoría.

---

## Resumen de hallazgos por severidad

| Severidad | Hallazgo | Punto | Estado |
|---|---|---|---|
| **ALTA** | `Ds_Amount` de la notificación nunca se compara con `orders.total` — una notificación firmada (con firma válida) con cualquier importe confirma el pedido como `PAID` | 5bis | Reportado, arreglo propuesto, **no aplicado** |
| **ALTA** | Stock del regalo se descuenta para todos los pedidos que compiten por el último canje de una promoción, no solo para el que gana el contador `current_redemptions` — `max_redemptions` deja de ser un límite de coste real bajo concurrencia | 3 | Reportado, dos opciones de arreglo propuestas, **no aplicado** (decisión de negocio) |
| **ALTA** | Si el stock del regalo se agota entre el checkout y la notificación, la RPC bloquea el pedido **completo** (incluidos productos reales ya pagados y con stock) con `STOCK_ERROR` | 4 | Reportado como hallazgo de diseño, **no aplicado** (decisión de negocio) |
| Informativo | `ADMIN_NOTIFICATION_EMAIL` de desarrollo no es la dirección de producción | 8 | Documentado, pendiente operativo |
| Informativo | Restricción del dominio de pruebas de Resend afecta también al email interno en este entorno concreto | 8 | Documentado, limitación conocida |

---

## Veredicto final

**El descuento de stock y la idempotencia frente a notificaciones duplicadas o concurrentes son sólidos** — los puntos 1, 2 y 5ter se reprodujeron de forma independiente con 5, 5 y 16 llamadas paralelas reales respectivamente, y los tres se comportaron exactamente como exige el diseño: sin overselling, sin dobles descuentos, sin duplicar pagos ni eventos, sin deadlocks. La allowlist de `Ds_Response` (punto 5) es robusta ante entradas ausentes o malformadas. Los emails son un efecto secundario correctamente aislado del pago (punto 6), confirmado con un fallo real de la API de Resend, no simulado.

**Pero el sistema no está listo para exponerse a notificaciones adversariales de importe** (punto 5bis): hoy, cualquier notificación con firma válida y `Ds_Response=0000` confirma el pedido sin importar cuánto diga haber cobrado Redsys. En el entorno de pruebas esto es explotable porque la clave SIS-T es pública; en producción la clave será secreta, pero la ausencia de esta comprobación es una carencia real de defensa en profundidad que debería cerrarse antes de manejar dinero real, no después.

**Y la promoción tiene dos costuras sin cerrar bajo concurrencia real** (puntos 3 y 4): el contador de canjes está bien protegido, pero el stock físico del regalo no lo está de la misma manera, y un regalo agotado en el momento equivocado puede bloquear pedidos con productos reales ya pagados. Ninguno de los dos es un bug de corrupción de datos (los pedidos no se cobran dos veces ni se sobrevende stock de productos reales), pero ambos son fugas de control de negocio que un lanzamiento con tráfico real expondría tarde o temprano, especialmente en una promoción de "primeros N pedidos" — el tipo de promoción que por diseño invita a ráfagas de tráfico concurrente cerca del límite.

**¿Bloquea esto avanzar a la Fase 6/7 (panel admin)?** No. El panel admin no depende de que estas tres costuras estén cerradas — puede construirse en paralelo sin riesgo, y de hecho el panel admin es precisamente donde el restaurante resolverá manualmente los `STOCK_ERROR` del punto 4 mientras no haya una decisión de negocio tomada. Pero **antes de aceptar tráfico de producción real (dinero real)**, se recomienda cerrar explícitamente, en este orden de prioridad: (1) el punto 5bis (es una invariante técnica, no una decisión de negocio — el más rápido de cerrar), (2) una decisión de negocio sobre el punto 3 (¿se acepta que la promoción pueda regalar más de `max_redemptions` unidades bajo ráfagas, o se ata el stock del regalo al mismo contador?), y (3) una decisión de negocio sobre el punto 4 (¿un regalo agotado en el peor momento debe poder bloquear un pedido ya cobrado?).
