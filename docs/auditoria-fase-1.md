# Auditoría forense de Fase 1 — Base de datos, RLS, Storage, RPC, etiquetas, seed, tipos y clientes

**Fecha:** 2026-07-01
**Alcance:** Fase 1 del proyecto El Buey Madurado (modelo de datos, seguridad de acceso, funciones RPC, etiquetas de trazabilidad, Storage, tipos generados y clientes Supabase).
**Método:** Solo lectura contra el proyecto remoto `tienda-buey-dev` (`pwkpuvagoupvynamskmh`), vía `supabase db query --linked` (introspección `information_schema`/`pg_catalog` y pruebas puntuales en transacciones con `ROLLBACK`) y vía script Node con el cliente `anon` real (`@supabase/supabase-js`) para validar RLS/Storage/RPC tal como los vería un usuario público. No se ha modificado el esquema ni datos de forma permanente. Dos excepciones puntuales, documentadas en su sección: (a) para probar el filtro `is_active` de `products` no existía ningún producto inactivo en el seed, así que se insertó uno temporalmente y se borró de inmediato tras la prueba (un `ROLLBACK` no sirve aquí porque el cliente `anon` opera en otra sesión y no vería una fila no confirmada); (b) `generate_redsys_ds_order()` avanza una secuencia no transaccional — ejecutarla una vez para verificar el formato avanzó `redsys_order_seq` de 2 a 3, un efecto secundario inocuo (los huecos en la secuencia son normales y no afectan a ningún pedido real).

No se ha aplicado ningún cambio correctivo. Este documento cierra con hallazgos priorizados y un veredicto, pendientes de aprobación.

---

## 0 — Preflight

| Comprobación | Resultado | Evidencia |
|---|---|---|
| Proyecto vinculado correcto | **PASS** | `npx supabase projects list` → `tienda-buey-dev` / `pwkpuvagoupvynamskmh`, `ACTIVE_HEALTHY`, `linked: true` |
| Migraciones local/remoto en sync | **PASS** | `npx supabase migration list` → 9 migraciones, columnas Local/Remote idénticas en las 9 filas (20260629111737 … 20260701110034). **Hay migraciones más allá de 0007**: existen 0008 y 0009, aplicadas al remoto. |
| `.env.local` existe, ignorado y no trackeado | **PASS** | El archivo existe; `.env.local` aparece en `.gitignore`; `git ls-files --error-unmatch .env.local` falla con "did not match any file(s)" (no trackeado). Variables presentes (solo nombres): `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`. |

**Migraciones presentes (9, no solo 7):**

| Archivo | Contenido |
|---|---|
| `0001_initial_schema.sql` | Esquema inicial (10 tablas core) |
| `0002_rpc_decrement_stock.sql` | RPC de stock (versión inicial) |
| `0003_product_labels.sql` | `product_labels`, trigger, secuencia Redsys, pg_cron |
| `0004_rls_policies.sql` | Políticas RLS |
| `0005_storage_bucket.sql` | Bucket `product-images` |
| `0006_seed_dev.sql` | Datos de desarrollo |
| `0007_post_review_fixes.sql` | Correcciones post-revisión (retira política pública de `promotions`, entre otras) |
| `0008_harden_function_privileges.sql` | **REVOKE EXECUTE** de las 3 funciones sensibles y de `rls_auto_enable()` para `anon`/`authenticated`, cierre de privilegios de `redsys_order_seq`, fijación de `search_path` |
| `0009_fix_atomic_stock_rpc.sql` | Corrige la atomicidad de `decrement_stock_and_confirm_order` (validar todas las líneas antes de descontar ninguna) |

Esto es relevante para todo lo que sigue: los "agujeros típicos" que esta auditoría busca en las secciones 2 y 3 (RLS de `promotions`, EXECUTE público en funciones sensibles) **ya fueron cerrados** en una ronda de trabajo previa (0007–0009, commits `de9130f`, `8bccbb8`). Esta auditoría verifica en vivo que esos cierres son efectivos, no se limita a leer las migraciones.

---

## 1 — Esquema: tablas, columnas, tipos, constraints

