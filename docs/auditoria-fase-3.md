# Auditoría puntual — Fase 3 (Carrito)

**Fecha:** 2026-07-05
**Alcance:** Unidades 0–6 de la Fase 3, ya commiteadas. Motivo: la Unidad 3 introdujo el primer uso de `supabase-admin` en código de aplicación (endpoint de promoción activa), que la Fase 4 (checkout) va a reutilizar para crear pedidos reales. Auditoría dirigida, no exhaustiva.

**Proyecto Supabase verificado:** `tienda-buey-dev` (`pwkpuvagoupvynamskmh`) — confirmado con `npx supabase projects list` antes de empezar.

**Postura:** solo lectura sobre código; las pruebas de comportamiento en BD se hicieron con `npx supabase db query --linked` sobre la única fila de `promotions` del seed, revirtiendo cada cambio manualmente al terminar (no se usó `ROLLBACK` porque el endpoint se consulta vía PostgREST/service-role en una conexión distinta a la del CLI — un cambio no confirmado (`COMMIT`) no sería visible para el endpoint, así que la única forma de que la prueba fuera real era confirmar y luego revertir a mano).

---

## Hallazgo previo (no bloqueante): estado inicial no coincidía con el documentado

Antes de tocar nada, se leyó el estado real de la fila de `promotions`:

```json
{
  "current_redemptions": 0, "ends_at": null, "is_active": true,
  "max_redemptions": 10, "min_subtotal": 10000,
  "name": "Burger Wagyu de regalo en pedidos +100€", "starts_at": null
}
```

La sección 25 documenta el seed con `is_active: false` ("activar manualmente desde Supabase Studio cuando se confirme"), y la migración `20260629115100_0006_seed_dev.sql` (línea 240) efectivamente inserta la fila con `is_active = false`. Es decir: la migración es correcta, pero en algún momento posterior alguien activó la promoción manualmente (probablemente para probar la Unidad 4/6 en el navegador) y no la volvió a desactivar. No es un defecto de código, es deriva de datos en el entorno de desarrollo. Se restauró a `is_active = false` al final de esta auditoría (ver punto 1).

**Recomendación:** antes de empezar Fase 4, decidir un procedimiento (script o nota en README) para dejar el seed de promociones en estado conocido antes de cada sesión de pruebas, para evitar sorpresas como esta.

---

## Tabla de resultados

| # | Punto | Veredicto | Evidencia clave |
|---|-------|-----------|-----------------|
| 1 | Endpoint no filtra datos internos | **PASS** | Ver detalle abajo |
| 2 | Uso de `supabase-admin` acotado | **PASS** | Ver detalle abajo |
| 3 | Lógica de disponibilidad correcta | **PASS** | Ver detalle abajo |
| 4 | Carrito no trata la promoción como definitiva | **PASS** | Ver detalle abajo |
| 5 | RLS de `promotions` sin cambios | **PASS** | Ver detalle abajo |

---

## 1 — Endpoint de promoción activa no filtra datos internos (crítico) — PASS

Route handler: [src/app/api/tienda/promocion-activa/route.ts](src/app/api/tienda/promocion-activa/route.ts).

**a) Con `is_active = false`** (tras poner el estado real a `false` mediante `UPDATE promotions SET is_active = false WHERE id = 'c2879267-c149-44d5-b977-10d928ad0bc2'`), llamada real al endpoint (`curl http://localhost:3000/api/tienda/promocion-activa`):

```json
{"available":false}
```

**b) Con `is_active = true`** (`UPDATE promotions SET is_active = true WHERE id = ...`), llamada real al endpoint:

```json
{"available":true,"minSubtotal":10000,"giftName":"Burger Wagyu Artesana — Pack 4 uds."}
```