| Comprobación | Resultado | Evidencia |
|---|---|---|
| 11 tablas existen | **PASS** | `information_schema.tables`: `categories, order_items, order_status_history, orders, payments, product_images, product_labels, product_variants, products, promotions, shop_settings` — las 11 presentes. |
| `products` con columnas de plantilla de etiqueta | **PASS** | `ingredients`, `storage_conditions`, `prep_instructions`, `cooking_method` (todas `text`, nullable) + `allergens` (`ARRAY`/`text[]`, default `{}`) + `allergens_notes` (`text`, nullable). Todas presentes. |
| Dinero siempre INT (céntimos) | **PASS** | `product_variants.price` = `integer`; `orders.subtotal/shipping_cost/total` = `integer`; `order_items.unit_price_snapshot/line_total` = `integer`; `payments.amount` = `integer`; `promotions.min_subtotal` = `integer`. Ningún `numeric`/`float` en ningún campo monetario. |
| `orders.order_number` UNIQUE NOT NULL / `redsys_ds_order` UNIQUE nullable | **PASS** | `order_number`: `is_nullable=NO` + constraint `orders_order_number_key` (UNIQUE). `redsys_ds_order`: `is_nullable=YES` + constraint `orders_redsys_ds_order_key` (UNIQUE). |
| Sin columnas `stripe_*` | **PASS** | `grep` sobre `information_schema.columns` con `column_name ILIKE '%stripe%'` → 0 filas en toda la BD. |
| `payments` con campos Redsys, sin stripe | **PASS** | `redsys_ds_order` (NOT NULL), `redsys_ds_response` (nullable), `redsys_authorization` (nullable) presentes; sin `stripe_*`. |
| `order_items` snapshots + `item_type` + `promotion_id` + `product_variant_id` nullable | **PASS** | Todas las columnas del doc presentes: `product_name_snapshot`, `variant_name_snapshot`, `unit_price_snapshot`, `quantity`, `line_total`, `allergens_snapshot`, `allergens_notes_snapshot`, `item_type` (NOT NULL), `promotion_id` (nullable), `product_variant_id` (nullable). |
| `shop_settings` fila única | **PASS** | `UNIQUE(singleton)` + `CHECK(singleton = true)`. Prueba real con `ROLLBACK`: `INSERT INTO shop_settings (singleton, accepting_orders) VALUES (true, true)` → **rechazado**: `23505 duplicate key value violates unique constraint "shop_settings_singleton_key"`. |
| `CHECK` de `orders.status` (7 estados) | **PASS** | `orders_status_check`: `ANY (ARRAY['PENDING_PAYMENT','PAID','PREPARING','CANCELLED','PAYMENT_FAILED','STOCK_ERROR','NEEDS_REVIEW'])` — coincide exactamente con la sección 8. Prueba con `ROLLBACK`: insertar `status='BOGUS_STATUS'` → **rechazado**: `23514 violates check constraint "orders_status_check"`. |
| `CHECK` de `order_items.item_type` | **PASS** | `order_items_item_type_check`: `ANY (ARRAY['PRODUCT','GIFT'])`. Prueba con `ROLLBACK` (pedido temporal + línea con `item_type='BOGUS_TYPE'`) → **rechazado**: `23514 violates check constraint "order_items_item_type_check"`. Se confirmó que no quedó ningún pedido huérfano (`count=0` tras la prueba). |
| Foreign keys y `ON DELETE` | **PASS** (ver nota) | Las 10 FKs de `public` son **`NO ACTION`** (el valor por defecto de Postgres cuando no se especifica `ON DELETE`), sin ninguna `CASCADE` ni `SET NULL`. Esto significa que borrar una fila referenciada (p. ej. una `product_variants` con `order_items` asociados) **falla con un error de FK en vez de dejar huérfanos o borrar en cascada el histórico**. No hay ningún camino de borrado que pueda destruir silenciosamente pedidos, pagos o histórico. Ver nota en hallazgos sobre la columna nullable `order_items.product_variant_id`. |
| Índices de la sección 8 | **PASS** | Presentes exactamente: `products_category_id_is_active_idx (category_id, is_active)`, `product_variants_product_id_is_active_idx (product_id, is_active)`, `orders_status_created_at_idx (status, created_at DESC)`, `order_items_order_id_idx (order_id)`, `order_status_history_order_id_created_at_idx (order_id, created_at)`. |

**Detalle de FKs (`child.column → parent.column`, todas `ON DELETE NO ACTION`):**

`order_items.order_id → orders.id`, `order_items.product_variant_id → product_variants.id`, `order_items.promotion_id → promotions.id`, `order_status_history.order_id → orders.id`, `payments.order_id → orders.id`, `product_images.product_id → products.id`, `product_labels.order_item_id → order_items.id`, `product_labels.product_id → products.id`, `product_variants.product_id → products.id`, `products.category_id → categories.id`, `promotions.gift_variant_id → product_variants.id`.

---

## 2 — RLS: verificación en vivo (crítico)

| Comprobación | Resultado | Evidencia |
|---|---|---|
| RLS habilitado en las 11 tablas | **PASS** | `pg_class.relrowsecurity = true` en las 11 tablas, sin excepción. |
| Solo 5 políticas públicas, todas `SELECT` para `anon` | **PASS** | `pg_policies` devuelve exactamente 5 filas: `categories` (`is_active = true`), `products` (`is_active = true`), `product_variants` (`is_active = true`), `product_images` (`true`, sin filtro — ver hallazgo menor), `shop_settings` (`true`). Todas `cmd=SELECT`, `roles={anon}`. |
| `promotions` sin política para `anon` | **PASS** | 0 políticas sobre `promotions` en `pg_policies`. Confirma que el cierre de 0007 sigue vigente en vivo. |
| `orders`, `order_items`, `payments`, `order_status_history`, `product_labels` sin política pública | **PASS** | 0 políticas sobre estas 5 tablas. |
| Sin políticas inesperadas para `authenticated` | **PASS** | Las 5 políticas existentes tienen `roles={anon}` exclusivamente; ninguna fila con `authenticated`. |

**Pruebas reales con el cliente `anon`** (script Node, `@supabase/supabase-js`, clave anon real):

| Prueba | Resultado | Evidencia |
|---|---|---|
| `from('categories').select()` | **PASS** | `status 200`, 4 filas devueltas. |
| `from('products').select()` — solo activos | **PASS** | `status 200`, 10 filas, ninguna con `is_active=false`. **No existía ningún producto inactivo en el seed** (`0/10`), así que se insertó uno temporal (`is_active=false`) directamente por SQL, se repitió la consulta anon filtrando por su slug → `0 filas` (no visible), y se borró el registro de prueba de inmediato. Confirma que el filtro de la política opera de verdad, no solo que la tabla esté vacía. |
| `from('product_variants').select()` — solo activos | **PASS** | `status 200`, 16 filas, ninguna con `is_active=false`. |
| `from('product_images').select()` | **PASS** (con nota) | `status 200`, 10 filas — lectura pública sin filtro, tal como está definida la política (ver hallazgo menor). |
| `from('shop_settings').select()` | **PASS** | `status 200`, 1 fila (`singleton=true`, `accepting_orders=true`). |
| `from('orders').select()` | **PASS** | `[]`. La tabla está genuinamente vacía en producción (`count=0` confirmado por SQL directo), así que este resultado por sí solo no demuestra bloqueo por RLS — pero está corroborado estructuralmente por la ausencia total de políticas para `orders` en `pg_policies` (con RLS habilitado y 0 políticas, Postgres deniega todo acceso a roles no-propietarios por diseño, independientemente del contenido de la tabla). |
| `from('promotions').select()` | **PASS — evidencia sólida** | `[]`, pese a que la tabla **tiene 1 fila real** (`count=1` confirmado por SQL directo). Esta es la prueba más fuerte de todo el bloque: hay datos, y el cliente anon no los ve. |
| `from('order_items').select()`, `from('payments').select()`, `from('order_status_history').select()`, `from('product_labels').select()` | **PASS** (con misma salvedad que `orders`) | Las 4 devuelven `[]`; las 4 tablas están genuinamente vacías hoy, corroborado por ausencia de políticas en `pg_policies`. |
| `from('orders').insert(...)` | **PASS** | `status 401`, `code 42501`: *"new row violates row-level security policy for table \"orders\""*. |
| `from('products').insert(...)` | **PASS** | `status 401`, `code 42501`: *"new row violates row-level security policy for table \"products\""*. |
| `from('products').update(...)` sobre una fila real existente (`chuleton-vaca-madurada`) | **PASS** | La llamada devuelve `status 200` con `data: []` (0 filas afectadas, comportamiento estándar de PostgREST cuando RLS no expone ninguna fila actualizable para ese rol). Se verificó por SQL directo que el campo `name` del producto **no cambió** — el intento de vandalismo no tuvo ningún efecto. |