**Verificación explícita de campos ausentes:** la respuesta JSON completa y literal solo contiene `available`, `minSubtotal` y `giftName`. No aparece `id`, `current_redemptions`, `max_redemptions`, `starts_at`, `ends_at`, ni ningún otro campo de `promotions`. Esto coincide con `PromotionAvailability` en [src/types/cart.ts:29-31](src/types/cart.ts#L29-L31), que tipa la respuesta exactamente así.

**Restauración final:** `UPDATE promotions SET is_active = false, ends_at = NULL, current_redemptions = 0 WHERE id = 'c2879267-c149-44d5-b977-10d928ad0bc2'`. Lectura de confirmación tras la restauración:

```json
{"current_redemptions":0,"ends_at":null,"id":"c2879267-c149-44d5-b977-10d928ad0bc2","is_active":false,"max_redemptions":10,"min_subtotal":10000,"name":"Burger Wagyu de regalo en pedidos +100€","starts_at":null}
```

Llamada final al endpoint tras la restauración: `{"available":false}`. Estado consistente con el seed documentado en la sección 25.

---

## 2 — Uso de `supabase-admin` acotado (crítico) — PASS

`grep -rln "supabase-admin" src/` devuelve un único resultado:

```
src/app/api/tienda/promocion-activa/route.ts
```

No aparece en ningún Client Component, ni en ningún archivo importado desde uno. Es la única aparición fuera de [src/lib/supabase-admin.ts](src/lib/supabase-admin.ts) (el propio wrapper del cliente admin).

**Server-side confirmado:**
- El wrapper [src/lib/supabase-admin.ts:1](src/lib/supabase-admin.ts#L1) importa `'server-only'`, que revienta el build si algún día se importa desde código de cliente.
- El consumidor es un route handler de Next (`export async function GET()` en `src/app/api/.../route.ts`), no una función ejecutada en el navegador.

**Bundle del cliente:** se ejecutó `next build` (build de producción) y se buscó el valor real de `SUPABASE_SERVICE_ROLE_KEY` y el nombre de la variable dentro de `.next/static` (los chunks que sí se sirven al navegador):

```
grep -r "<valor real de la key>" .next/static  → sin resultados
grep -rl "SUPABASE_SERVICE_ROLE_KEY" .next/static → sin resultados
```

El nombre de la variable sí aparece en `.next/server/chunks/node_modules_next_dist_*.js` — es código interno de Next.js para leer `process.env` en el servidor, no una fuga; ese chunk no se sirve al navegador. Tras el build se confirmó que el servidor de desarrollo seguía respondiendo con normalidad (`/carrito` y el endpoint devuelven 200).

---

## 3 — Lógica de disponibilidad de la promoción — PASS

Comparación contra los 4 criterios de la sección 13:

| Criterio de la sección 13 | Implementación en el endpoint |
|---|---|
| `is_active = true` | `.eq('is_active', true)` |
| `starts_at IS NULL OR starts_at <= now()` | `.or('starts_at.is.null,starts_at.lte.<nowIso>')` |
| `ends_at IS NULL OR ends_at >= now()` | `.or('ends_at.is.null,ends_at.gte.<nowIso>')` |
| `max_redemptions IS NULL OR current_redemptions < max_redemptions` | Filtrado en JS tras la consulta: `promo.max_redemptions === null \|\| promo.current_redemptions < promo.max_redemptions` |

Los cuatro criterios están cubiertos (dos a nivel SQL vía PostgREST, uno a nivel de columna, y el de `max_redemptions` en memoria tras traer la fila). Confirmado con pruebas de caso límite reales:

**Caso límite A — promoción agotada** (`current_redemptions = max_redemptions = 10`, con `is_active = true`):
```
UPDATE promotions SET current_redemptions = 10 WHERE id = ...
curl .../promocion-activa → {"available":false}
```

**Caso límite B — `ends_at` en el pasado** (`current_redemptions` repuesto a 0, `ends_at = now() - 1 día`, `is_active = true`):
```
UPDATE promotions SET current_redemptions = 0, ends_at = (now() - interval '1 day') WHERE id = ...
curl .../promocion-activa → {"available":false}
```

Ambos casos devuelven correctamente "no disponible". Los dos cambios se revirtieron como parte de la restauración final del punto 1.

**Nota menor (no bloqueante):** no hay una constraint de BD que fuerce "una sola promoción activa a la vez" (es una regla operativa de la sección 13, no un `UNIQUE`/índice parcial). Si en algún momento hubiera dos filas con `is_active = true` simultáneamente, el endpoint tomaría la primera que el `.find()` de JS encuentre en el orden devuelto por PostgREST (sin `ORDER BY` explícito), lo cual sería no determinista. Con una sola promoción en el seed esto no afecta al MVP, pero conviene tenerlo en cuenta si se gestiona esto solo por disciplina en Supabase Studio.

---

## 4 — El carrito no trata la promoción como definitiva — PASS

Componentes revisados: [src/contexts/CartContext.tsx](src/contexts/CartContext.tsx), [src/components/Carrito/PromocionBanner.tsx](src/components/Carrito/PromocionBanner.tsx), [src/components/Carrito/CartSummary.tsx](src/components/Carrito/CartSummary.tsx), [src/lib/shipping.ts](src/lib/shipping.ts).

- `PromocionBanner` solo hace `fetch('/api/tienda/promocion-activa')` y pinta un mensaje informativo (`"Te faltan X€..."` o `"¡Promoción aplicada!..."`). No escribe en ninguna tabla, no llama a ninguna RPC, no incrementa `current_redemptions`.
- `grep -rln "current_redemptions|gift_variant_id|order_item|GIFT" src/app src/lib src/components src/contexts` solo encuentra el propio route handler de la Unidad 3 (`promocion-activa/route.ts`) — ningún componente de carrito referencia estos conceptos.
- `CartContext` (`src/contexts/CartContext.tsx`) es puro estado de cliente (`localStorage` + React state): `variantId`, `quantity` y campos de display cacheados. El comentario del propio archivo (líneas 3-7) ya deja explícito que "nunca es la fuente de verdad de precios, stock ni promociones. Eso lo recalcula el backend en la Fase 4."
- `calculateShippingCost` ([src/lib/shipping.ts](src/lib/shipping.ts)) es una función pura (10,00€ fijo, gratis desde 150,00€ inclusive) usada únicamente dentro de `CartSummary` para pintar un total. El propio componente lo etiqueta como "Total orientativo. El importe final se confirma en el pago." ([src/components/Carrito/CartSummary.tsx:38](src/components/Carrito/CartSummary.tsx#L38)) — no se usa en ningún sitio como total autoritativo de un pedido.

---

## 5 — Repaso rápido de RLS — PASS

**Lectura real con la anon key** (la misma que usaría el navegador), vía PostgREST directamente:

```
GET {SUPABASE_URL}/rest/v1/promotions?select=*
Headers: apikey / Authorization: Bearer <anon key>
→ HTTP 200, body: []
```

Confirmado: `promotions` sigue sin política pública para `anon`, tal como quedó cerrado en la migración `20260701085529_0007_post_review_fixes.sql` (que hace `DROP POLICY IF EXISTS "anon puede leer promociones" ON public.promotions;`).

**Migraciones nuevas de RLS en esta fase:** ninguna. Las migraciones posteriores a la 0007 son `0008_harden_function_privileges.sql`, `0009_fix_atomic_stock_rpc.sql` y `fix_seed_product_images_placeholder.sql`; ninguna de las tres contiene `CREATE POLICY`, `ALTER POLICY`, `DROP POLICY` ni `ROW LEVEL SECURITY` (verificado por grep).

---

## Veredicto

**La Fase 3 está lista para que la Fase 4 (checkout) construya sobre el endpoint de promoción tal cual está.** No hay ningún FAIL. Los cinco puntos pasan con evidencia real de comportamiento (no solo lectura de código): el endpoint no filtra `service_role` fuera del servidor, no expone campos internos de `promotions`, implementa correctamente los cuatro criterios de disponibilidad (incluidos los casos límite de agotamiento y caducidad), el carrito es puramente informativo, y RLS sigue cerrado para `anon`.

Dos observaciones no bloqueantes a tener en cuenta antes o durante la Fase 4:

1. **Higiene de datos de desarrollo:** la promoción del seed estaba activada manualmente en la BD (contradice la sección 25); ya se restauró a `is_active = false`. Conviene un procedimiento explícito para resetear este estado antes de sesiones de prueba.
2. **Ausencia de constraint "una sola promoción activa":** es una regla operativa, no forzada por BD ni por `ORDER BY` en la query. No bloquea el MVP con una sola promoción, pero si la Fase 4 replica esta misma consulta para `create-session` conviene decidir explícitamente un criterio de desempate (p. ej. `ORDER BY created_at ASC LIMIT 1`) en vez de depender del orden implícito de PostgREST.