---

## 3 — Permisos EXECUTE de funciones (crítico)

| Comprobación | Resultado | Evidencia |
|---|---|---|
| `has_function_privilege('anon', 'decrement_stock_and_confirm_order(uuid,jsonb)', 'EXECUTE')` | **PASS** | `false` |
| `has_function_privilege('authenticated', ..., 'EXECUTE')` | **PASS** | `false` |
| `has_function_privilege('anon', 'generate_redsys_ds_order()', 'EXECUTE')` | **PASS** | `false` |
| `has_function_privilege('anon', 'suggest_product_label_fields()', 'EXECUTE')` | **PASS** | `false` |
| `has_function_privilege('service_role', 'decrement_stock_and_confirm_order(uuid,jsonb)', 'EXECUTE')` | **PASS** | `true` — el único rol con acceso es el correcto. |
| Prueba real: `rpc('decrement_stock_and_confirm_order', ...)` con cliente anon | **PASS** | `status 401`, `code 42501`: *"permission denied for function decrement_stock_and_confirm_order"*. |
| Prueba real: `rpc('generate_redsys_ds_order')` con cliente anon | **PASS** | `status 401`, `code 42501`: *"permission denied for function generate_redsys_ds_order"*. |
| Prueba real: `rpc('suggest_product_label_fields')` con cliente anon | **PASS** | `status 404`, `PGRST202`: PostgREST ni siquiera encuentra la función en su caché de esquema (es una función de trigger, no pensada para invocación RPC directa) — denegación aún más fuerte que un simple 401. |

**Hallazgo adicional (no en el checklist original):** existe una función extra `public.rls_auto_enable()` no documentada en `docs/tienda-online-mvp.md`, introducida en `0008_harden_function_privileges.sql` como *event trigger* (`SECURITY DEFINER`, `search_path=pg_catalog`) que fuerza `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` automáticamente sobre cualquier tabla nueva creada en `public`. Es una red de seguridad razonable (evita que una tabla futura se cree sin RLS por descuido), y su EXECUTE también está revocado para `anon`/`authenticated` (confirmado: `false`). Se documenta aquí porque la consigna pedía descubrir el estado real sin asumir nada a partir del doc.

**Conclusión de la sección 3:** el agujero típico descrito en la consigna (funciones ejecutables por `anon` vía PostgREST) **no existe hoy en este proyecto** — ya fue cerrado por la migración 0008 y se verifica en vivo, con prueba real incluida.

---

## 4 — RPC de stock (revisión de lógica)

| Comprobación | Resultado | Evidencia |
|---|---|---|
| Firma y cuerpo según sección 12 | **PASS** | Definición viva (`pg_get_functiondef`) es carácter por carácter la de `0009_fix_atomic_stock_rpc.sql`: `PERFORM ... FOR UPDATE` sobre el pedido, dos pasadas sobre `product_variants` (bloqueo `FOR UPDATE` + validación de existencia y stock **sin descontar**, luego descuento solo si todo pasó), y `UPDATE orders SET status='PAID', paid_at=now(), updated_at=now()` al final. Retorna `jsonb` con `ok`/`error` según el patrón del doc. |
| SECURITY DEFINER / INVOKER | **INVOKER** | `prosecdef = false` → `SECURITY INVOKER` (el valor por defecto; la función no declara `SECURITY DEFINER`). Es correcto en este caso: la única identidad que puede ejecutarla es `service_role` (sección 3), que en Supabase ya tiene privilegios plenos sobre las tablas, así que no hace falta escalar privilegios con `DEFINER`. |
| GAP conocido: no idempotente por sí sola | **Confirmado, no corregido (fuera de alcance de esta auditoría)** | La función no verifica si el pedido ya está en `PAID` antes de descontar — una segunda notificación de Redsys para el mismo pedido volvería a descontar stock. Este comportamiento está diferido a Fase 6 según la consigna, y así se documenta también en `docs/tienda-online-mvp.md` (sección 19, "Webhook idempotente: verificar estado del pedido antes de cualquier operación" — pendiente de implementar en el handler, no en la función SQL). |
| ¿Hoy hay algún caller? | **PASS — no explotable todavía** | `grep -r "decrement_stock_and_confirm_order" src/` solo encuentra la firma en los tipos generados (`src/supabase/types.ts`). No existe `src/app/api/pagos/notificacion` ni ningún otro route handler que la invoque. El único endpoint bajo `src/app/api/` es `sorteo/route.ts` (no relacionado). El gap de idempotencia es real pero inerte: no hay ningún camino de ejecución hoy que pueda disparar una doble notificación. |

---

## 5 — Etiquetas, trigger, secuencia Redsys y cron

| Comprobación | Resultado | Evidencia |
|---|---|---|
| Estructura de `product_labels`, `expiry_date` nullable | **PASS** | Todas las columnas de la sección 11bis presentes; `expiry_date` es `date`, `is_nullable=YES`. |
| Trigger `BEFORE INSERT` — prueba con `ROLLBACK` | **PASS** | `INSERT INTO product_labels (product_id) VALUES (<chuleton-vaca-madurada>)` dentro de `BEGIN; ... ROLLBACK;`. Fila resultante: `lote = "L260701-chuleton-vaca-madurada"` (fecha de hoy + slug, tal como especifica el doc), `ingredients`, `storage_conditions`, `prep_instructions`, `cooking_method`, `allergens`, `product_name` todos rellenados desde la plantilla del producto, **`expiry_date = NULL`** (nunca calculada), `weight_grams = NULL`, `order_item_id = NULL`. Se confirmó por SQL directo tras el `ROLLBACK` que `count=0` — no quedó ninguna fila. |
| `generate_redsys_ds_order()` formato válido | **PASS** | Ejecutada una vez → `"26000003"` (8 caracteres, dentro del rango 4–12; los 4 primeros son numéricos porque toda la cadena lo es: `to_char(CURRENT_DATE,'YY') \|\| LPAD(nextval(...), 6, '0')`). *Efecto secundario de la prueba: avanzó la secuencia de 2 a 3 — inocuo, ver nota al inicio del documento.* |
| `redsys_order_seq` existe | **PASS** | `pg_sequences`: `redsys_order_seq`, `increment_by=1`, presente y con privilegios cerrados a `service_role` (confirmado en 0008). |
| pg_cron: extensión y jobs | **PASS** | `pg_extension`: `pg_cron 1.6.4` instalada. `cron.job`: **exactamente 1 fila** — `jobname='delete-old-product-labels'`, `schedule='0 3 * * *'` (diario, 3:00 UTC), `command` con `DELETE FROM product_labels WHERE COALESCE(elaboration_date, created_at::date) < CURRENT_DATE - INTERVAL '6 months'`. Coincide exactamente con la sección 11bis: un único job, diario, intervalo de 6 meses. |

---

## 6 — Storage

| Comprobación | Resultado | Evidencia |
|---|---|---|
| Bucket `product-images` existe | **PASS** | `storage.buckets`: `id='product-images'`, `public=true`. |
| `file_size_limit` / `allowed_mime_types` | **PASS (con nota)** | `file_size_limit = 307200` bytes (300 KB) — cubre el caso más grande del doc (imágenes de detalle, 300 KB), pero es un único límite global de bucket; no diferencia el límite más estricto de 250 KB (imagen principal) ni 150 KB (categoría) — eso solo puede aplicarse en la capa de subida (backend/Studio), no a nivel de bucket. `allowed_mime_types = [image/webp, image/jpeg, image/png, image/gif]` — razonable, incluye WebP (formato recomendado) y no permite tipos arbitrarios. |
| Políticas de `storage.objects` | **PASS** | RLS habilitado en `storage.objects` (`relrowsecurity=true`). Solo **1 política**: `"Lectura publica de imagenes de productos"`, `cmd=SELECT`, `roles={anon}`, `qual=(bucket_id = 'product-images')`. **0 políticas de INSERT/UPDATE/DELETE para ningún rol público.** |
| Prueba real: subida con cliente anon | **PASS** | `supabase.storage.from('product-images').upload(...)` con el cliente anon → `StorageApiError`, `status 400/403`: *"new row violates row-level security policy"*. La escritura está efectivamente bloqueada para `anon`. |

---

## 7 — Tipos y clientes (fuga de service_role)

| Comprobación | Resultado | Evidencia |
|---|---|---|
| `src/supabase/types.ts` actualizado vs esquema real | **PASS** | `npx supabase gen types typescript --linked` regenerado a un archivo temporal y comparado (tras normalizar BOM/CRLF del archivo trackeado, que está en UTF-8 con BOM y CRLF frente al LF sin BOM del regenerado — diferencia puramente de codificación, no de contenido): **diff vacío, 0 líneas de diferencia**. Incluye `product_labels` y las columnas de plantilla de etiqueta (`ingredients`, `storage_conditions`, `prep_instructions`, `cooking_method`) verificadas explícitamente. |
| `src/lib/supabase.ts` usa la anon key | **PASS** | `createClient<Database>(NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY)` — ninguna referencia a la service role. |
| `src/lib/supabase-admin.ts` usa service_role + `server-only` | **PASS** | Línea 1 exacta: `import 'server-only'`. Usa `SUPABASE_SERVICE_ROLE_KEY` (sin prefijo `NEXT_PUBLIC_`). |
| Grep de fuga de `SUPABASE_SERVICE_ROLE_KEY` en `src/` | **PASS** | Única aparición en todo `src/`: `src/lib/supabase-admin.ts:6`. No aparece en ningún otro archivo, ni junto a `NEXT_PUBLIC_`, ni en ningún componente. |
| Uso de `supabase-admin` en el resto del código | **PASS (nada que revisar todavía)** | `grep -r "supabase-admin" src/` → 0 resultados fuera del propio archivo. El cliente admin **aún no se usa en ningún route handler/server component** — coherente con que la Fase 1 es solo la capa de base de datos; el checkout y la notificación de Redsys se implementarán en fases posteriores. |
| Grep de residuos (`stripe`, `webhook`, `elbuymadurado.es`, `5%`) | **PASS** | `stripe`, `webhook`, `elbuymadurado.es`: 0 coincidencias en `src/` ni `supabase/migrations/`. `5%`: 1 coincidencia, falso positivo (`max-width: 85%` en `src/app/carta/carta.css:207`, CSS no relacionado con IVA). |

---

## 8 — Coherencia documento ↔ estado y notas operativas

| Comprobación | Resultado | Evidencia |
|---|---|---|
| Seed vs sección 25 — categorías | **PASS** | 4 categorías, slugs y `sort_order` exactos: `packs-carne-madurada(1)`, `hamburguesas(2)`, `croquetas(3)`, `gourmet(4)`. |
| Seed vs sección 25 — productos, variantes, precios, alérgenos | **PASS** | Las 10 filas de producto×variante consultadas en vivo coinciden exactamente con la tabla de la sección 25 (slugs, nombres, precios en céntimos, alérgenos, stock inicial: 20 uds. carne, 30–40 uds. croquetas/salsas/gourmet según producto). |
| Promoción del seed | **PASS** | `name="Burger Wagyu de regalo en pedidos +100€"`, `type=GIFT_PRODUCT`, `min_subtotal=10000` (100 €), `is_active=false`, `max_redemptions=10`, `current_redemptions=0` — coincide exactamente con la sección 25. |
| `0006_seed_dev.sql` es solo para desarrollo | **Recordatorio, no bloqueante** | Confirmado: el propio doc (sección 25, encabezado) dice que son datos de desarrollo con precios placeholder. **Debe vaciarse/eliminarse antes de producción.** No se ha tocado en esta auditoría. |
| Token de acceso expuesto en conversación previa | **Acción manual pendiente — no verificable desde aquí** | No hay forma de comprobar el estado de revocación de un token desde una sesión de solo lectura sin contexto de qué token ni dónde se expuso. Se recomienda: revisar el panel (Settings → API) y rotar cualquier clave que se haya compartido fuera de canales seguros, como medida de higiene. |

---

## 9 — Git

| Comprobación | Resultado | Evidencia |
|---|---|---|
| `git log --oneline` limpio, un commit por unidad | **PASS** | Historial legible: `feat(db): Unidad 1..7` para el esquema/RPC/etiquetas/RLS/storage/seed/clientes, seguido de `fix:`/`docs:` puntuales (`e48059b`, `96fdd07`, `8d1a700`, `de9130f`, `ca98a33`, `8bccbb8`, `55802f2`). Un commit por unidad de trabajo, mensajes descriptivos. |
| Migraciones y `types.ts` commiteados | **PASS** | Los 9 archivos de `supabase/migrations/` y `src/supabase/types.ts` están trackeados (`git ls-files`). |
| Árbol de trabajo sin cambios sin guardar | **FAIL** | `git status` muestra: `package.json` y `package-lock.json` modificados (sin stagear) y dos archivos sin trackear: `supabase/.gitignore`, `supabase/config.toml`. Rama 15 commits por delante de `origin/main` (no sincronizada, no bloqueante salvo que se quiera hacer backup remoto). |

**Detalle del diff pendiente:** `package.json` añade `@supabase/supabase-js`, `server-only` (dependencies) y `supabase` CLI (devDependencies) — cambios legítimos y esperados dado que la Fase 1 introdujo el cliente Supabase, simplemente no se han commiteado. `supabase/.gitignore` y `supabase/config.toml` son generados por `supabase init`/`supabase link`; `config.toml` solo contiene `project_id = "ElBueyMadurado-main-tienda"` (no sensible). Ninguno de los 4 archivos contiene secretos.

---

## Hallazgos (ordenados por severidad)

Ningún hallazgo crítico. La postura de seguridad de la Fase 1 (RLS, permisos de funciones, Storage) se comprobó en vivo con el cliente `anon` real y se sostiene: los agujeros típicos para este tipo de proyecto (RLS de `promotions` reabierta, funciones RPC ejecutables por `anon`) ya estaban cerrados por 0007–0009 antes de empezar esta auditoría, y las pruebas adversariales lo confirman.

### 1. WARN — Árbol de trabajo con cambios sin commitear
**Dónde:** raíz del repo (`package.json`, `package-lock.json`, `supabase/.gitignore`, `supabase/config.toml`).
**Por qué importa:** si se empieza la Fase 2 sin commitear esto, el historial no refleja fielmente cuándo se introdujo la dependencia de Supabase, y `supabase/config.toml` (necesario para que cualquier otra persona pueda hacer `supabase link` sin configurarlo a mano) no está versionado.
**Arreglo propuesto (no aplicado):**
```
git add package.json package-lock.json supabase/.gitignore supabase/config.toml
git commit -m "chore: commit supabase CLI config and lockfile updates"
```

### 2. WARN — Sin CHECK de rango en campos numéricos de negocio
**Dónde:** `product_variants.price`, `product_variants.stock`, `order_items.quantity`, `order_items.unit_price_snapshot`/`line_total`, `orders.subtotal`/`shipping_cost`/`total`, `payments.amount`.
**Por qué importa:** hoy solo hay 3 `CHECK` en toda la base (`orders.status`, `order_items.item_type`, `shop_settings.singleton`). Nada a nivel de base de datos impide un precio negativo, un stock negativo o una cantidad ≤ 0 introducidos por error manual en Supabase Studio o por un futuro bug de aplicación — la única barrera hoy es la validación en el backend (Zod, según sección 19), que todavía no existe.
**Arreglo propuesto (no aplicado):**
```sql
ALTER TABLE product_variants ADD CONSTRAINT product_variants_price_check CHECK (price >= 0);
ALTER TABLE product_variants ADD CONSTRAINT product_variants_stock_check CHECK (stock >= 0);
ALTER TABLE order_items ADD CONSTRAINT order_items_quantity_check CHECK (quantity > 0);
ALTER TABLE orders ADD CONSTRAINT orders_amounts_check CHECK (subtotal >= 0 AND shipping_cost >= 0 AND total >= 0);
ALTER TABLE payments ADD CONSTRAINT payments_amount_check CHECK (amount >= 0);
```

### 3. WARN (bajo) — `product_images` sin filtro ligado al estado del producto padre
**Dónde:** política `"anon puede leer imagenes de productos"` sobre `product_images`, `qual = true` (sin condición).
**Por qué importa:** si en el futuro un producto pasa a `is_active=false`, sus filas de `product_images` (URL, `alt_text`, orden) siguen siendo legibles por `anon` vía la tabla, aunque el producto ya no aparezca en `products`. Impacto real limitado porque el bucket de Storage ya es 100% público de todas formas (cualquiera con la URL puede verla); esto solo expone metadatos adicionales (qué imágenes tenía un producto retirado). Hoy no es explotable porque no hay ningún producto inactivo en el seed.
**Arreglo propuesto (no aplicado):**
```sql
DROP POLICY "anon puede leer imagenes de productos" ON product_images;
CREATE POLICY "anon puede leer imagenes de productos activos" ON product_images
  FOR SELECT TO anon
  USING (EXISTS (SELECT 1 FROM products p WHERE p.id = product_images.product_id AND p.is_active = true));
```

### 4. Nota (no bloqueante) — Intención de diseño vs comportamiento real en `order_items.product_variant_id`
**Dónde:** FK `order_items.product_variant_id → product_variants.id`, `ON DELETE NO ACTION`.
**Por qué importa:** el comentario de la sección 8 del doc dice que la columna es nullable "para proteger si se borra la variante en el futuro", lo que sugiere la expectativa de un `ON DELETE SET NULL`. El comportamiento real (`NO ACTION`, el default) es en realidad más seguro — bloquea el `DELETE` con un error de FK en vez de dejar el histórico con una referencia nula — pero es una discrepancia entre la intención documentada y el comportamiento vivo. No requiere corrección salvo que el negocio realmente quiera poder borrar variantes descontinuadas conservando el histórico de pedidos; en ese caso sí haría falta migrar a `ON DELETE SET NULL` explícitamente.

### 5. Pendiente operativo (no técnico) — Higiene de credenciales
- `0006_seed_dev.sql` debe vaciarse o eliminarse antes de pasar a producción (ya advertido por el propio doc).
- Verificar manualmente si el token de acceso mencionado en una conversación previa fue revocado; no verificable desde esta auditoría de solo lectura.

---

## Veredicto final

**La Fase 1 está lista para pasar a la Fase 2.** No hay bloqueantes de seguridad ni de integridad de esquema. Todos los controles críticos (RLS por tabla, aislamiento de `promotions`/`orders`/`order_items`/`payments`/`order_status_history`/`product_labels`, permisos `EXECUTE` de las 3 funciones sensibles, políticas de Storage, coherencia de tipos generados, ausencia de fuga de `service_role`) se verificaron **en vivo, con pruebas reales usando la clave `anon`**, no solo leyendo migraciones — y todos pasaron.

Los 5 hallazgos son de severidad baja/informativa y ninguno impide avanzar:
1. Commitear los cambios pendientes de git (higiene, no seguridad).
2. Añadir `CHECK` de rango a campos numéricos (defensa en profundidad; hoy no hay ningún camino de escritura pública que pueda explotarlo, porque toda escritura pasa por `service_role`).
3. Estrechar la política de `product_images` a productos activos (impacto mínimo, no explotable hoy).
4. Aclarar la intención de negocio sobre `ON DELETE` sobre `product_variant_id` — decisión de producto, no bug.
5. Vaciar el seed antes de producción y confirmar rotación del token expuesto — ambas son tareas operativas, no bloqueantes de la Fase 2.

Quedo a la espera de tu visto bueno para aplicar cualquiera de los arreglos propuestos; ninguno se ha ejecutado.
