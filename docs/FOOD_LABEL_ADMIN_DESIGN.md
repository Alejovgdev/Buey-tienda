# Diseño: sistema de etiquetado alimentario en el panel admin

**Estado:** **implementado** (2026-07-15) — ver §19 para el detalle exacto de qué se construyó, con qué simplificaciones respecto al diseño original y qué queda pendiente antes de producción. Las secciones 1-18 se conservan tal cual como el razonamiento de diseño original; §19 documenta la implementación real.
**Alcance de la etiqueta:** exclusivamente información legal de trazabilidad e identificación del alimento. Nunca datos de cliente, dirección, precio, pago o factura — eso vive en `orders` y se muestra ya en `/admin/pedidos/[id]`, y sigue siendo una vista separada.

---

## 1. Resumen del estado actual

El proyecto es una tienda Next.js 16 (App Router) + TypeScript + Supabase, en fase de panel admin ("Fase 7" según `docs/tienda-online-mvp.md`). Ya existe:

- Un panel admin mínimo (`src/app/admin/pedidos`, `src/app/admin/pedidos/[id]`) con autenticación por **contraseña única compartida** (cookie JWT firmada, sin usuarios individuales — ver `src/lib/admin-auth.ts`, `src/lib/admin-session.ts`).
- Gestión de pedidos: cambio de estado (`OrderStatusControl`), notas internas (`OrderNotesForm`), línea de tiempo de eventos (`OrderTimeline`), banner de incidencias (`IncidentBanner`).
- Un **borrador ya diseñado (pero no integrado en ninguna UI)** de etiquetado: la migración `supabase/migrations/20260629114656_0003_product_labels.sql` crea la tabla `product_labels` con un trigger de pre-relleno desde `products` y un job `pg_cron` de retención de 6 meses. Está documentado en la sección "11 bis" de `docs/tienda-online-mvp.md`, pero:
  - No hay ninguna página, componente ni endpoint API que la use hoy.
  - Modela **una etiqueta por `order_item`**, no por envase físico — no resuelve el caso "2 unidades en el mismo pedido, envasadas por separado" ni "1 envase con 4 hamburguesas".
  - No registra impresión, reimpresión, ni qué usuario hizo qué.
  - No tiene plantillas por tipo de producto: todos los productos usan los mismos 6 campos de `products`.
  - No tiene los datos identificativos del operador alimentario (nombre legal, NIF, domicilio) en ningún sitio consultable por la aplicación — solo existen como texto fijo en `content/legal/aviso-legal.md`. El número de registro sanitario (RGSEAA) y la posible marca de identificación/nº de autorización del establecimiento tampoco aparecen en ningún sitio, pero **no son un requisito automático de toda etiqueta** — son datos administrativos que se configuran una vez y solo se muestran cuando el perfil de etiquetado (`label_profiles`) de un tipo de producto concreto lo exija (ver §6, §17).

Este informe parte de esa base — **no la descarta, la extiende** — porque el modelo de `products`/`product_labels` ya cubre gran parte del contenido legal (ingredientes, alérgenos, conservación, preparación) y el trigger de pre-relleno es el patrón correcto.

---

## 2. Datos existentes que pueden reutilizarse

| Dato | Dónde vive hoy | Reutilizable tal cual |
|---|---|---|
| Nombre del producto | `products.name` | Sí |
| Ingredientes | `products.ingredients` | Sí, como plantilla de partida |
| Alérgenos (lista) | `products.allergens` (`TEXT[]`) + `order_items.allergens_snapshot` | Sí — **ya existe snapshot por línea de pedido**, es el único campo legal que ya se congela hoy |
| Notas de alérgenos | `products.allergens_notes` + `order_items.allergens_notes_snapshot` | Sí, mismo caso |
| Condiciones de conservación | `products.storage_conditions` | Sí, como plantilla |
| Instrucciones de preparación/uso | `products.prep_instructions` | Sí, como plantilla |
| Modo de cocinado | `products.cooking_method` | Sí, como plantilla |
| Nombre comercial del envase/formato | `product_variants.name` (p. ej. "1kg", "Pack 4 uds.") + `order_items.variant_name_snapshot` | Sí, aunque es texto libre, no estructurado (ver §3) |
| Cantidad vendida (unidades internas) | `order_items.quantity` | Sí, pero **no equivale al número de etiquetas** (ver §8) |
| Datos del pedido (nº, fecha) | `orders.order_number`, `orders.created_at` | Sí, para trazabilidad — nunca para el contenido "alimentario" de la etiqueta |
| Regalos de promoción | `order_items.item_type = 'GIFT'`, `order_items.promotion_id` | Sí — un regalo referencia una variante real (`promotions.gift_variant_id`), así que tiene producto, ingredientes y alérgenos como cualquier línea normal. El precio (0€) es irrelevante para la etiqueta |
| Borrador de etiqueta y trigger de pre-relleno | `product_labels` + `suggest_product_label_fields()` | Sí, como punto de partida del modelo (ver §6) |
| Patrón de auditoría por eventos | `order_status_history` (event_type + metadata JSONB) | Sí, como referencia de estilo para el histórico de impresión (aunque se propone tabla dedicada, ver §11) |
| Datos identificativos del operador (nombre legal, NIF, domicilio) | `content/legal/aviso-legal.md` (texto Markdown estático) | Parcialmente — están correctos pero **no son datos consultables por la aplicación**; hay que estructurarlos (ver §3 y §6) |

**Lo que NO existe hoy y hay que decidir dónde vive:**
- Número de registro sanitario (RGSEAA) y/o marca de identificación del operador — no aparecen en ningún sitio; hay que darles un lugar de configuración aunque su uso en la etiqueta sea condicional (ver §17).
- País/lugar de origen del alimento — no hay campo en `products` ni `product_variants`.
- Cualquier noción de "cuántos envases produce esta línea" — no existe.
- Un nombre operativo por sesión para registrar quién preparó/imprimió — hoy el login es una única contraseña compartida, sin ningún campo de nombre asociado (ver §17 — esto no crea usuarios ni roles nuevos, solo una etiqueta de texto sobre la misma sesión compartida).

---

## 3. Problemas o carencias detectadas

1. **Unidad de venta ≠ unidad de etiquetado.** `order_items.quantity` cuenta unidades de venta, pero el Reglamento exige una etiqueta por envase físico. Un pack de 4 hamburguesas es `quantity = 1` pero es un único envase; dos chuletones sueltos son `quantity = 2` y pueden ser 1 o 2 envases según cómo se empaquete ese día. Hoy no hay ningún campo que capture esa decisión.
2. **Sin snapshot completo de los datos legales en la línea de pedido.** Solo `allergens_snapshot`/`allergens_notes_snapshot` se congelan al crear el pedido. Ingredientes, conservación, preparación y modo de cocinado se leerían **en vivo** desde `products` si se generase la etiqueta hoy — si el producto cambia de receta después del pedido, un pedido antiguo mostraría datos incorrectos.
3. **Sin plantillas por tipo de producto.** Todos los productos comparten los mismos 6 campos de plantilla. Un lote promocional, un producto congelado o un pack no tienen forma de declarar reglas distintas (campos obligatorios, textos fijos, necesidad de lote/origen) sin tocar código.
4. **Sin registro de impresión/reimpresión ni de usuario.** `product_labels` no tiene `printed_at`, `printed_by` ni historial. No se puede responder "¿quién imprimió esto y cuándo?" ni distinguir una reimpresión de la etiqueta original.
5. **Sin estado del pedido a nivel de etiquetado.** `orders.status` no tiene ningún valor para "etiquetado"/"preparado" que no choque con la máquina de estados de pago existente (`PENDING_PAYMENT → PAID → PREPARING → CANCELLED`, `src/lib/admin/order-status.ts`). Hace falta una señal independiente.
6. **Sin nombre operativo por sesión.** El acceso admin es una única contraseña compartida (`ADMIN_PASSWORD`) y seguirá siéndolo — no se van a crear cuentas ni roles nuevos. Falta únicamente un campo de nombre libre en el login para poder anotar quién preparó/imprimió cada etiqueta dentro de esa misma sesión compartida (ver §17).
7. **Sin datos del operador alimentario estructurados.** El nombre legal, NIF y domicilio existen como texto en el aviso legal, no como datos consultables por la aplicación. El número de registro sanitario (RGSEAA) y la marca de identificación tampoco están estructurados en ningún sitio — esto no bloquea el desarrollo, porque son datos condicionales (solo se exigen si el tipo de producto lo requiere, ver §17), pero sí hay que darles un lugar de configuración.
8. **Sin país de origen ni en `products` ni en `product_variants`.** Relevante sobre todo para carne de vacuno (Reglamento (UE) 1337/2013 exige indicar nacimiento/cría/sacrificio para vacuno, entre otras normas).
9. **Ningún componente de impresión existe todavía.** No hay hoja de estilos de impresión, ni ruta dedicada, ni componente "vista de impresión" en todo el repositorio.

---

## 4. Flujo recomendado para los trabajadores

Se mantiene la estructura de 10 pasos propuesta por el usuario, con ajustes concretos marcados en **negrita**:

1. El trabajador abre `/admin/pedidos/[id]` de un pedido `PAID` o `PREPARING`.
2. Pulsa **"Preparar y etiquetar"** — un botón nuevo junto a `OrderStatusControl`, que lleva a `/admin/pedidos/[id]/etiquetar`.
3. La pantalla muestra una lista de líneas del pedido (excluyendo nada — los regalos también se etiquetan, ver §14).
4. **Cada línea muestra un número de envases sugerido** (precalculado a partir de `quantity × default_package_count` de la variante, ver §8), editable antes de generar las etiquetas.
5. Al confirmar el número de envases de una línea, el sistema crea N registros de etiqueta (uno por envase) **pre-rellenados** con el snapshot legal de esa línea (ingredientes, alérgenos, conservación, preparación, origen si aplica) — sin que el trabajador teclee nada de eso.
6. El trabajador completa **solo los datos variables de esa preparación concreta**: peso real, lote (sugerido, editable), fecha de elaboración, fecha de caducidad/consumo preferente (siempre manual).
7. Puede previsualizar cualquier etiqueta individual antes de imprimir.
8. Puede imprimir una etiqueta suelta o "Imprimir todas las pendientes" de la línea o del pedido completo.
9. Cada impresión (o reimpresión) queda registrada con usuario, fecha/hora y el contenido exacto impreso.
10. Cuando todas las etiquetas necesarias están impresas, el trabajador pulsa **"Marcar pedido como preparado"** — una confirmación explícita, no automática, que no cambia `orders.status` (que sigue gobernado por el flujo de pago/envío) sino que registra `orders.labeled_at`/`labeled_by` y un evento en `order_status_history`.

**Mejora sobre el flujo original:** el paso 4 (número de envases editable con valor sugerido) es la pieza que faltaba en el flujo del usuario — sin ella, los casos "2 unidades juntas" vs "2 unidades separadas" no tendrían dónde resolverse.

---

## 5. Propuesta de interfaz

### 5.1 Botón "Preparar y etiquetar" (en `/admin/pedidos/[id]`)

Se añade junto a `OrderStatusControl`, visible solo si `order.status` es `PAID` o `PREPARING`. Qué ve el trabajador: un botón destacado con contador ("3 líneas · 0 de 5 envases etiquetados"). Qué hace: navega a la pantalla de preparación. No requiere ninguna acción adicional del trabajador aquí.

### 5.2 Pantalla "Preparar y etiquetar" (`/admin/pedidos/[id]/etiquetar`)

Qué ve:
- Cabecera con número de pedido y un resumen de progreso ("2 de 3 líneas completas").
- Una tarjeta por línea de pedido (incluidos regalos, marcados igual que hoy con el badge "REGALO PROMO"), cada una mostrando:
  - Nombre de producto + variante + cantidad vendida (dato ya conocido, de solo lectura).
  - Estado de la línea: `Sin empezar` / `En curso` / `Completa` (derivado de los estados de sus etiquetas).
  - Selector numérico "Envases a preparar" con el valor sugerido ya relleno.
  - Un aviso si el producto no tiene todos los campos legales configurados (ver §10), con el botón de generar etiquetas desactivado hasta resolverlo o hasta que el trabajador confirme que continúa bajo su responsabilidad si el dato es opcional.
  - Botón **"Generar N etiquetas"** (la primera vez) o la lista de etiquetas ya generadas para esa línea (las siguientes veces).

Qué hace el trabajador: revisa las líneas, ajusta el número de envases donde corresponda, pulsa generar.

### 5.3 Lista de envases/etiquetas de una línea

Qué ve, por cada envase generado: "Envase 1 de 2" con badge de estado (`Pendiente` / `Lista` / `Impresa` / `Reimpresa` / `Anulada`), un resumen de sus datos (lote, peso, fechas) y tres acciones: `Editar`, `Vista previa`, `Imprimir`.

### 5.4 Formulario de datos variables (por etiqueta)

Qué ve: un formulario corto — nunca los 6+ campos legales completos, que ya vienen resueltos — con únicamente:
- Peso real (g), con el peso estimado/vendido mostrado al lado como referencia ("vendido: aprox. 1000 g").
- Lote (sugerido con el mismo patrón `L{YYMMDD}-{slug}` del trigger actual, editable).
- Fecha de elaboración (selector, por defecto hoy).
- Fecha de caducidad/consumo preferente (selector, **nunca calculado automáticamente** — obligatorio antes de poder imprimir).
- Unidades dentro de este envase (solo si la línea tiene más de 1 unidad y se están repartiendo entre varios envases — ver §8).
- Campo de notas cortas opcional (p. ej. "Envasado al vacío").

Qué hace el trabajador: rellena estos campos y pulsa "Guardar" (pasa a estado `Lista`) o "Guardar e imprimir".

### 5.5 Previsualización de etiqueta

Modal o panel lateral que renderiza el **mismo componente** que se usará para imprimir (ver §12), a tamaño real o escalado, para que el trabajador vea exactamente lo que saldrá por la impresora antes de gastar una etiqueta física.

### 5.6 Impresión

- Botón **"Imprimir"** en una etiqueta individual: abre la vista de impresión de esa etiqueta y lanza `window.print()`.
- Botón **"Imprimir todas las pendientes"** (por línea o por pedido completo): genera una vista de impresión con una página por etiqueta pendiente/lista, en el orden de las líneas.
- Tras imprimir (evento `afterprint` del navegador, ver §12), el sistema pregunta "¿Se ha impreso correctamente?" — al confirmar, pasa la(s) etiqueta(s) a `Impresa` y registra el evento. Esto evita marcar como impresas etiquetas que el trabajador canceló en el diálogo de impresión del navegador.

### 5.7 Reimpresión

Sobre una etiqueta ya `Impresa`, el botón cambia a **"Reimprimir"**. Pide un motivo corto opcional (p. ej. "etiqueta dañada") y genera un nuevo evento de impresión marcado `is_reprint = true`, sin tocar el evento original. El estado de la etiqueta pasa a `Reimpresa` pero conserva todo su histórico.

### 5.8 Historial de impresiones

Sección plegable en la propia etiqueta o vista agregada en el pedido: tabla con fecha/hora, usuario, tipo (original/reimpresión) y un enlace para ver el contenido exacto impreso en ese momento (el snapshot congelado, ver §11).

### 5.9 Avisos por datos incompletos

Banner (mismo componente visual que `IncidentBanner`, o uno hermano) que lista, por producto: qué campo falta, si falta en la configuración del producto (requiere ir a Supabase Studio / futura pantalla de productos) o si lo debe completar el trabajador ahora mismo, y si eso bloquea la impresión o es solo un aviso.

### 5.10 Confirmación "Marcar pedido como preparado"

Modal de confirmación que solo se activa si todas las etiquetas generadas están en `Impresa`/`Reimpresa` (o el trabajador confirma explícitamente que continúa con pendientes, dejando constancia). Al confirmar, se registra `labeled_at`, `labeled_by` y se añade un evento al histórico del pedido, visible en `OrderTimeline`.

---

## 6. Propuesta de modelo de datos

Principio general: **extender lo que ya existe** (`product_labels`, `order_items`, `shop_settings`) en vez de crear una arquitectura paralela, y añadir solo dos tablas nuevas realmente necesarias: `label_profiles` (plantillas) y `label_print_events` (histórico inmutable de impresión).

### 6.1 `shop_settings` — datos del operador alimentario

Hoy no existen en ningún sitio consultable. Al ser un singleton, es el sitio natural (evita crear una tabla de una sola fila):

```sql
-- orientativo — no ejecutar
ALTER TABLE shop_settings
  ADD COLUMN operator_legal_name             TEXT,   -- "EL BUEY MADURADO, S.L."
  ADD COLUMN operator_tax_id                 TEXT,   -- "B-24770836"
  ADD COLUMN operator_address                TEXT,   -- "C/ La Reina, 41, 46800 Xàtiva (València)"
  ADD COLUMN operator_health_registry_code   TEXT,   -- nº RGSEAA — identificador administrativo, no obligatorio en toda etiqueta (ver §17)
  ADD COLUMN operator_identification_mark    TEXT,   -- marca de identificación / nº de autorización del establecimiento (p. ej. formato "ES XX.XXXXX/V CE"), si aplica
  ADD COLUMN operator_country                TEXT NOT NULL DEFAULT 'ES';
```

`operator_health_registry_code` y `operator_identification_mark` son **configurables pero condicionales**: se rellenan una vez (si aplican) y cada `label_profiles` decide si un tipo de producto concreto debe mostrarlos en su etiqueta (`requires_health_mark`, ver §6.5) — no se imprimen por defecto en todas las etiquetas. Sigue pendiente confirmar con el responsable de APPCC/asesor sanitario si algún producto los necesita y, en ese caso, obtener el dato y el texto exactos (ver §17).

### 6.2 `products` — referencia a la plantilla de etiquetado + origen

```sql
-- orientativo — no ejecutar
ALTER TABLE products
  ADD COLUMN label_profile_id    UUID REFERENCES label_profiles(id),
  ADD COLUMN country_of_origin   TEXT;   -- NULL = no aplica / no declarado
```

### 6.3 `product_variants` — cuántos envases produce por defecto

```sql
-- orientativo — no ejecutar
ALTER TABLE product_variants
  ADD COLUMN default_package_count INT NOT NULL DEFAULT 1,  -- p.ej. 1 para "1kg", 1 para "Pack 4 uds." (el pack ES un envase)
  ADD COLUMN net_weight_grams      INT;                      -- peso neto declarado, si aplica (referencia, no legal)
```

### 6.4 `order_items` — snapshot legal completo (hoy solo existe para alérgenos)

```sql
-- orientativo — no ejecutar
ALTER TABLE order_items
  ADD COLUMN ingredients_snapshot          TEXT,
  ADD COLUMN storage_conditions_snapshot   TEXT,
  ADD COLUMN prep_instructions_snapshot    TEXT,
  ADD COLUMN cooking_method_snapshot       TEXT,
  ADD COLUMN country_of_origin_snapshot    TEXT,
  ADD COLUMN default_package_count_snapshot INT,
  ADD COLUMN label_profile_snapshot        JSONB;  -- copia congelada de la plantilla completa (ver §7)
```

Se rellenan en el mismo punto donde hoy se rellena `allergens_snapshot` (creación del pedido, antes de pagar), no en el pago ni en la preparación.

### 6.5 `label_profiles` — plantillas por tipo de producto (tabla nueva)

```sql
-- orientativo — no ejecutar
CREATE TABLE label_profiles (
  id                     UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  key                    TEXT        UNIQUE NOT NULL,   -- "carne_fresca", "preparado_carnico", "congelado", "pack_promocional"...
  name                   TEXT        NOT NULL,          -- nombre legible: "Carne fresca/madurada"
  required_fields        TEXT[]      NOT NULL DEFAULT '{}',  -- p.ej. {'lote','peso_real','fecha_caducidad','origen'}
  optional_fields        TEXT[]      NOT NULL DEFAULT '{}',
  fixed_texts            JSONB,      -- textos fijos que siempre aparecen igual, p.ej. {"nota": "Ultracongelado en origen"}
  field_order            TEXT[]      NOT NULL DEFAULT '{}',   -- orden de aparición en la etiqueta
  date_format             TEXT       NOT NULL DEFAULT 'DD/MM/YYYY',
  requires_lot           BOOLEAN     NOT NULL DEFAULT true,
  requires_origin        BOOLEAN     NOT NULL DEFAULT false,
  requires_weight        BOOLEAN     NOT NULL DEFAULT true,
  requires_health_mark   BOOLEAN     NOT NULL DEFAULT false, -- si este tipo de producto debe mostrar RGSEAA/marca de identificación (por defecto NO — se activa solo si APPCC lo confirma para ese perfil, ver §17)
  template_key           TEXT        NOT NULL DEFAULT 'default', -- qué componente visual React renderiza esta etiqueta
  page_width_mm          INT         NOT NULL DEFAULT 100,
  page_height_mm         INT         NOT NULL DEFAULT 70,
  is_active              BOOLEAN     NOT NULL DEFAULT true,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

En la primera fase se gestiona desde Supabase Studio (igual que hoy se gestionan `ingredients`/`allergens` de `products`, ver `docs/tienda-online-mvp.md` sección 11 bis) — no hace falta una pantalla admin dedicada para crear plantillas hasta que haya más de 4-5 perfiles reales.

### 6.6 `product_labels` — extender la tabla existente (envase preparado = etiqueta)

Se mantiene el nombre y las columnas actuales (compatibilidad con lo ya diseñado) y se añade lo que falta:

```sql
-- orientativo — no ejecutar
ALTER TABLE product_labels
  ADD COLUMN label_profile_id       UUID REFERENCES label_profiles(id),
  ADD COLUMN variant_name           TEXT,             -- snapshot autocontenido, no requiere JOIN
  ADD COLUMN package_sequence       INT NOT NULL DEFAULT 1,   -- "envase 1 de N"
  ADD COLUMN package_count_for_line INT NOT NULL DEFAULT 1,   -- N total de esa línea, congelado en el momento de generar
  ADD COLUMN units_in_package       INT NOT NULL DEFAULT 1,   -- cuántas unidades de venta contiene ESTE envase
  ADD COLUMN estimated_weight_grams INT,               -- peso vendido/estimado, solo referencia
  ADD COLUMN country_of_origin     TEXT,
  ADD COLUMN status                TEXT NOT NULL DEFAULT 'PENDING'
             CHECK (status IN ('PENDING','READY','PRINTED','REPRINTED','CANCELLED')),
  ADD COLUMN cancelled_at          TIMESTAMPTZ,
  ADD COLUMN cancelled_reason      TEXT,
  ADD COLUMN created_by            TEXT,               -- identidad del trabajador (ver §17)
  ADD COLUMN updated_by            TEXT,
  ADD COLUMN updated_at            TIMESTAMPTZ NOT NULL DEFAULT now();
```

`weight_grams` (ya existente) pasa a significar de forma explícita **"peso real de este envase"**; `estimated_weight_grams` es el valor de referencia con el que se vendió/estimó. `expiry_date` sigue siendo siempre manual (comportamiento ya correcto, no se toca).

### 6.7 `label_print_events` — histórico inmutable de impresión (tabla nueva)

```sql
-- orientativo — no ejecutar
CREATE TABLE label_print_events (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  product_label_id UUID        NOT NULL REFERENCES product_labels(id),
  is_reprint       BOOLEAN     NOT NULL DEFAULT false,
  reprint_reason   TEXT,
  printed_by       TEXT        NOT NULL,   -- identidad del trabajador (ver §17)
  page_width_mm    INT         NOT NULL,
  page_height_mm   INT         NOT NULL,
  label_snapshot   JSONB       NOT NULL,   -- contenido exacto impreso: todos los campos, ya resueltos, en texto plano
  printed_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX ON label_print_events(product_label_id, printed_at);
```

Solo `INSERT`, nunca `UPDATE`/`DELETE` desde la aplicación — es el registro legal de "qué se imprimió, cuándo y por quién" (ver §11).

### 6.8 `orders` — marca de preparación/etiquetado

```sql
-- orientativo — no ejecutar
ALTER TABLE orders
  ADD COLUMN labeled_at TIMESTAMPTZ,
  ADD COLUMN labeled_by TEXT;
```

Se registra también un evento `PEDIDO_ETIQUETADO` en `order_status_history` (reutilizando el patrón existente de `event_type` + `metadata JSONB`), en vez de añadir un valor nuevo a `orders.status` — así no se toca la máquina de estados de pago/cancelación ya auditada y probada en `src/lib/admin/order-status.ts`.

### 6.9 Por qué no se crean más tablas

- **No hace falta una tabla "envases preparados" separada de "etiquetas generadas":** en este dominio, un envase físico *es* una etiqueta — una fila de `product_labels` ya representa ambas cosas a la vez. Separarlas duplicaría datos sin ganar trazabilidad.
- **No hace falta una tabla de "plantillas visuales" separada de `label_profiles`:** el tamaño físico y el `template_key` son atributos del perfil, no una entidad propia — solo se separarían si un mismo perfil de contenido necesitase varios tamaños físicos intercambiables, que no es el caso descrito.
- **La duplicación de `package_count_for_line` y de los campos `*_snapshot`/`label_snapshot` es intencionada**, justificada por trazabilidad histórica inmutable (ver §7), no por comodidad de consulta.

---

## 7. Diferencia entre datos maestros, snapshot del pedido y datos de preparación

| Capa | Dónde vive | Cuándo se fija | Ejemplo | Quién lo edita |
|---|---|---|---|---|
| **Datos maestros** | `products`, `product_variants`, `label_profiles`, `shop_settings` | En cualquier momento, vía Supabase Studio (o futura pantalla de productos) | Ingredientes de "Chuletón de Vaca Madurada" | Responsable de catálogo/APPCC |
| **Snapshot del pedido** | `order_items.*_snapshot` | Al crear el pedido (antes de pagar), igual que ya ocurre hoy con `allergens_snapshot` | Ingredientes que tenía el chuletón *en el momento de esta compra* | Nadie — se copia automáticamente, es de solo lectura para siempre |
| **Datos de preparación** | `product_labels` (columnas variables: peso real, lote, fechas, notas) | Al preparar físicamente el pedido, puede ser días después de pagarlo | Peso real de este chuletón concreto: 987 g | El trabajador que prepara el pedido |
| **Datos finalmente impresos** | `label_print_events.label_snapshot` | En el instante exacto de cada impresión (incluida cada reimpresión) | Copia literal de todo lo anterior tal y como salió por la impresora esa vez | Nadie — inmutable, un evento por impresión |

Esto responde directamente al caso "pedidos antiguos cuya información de producto ha cambiado después de la compra" (§14): la etiqueta de un pedido de hace 3 meses debe generarse a partir de `order_items.*_snapshot`, nunca de `products` en vivo. Si un pedido se preparó antes de que existiera este sistema (o antes de esta migración), el snapshot puede ser `NULL` — la UI debe entonces recurrir a los datos actuales de `products` y **marcar visualmente que es un dato "no congelado, puede haber cambiado"**, en vez de fallar en silencio.

---

## 8. Gestión de envases y número de etiquetas

Regla general: **la unidad que determina el número de etiquetas es la decisión operativa de empaquetado del trabajador ese día, con un valor sugerido por defecto.**

- **Valor sugerido por línea** = `quantity × default_package_count` de la variante (§6.3). Para "Chuletón 1kg" (`default_package_count = 1`) con `quantity = 2` → sugiere 2 envases. Para "Pack 4 hamburguesas" (`default_package_count = 1`, porque el pack completo YA es un envase) con `quantity = 1` → sugiere 1 envase.
- **Dos unidades envasadas juntas:** el trabajador reduce el número de envases sugerido de 2 a 1, y en el formulario de esa etiqueta indica `units_in_package = 2`. La etiqueta debe reflejar el peso conjunto real, no el de una unidad.
- **Dos unidades envasadas por separado:** se deja el valor sugerido (2 envases), cada uno con `units_in_package = 1` y su propio peso real.
- **Pack compuesto por varios productos servidos como una sola unidad de venta** (p. ej. una parrillada mixta): debe modelarse en el catálogo como **un único producto** con sus propios `ingredients`/`allergens` ya consolidados — el sistema de etiquetado no soporta (ni debería, para no complicar el modelo) fusionar varias líneas de pedido distintas en una sola etiqueta. Si hoy existe algún pack que se vende como varias líneas separadas en el carrito pero se entrega en un único envase físico, es una decisión de catálogo a corregir antes de lanzar esta función (ver §17), no un problema que resuelva el modelo de datos.
- **Regalo promocional:** se trata exactamente igual que cualquier línea — tiene `product_variant_id`, por tanto tiene producto, ingredientes y alérgenos. El precio (0€) no afecta en nada al contenido de la etiqueta.
- **Reimpresión por etiqueta dañada:** no se generan más envases ni se cambia `package_count_for_line` — se reimprime la misma fila de `product_labels`, generando un nuevo `label_print_events` con `is_reprint = true`.
- **Cambio de lote o fecha antes de imprimir:** libre mientras la etiqueta esté en `PENDING`/`READY`. Una vez `PRINTED`, cualquier edición debe registrarse (ver §11) y el siguiente evento de impresión será automáticamente una reimpresión con el nuevo contenido.
- **Impresión parcial del pedido:** cada etiqueta tiene su propio estado; "Marcar como preparado" no exige que todo esté impreso, solo pide confirmación explícita si quedan pendientes (§5.10). El trabajador puede volver más tarde a imprimir el resto.

---

## 9. Sistema de plantillas por tipo de producto

`label_profiles` (§6.5) permite crear perfiles como:

| Perfil (`key`) | `required_fields` típicos | `requires_origin` | Notas |
|---|---|---|---|
| `carne_fresca_madurada` | lote, peso_real, fecha_elaboracion, fecha_caducidad, origen | true | Vacuno: reglas de origen específicas (nacimiento/cría/sacrificio) |
| `preparado_carnico` (hamburguesas, etc.) | lote, peso_real, fecha_caducidad, ingredientes, alérgenos | false | Suele llevar más ingredientes añadidos (pan rallado, especias) |
| `congelado` | lote, fecha_caducidad, texto fijo "Ultracongelado — no recongelar" | depende | `fixed_texts` cubre el aviso obligatorio de congelación |
| `elaborado` (croquetas, etc.) | lote, fecha_caducidad, ingredientes, modo de cocinado | false | |
| `pack_o_lote` | lote, fecha_caducidad, composición | variable | Ver limitación de §8 sobre packs multi-producto |
| `promocional` | mismos campos que el producto real que regala | false | No lleva ninguna mención de "regalo" ni precio — la etiqueta es idéntica a la del producto normal |

Crear un producto nuevo es: darlo de alta en `products`, asignarle un `label_profile_id` existente (o crear uno nuevo en Supabase Studio si el tipo es realmente distinto) y rellenar los campos de plantilla — **sin tocar código**. Esto cumple el requisito de escalabilidad sin necesitar una pantalla de administración de perfiles en la primera fase.

---

## 10. Validaciones

Función de validación (`getLabelValidationIssues(profile, productSnapshot, labelDraft)`) que se ejecuta antes de permitir "Generar etiquetas" y antes de "Imprimir", devolviendo una lista de incidencias con esta forma:

```ts
type LabelValidationIssue = {
  field: string;                       // "ingredients" | "expiry_date" | "operator_health_registry_code" | ...
  source: 'product_config' | 'preparation' | 'operator_config';
  message: string;                     // texto humano para el trabajador
  blocksPrinting: boolean;
};
```

Reglas orientativas (**a validar por el responsable de seguridad alimentaria/APPCC antes de fijarlas como obligatorias reales** — el sistema no debe asumir por su cuenta qué es legalmente obligatorio para cada tipo de alimento):

- Si `label_profiles.required_fields` incluye `ingredients`/`allergens`/`storage_conditions`/etc. y el snapshot de la línea los tiene vacíos → incidencia `source: 'product_config'`, bloqueante, con mensaje tipo "Falta configurar ingredientes en el producto — no se puede generar la etiqueta hasta corregirlo en el catálogo".
- Si falta `expiry_date`, `weight_grams` (cuando `requires_weight`) o `lote` (cuando `requires_lot`) en una etiqueta concreta → incidencia `source: 'preparation'`, bloqueante solo para el botón "Imprimir" de esa etiqueta (no bloquea generar el borrador).
- Si el perfil de la línea tiene `requires_health_mark = true` y falta `operator_health_registry_code`/`operator_identification_mark` en `shop_settings` → incidencia `source: 'operator_config'`, bloqueante **solo para las líneas cuyo perfil lo exige**, con mensaje dirigido al administrador (no al trabajador de preparación). Si `requires_health_mark = false` (valor por defecto), no se pide ni se muestra nada — no es un requisito general de toda etiqueta.
- El pedido puede continuar su ciclo de vida normal (cambiar de estado, enviarse, cobrarse) aunque el etiquetado esté incompleto — el etiquetado nunca bloquea el flujo de pedidos, solo la propia impresión.

La interfaz debe mostrar estas incidencias agrupadas por línea, con icono distinto según si el trabajador puede resolverlo ahí mismo o si requiere ir al catálogo.

---

## 11. Trazabilidad e histórico

Con el modelo de §6, se puede responder a cada pregunta planteada:

| Pregunta | Cómo se responde |
|---|---|
| ¿Qué información se imprimió? | `label_print_events.label_snapshot` (JSONB completo, texto ya resuelto) |
| ¿Para qué pedido? | `product_labels.order_item_id → order_items.order_id` |
| ¿Para qué línea de pedido? | `product_labels.order_item_id` |
| ¿Cuántos envases se generaron? | `product_labels.package_count_for_line` (o `COUNT(*) GROUP BY order_item_id`) |
| ¿Qué lote y fechas se usaron? | `product_labels.lote`, `elaboration_date`, `expiry_date` en el momento de cada impresión, congelados también dentro de `label_print_events.label_snapshot` |
| ¿Cuándo se imprimió? | `label_print_events.printed_at` |
| ¿Original o reimpresión? | `label_print_events.is_reprint` |
| ¿Qué usuario lo hizo? | `label_print_events.printed_by` / `product_labels.created_by`/`updated_by` — el nombre operativo introducido en la sesión compartida de administrador (§17), no una cuenta individual |

Reglas de inmutabilidad:
- `label_print_events` es **solo `INSERT`** desde la aplicación (sin `UPDATE`/`DELETE` expuestos por ningún endpoint).
- Editar una etiqueta ya impresa (cambio de lote/peso/fecha) no borra el evento de impresión anterior — genera un nuevo evento en la siguiente impresión, con `is_reprint = true` automáticamente si `status` ya era `PRINTED`/`REPRINTED`.
- La retención de 6 meses vía `pg_cron` (ya implementada en `0003_product_labels.sql`, reprogramada diaria en `0007_post_review_fixes.sql`) debe extenderse para borrar también los `label_print_events` asociados al borrar `product_labels` (`ON DELETE CASCADE` o borrado explícito en el mismo job), para no dejar huérfanos.

---

## 12. Estrategia de impresión con `window.print()`

### Diseño técnico

- Ruta dedicada de solo impresión, p. ej. `/admin/pedidos/[id]/etiquetas/imprimir?ids=a,b,c`, con su propio `layout.tsx` **sin** `AdminHeader` ni navegación — nada que no sea la etiqueta.
- Hoja de estilos de impresión con `@page { size: var(--label-w) var(--label-h); margin: 0; }` y `@media print { body { margin: 0 } .no-print { display: none } }`. El tamaño (`page_width_mm`/`page_height_mm` del perfil) se inyecta como variables CSS inline por etiqueta, permitiendo mezclar tamaños distintos en una misma tanda de impresión si dos perfiles usan tamaños diferentes.
- Un `div.label-page` por etiqueta, con `page-break-after: always` (o `break-after: page` moderno) para que cada envase salga en su propia página física — así "imprimir todas las pendientes" genera una página por etiqueta sin trabajo adicional del navegador.
- La misma plantilla React (`template_key` del perfil, p. ej. `<DefaultLabelTemplate />`, `<CarneFrescaLabelTemplate />`) se usa tanto en la previsualización (§5.5) como en la vista de impresión real — un único componente, sin duplicar marcado entre "lo que se ve" y "lo que se imprime".
- Configuración del tamaño: 100×70 mm confirmado como formato real de la etiqueta principal de la impresora instalada (Térmica TSC DA210), fijado como valor por defecto en `label_profiles.page_width_mm/page_height_mm` y editable por perfil desde Supabase Studio sin tocar código ni CSS si en el futuro se usa otro formato de etiqueta en la misma impresora.
- Tras `window.print()`, se escucha el evento `afterprint` para disparar la pregunta de confirmación de §5.6 (marcar como `PRINTED` + registrar `label_print_events`) — nunca se marca como impresa una etiqueta solo por abrir el diálogo, porque el usuario puede cancelarlo.

### Limitaciones conocidas de `window.print()` (a comunicar al negocio)

- El navegador **siempre** muestra su propio diálogo de impresión — no hay forma de imprimir en silencio desde JavaScript puro, por diseño de seguridad de los navegadores.
- El trabajador debe seleccionar manualmente la impresora de etiquetas (aunque Windows recuerda la última usada por sitio/aplicación, y se puede fijar como predeterminada del sistema para minimizar fricción) y confirmar "sin márgenes"/"tamaño real 100%" — configurable una vez en las preferencias de la impresora de Windows, no en cada impresión.
- Distintos navegadores (Chrome/Edge/Firefox) tratan `@page size` con matices distintos; conviene fijar y documentar un único navegador soportado para el PC de preparación.
- No hay confirmación fiable de que la impresión fue exitosa (atasco de papel, sin cinta, etc.) — de ahí la pregunta explícita de confirmación tras `afterprint`, que traslada esa responsabilidad al trabajador en vez de asumir éxito.

### Evoluciones futuras (mencionadas, no implementadas ahora)

- **QZ Tray** o **PrintNode**: permiten impresión silenciosa/directa a una impresora concreta sin diálogo del navegador, a cambio de instalar software adicional en el PC.
- Un pequeño agente local (servicio Windows) que reciba el JSON de la etiqueta y la envíe directamente al driver de la impresora usando el SDK del fabricante (típico en impresoras Zebra/TSC de etiquetas).
- Generación de ZPL/EPL directamente si la impresora lo soporta, evitando el HTML/CSS por completo.

Ninguna de estas tres se implementa en esta fase, tal y como pide el encargo.

---

## 13. Seguridad y RLS

El patrón de seguridad de esta app **no usa roles de Supabase Auth** — usa una cookie JWT propia verificada en cada Server Component y en cada API Route (`isAdminAuthenticated()`), con Supabase accedido siempre vía `supabaseAdmin` (`service_role`, que **bypassa RLS** por diseño de Supabase). RLS aquí es defensa en profundidad contra el rol `anon`, no el mecanismo de autorización principal — hay que mantener esa misma coherencia para las tablas nuevas, no inventar un patrón distinto:

```sql
-- orientativo — no ejecutar
ALTER TABLE label_profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE label_print_events  ENABLE ROW LEVEL SECURITY;
-- product_labels ya tiene RLS activado desde 0004_rls_policies.sql, sin política pública.
-- Ninguna política para anon/authenticated en las tres tablas → deny por defecto.
-- service_role las bypassa, igual que ya ocurre con orders/order_items/payments.
```

Puntos de seguridad concretos pedidos por el usuario:

- **Solo quien tiene la contraseña de administrador puede preparar e imprimir:** se cubre reutilizando `isAdminAuthenticated()` en cada endpoint nuevo (`/api/admin/pedidos/[id]/etiquetas`, `/api/admin/etiquetas/[id]`, `/api/admin/etiquetas/[id]/imprimir`), exactamente igual que los endpoints de notas/estado existentes. No hay distinción de roles entre "administrador" y "trabajador" — es un único perfil compartido (§17); el nombre operativo de sesión identifica *quién* actuó, no *qué puede hacer*, que es igual para cualquiera con acceso.
- **Los datos legales del catálogo no se pueden modificar accidentalmente desde el flujo de preparación:** es una regla de **código**, no de RLS (porque `service_role` bypassa RLS igualmente) — los endpoints del flujo de etiquetado deben escribir únicamente en `product_labels`/`label_print_events`/`orders.labeled_at`, nunca en `products`/`product_variants`/`order_items`. Se recomienda mantenerlos en rutas de API separadas de cualquier futuro endpoint de edición de catálogo, para que un error de código no pueda mezclar ambas escrituras en el mismo handler.
- **Queda registrado el usuario y la fecha de cada impresión:** `label_print_events.printed_by` + `printed_at`, siempre poblados por el servidor (nunca confiando en un valor que envíe el cliente sin verificar contra la sesión).
- **Una reimpresión no sobrescribe el histórico anterior:** `label_print_events` es append-only (§11); no hay ningún endpoint que permita `UPDATE`/`DELETE` sobre esa tabla.
- **Los cambios de lote/peso/fecha quedan auditados:** cada `PATCH` sobre una etiqueta debería, como mínimo, actualizar `updated_by`/`updated_at`; si se quiere histórico campo a campo (no solo el snapshot final), se puede añadir opcionalmente una tabla `label_edit_events` con el mismo patrón que `label_print_events` — se deja fuera del alcance inicial por simplicidad, ya que el snapshot de cada impresión ya captura el estado en los momentos que legalmente importan (cuando algo sale impreso).

---

## 14. Casos especiales

| Caso | Resolución propuesta |
|---|---|
| Peso estimado que cambia al preparar | El peso "vendido" queda en `estimated_weight_grams` (snapshot/variante); el trabajador introduce el peso real en `weight_grams` de cada etiqueta. No afecta al precio ya cobrado (fuera de alcance de este informe) |
| 2 unidades envasadas juntas | 1 fila en `product_labels` con `units_in_package = 2`, peso real conjunto |
| 2 unidades envasadas por separado | 2 filas en `product_labels`, `units_in_package = 1` cada una |
| Pack compuesto por varios productos | Debe ser un único producto de catálogo con datos legales ya consolidados; el modelo de etiquetado no fusiona líneas de pedido distintas (ver §8) |
| Regalo promocional | Se etiqueta igual que cualquier línea; el precio 0€ es irrelevante para el contenido de la etiqueta |
| Reimpresión por etiqueta dañada | Nuevo `label_print_events` con `is_reprint = true` sobre la misma fila de `product_labels`, sin generar un envase nuevo |
| Cambio de lote/fecha antes de imprimir | Libre en estado `PENDING`/`READY`; tras `PRINTED` cualquier cambio se audita y la siguiente impresión es automáticamente una reimpresión |
| Impresión parcial del pedido | Cada etiqueta tiene estado independiente; "marcar como preparado" pide confirmación explícita si quedan pendientes, no lo bloquea |
| Productos sin todos los datos legales configurados | Bloqueo de impresión con mensaje dirigido al catálogo, no al trabajador (§10) |
| Pedidos antiguos con producto cambiado después de la compra | Se usa siempre `order_items.*_snapshot`; si es `NULL` (pedidos previos a esta función), la UI debe mostrar un aviso explícito de "dato no congelado, verificar manualmente" en vez de mezclar silenciosamente el dato actual de `products` |

---

## 15. Plan de implementación por fases

**Fase 0 — Decisiones de negocio (bloqueantes, no técnicas).** Ver §17. Sin esto, cualquier implementación quedaría incompleta legalmente.

**Fase 1 — Modelo de datos.** Migraciones de §6: extender `shop_settings`, `products`, `product_variants`, `order_items`, `product_labels`, `orders`; crear `label_profiles` y `label_print_events`; actualizar el trigger `suggest_product_label_fields()` para los nuevos campos; regenerar `src/supabase/types.ts`.

**Fase 2 — Snapshot en la creación del pedido.** Ampliar el punto donde hoy se rellena `allergens_snapshot` (checkout/API de creación de pedido) para poblar también el resto de columnas `*_snapshot` de §6.4.

**Fase 3 — Backend de preparación.** Endpoints: `GET/POST /api/admin/pedidos/[id]/etiquetas` (listar líneas + generar N etiquetas por línea), `PATCH /api/admin/etiquetas/[id]` (editar datos variables), `POST /api/admin/etiquetas/[id]/imprimir` (registra `label_print_events` y cambia `status`), `POST /api/admin/pedidos/[id]/preparado` (marca `labeled_at`/`labeled_by`).

**Fase 4 — UI "Preparar y etiquetar".** Página, componentes de línea/envase, formulario de datos variables, validaciones de §10.

**Fase 5 — Impresión.** Ruta de impresión, CSS de impresión, componente(s) de plantilla visual, previsualización, confirmación post-`afterprint`.

**Fase 6 — Histórico y reimpresión.** UI de historial de impresiones, flujo de reimpresión con motivo.

**Fase 7 — Plantillas reales.** Cargar en Supabase Studio los `label_profiles` reales acordados con el responsable de seguridad alimentaria (§17), y asignarlos a cada producto existente.

**Fase 8 (futuro, no implementar ahora; fuera del alcance decidido en §17).** Integración con QZ Tray/PrintNode/agente local para impresión silenciosa; pantalla de administración visual de `label_profiles`; cuentas individuales de trabajador (`admin_users`) si en algún momento futuro el negocio decide reforzar la identidad más allá del nombre operativo de sesión ya adoptado.

---

## 16. Archivos y componentes que habría que modificar

**Migraciones (nuevas, no modificar las existentes):**
- `supabase/migrations/XXXX_0012_label_profiles.sql`
- `supabase/migrations/XXXX_0013_extend_product_labels.sql`
- `supabase/migrations/XXXX_0014_order_items_label_snapshot.sql`
- `supabase/migrations/XXXX_0015_label_print_events.sql`
- `supabase/migrations/XXXX_0016_shop_settings_operator.sql`
- `supabase/migrations/XXXX_0017_orders_labeled_at.sql`

**Tipos:**
- `src/supabase/types.ts` (regenerar con `supabase gen types`)

**Backend / lib:**
- `src/lib/admin/labels/label-validation.ts` (nuevo — reglas de §10)
- `src/lib/admin/labels/label-package-suggestion.ts` (nuevo — cálculo de envases sugeridos, §8)
- `src/lib/admin/order-status.ts` (posible ajuste si se añade algún evento relacionado, sin tocar las transiciones existentes)
- Ampliar el handler de creación de pedido (donde hoy se escribe `allergens_snapshot`) para poblar el resto del snapshot legal

**API routes (nuevas):**
- `src/app/api/admin/pedidos/[id]/etiquetas/route.ts`
- `src/app/api/admin/etiquetas/[id]/route.ts`
- `src/app/api/admin/etiquetas/[id]/imprimir/route.ts`
- `src/app/api/admin/pedidos/[id]/preparado/route.ts`

**Páginas:**
- `src/app/admin/pedidos/[id]/etiquetar/page.tsx` (nueva)
- `src/app/admin/pedidos/[id]/etiquetas/imprimir/page.tsx` (nueva, layout propio sin `AdminHeader`)

**Componentes (`src/components/Admin/`, nuevos):**
- `PrepararYEtiquetarButton.tsx`
- `LabelLineCard.tsx`
- `LabelPackageList.tsx`
- `LabelVariableForm.tsx`
- `LabelPreview.tsx`
- `LabelPrintTemplateDefault.tsx` (+ variantes por `template_key` según se necesiten)
- `LabelHistoryPanel.tsx`
- `LabelValidationBanner.tsx`
- `MarkOrderLabeledConfirm.tsx`

**Componentes existentes a tocar mínimamente:**
- `src/app/admin/pedidos/[id]/page.tsx` — añadir el botón/resumen de §5.1
- `src/components/Admin/OrderTimeline.tsx` — soportar el nuevo `event_type` `PEDIDO_ETIQUETADO`
- `src/lib/admin/event-labels.ts` — añadir la traducción de ese evento

---

## 17. Riesgos y decisiones pendientes

### Ya resueltas (2026-07-15)

- **RGSEAA / marca de identificación → dato configurable y condicional, no un requisito bloqueante.** El número de registro sanitario (RGSEAA) es un identificador administrativo del operador, no un dato que deba imprimirse obligatoriamente en todas las etiquetas. El modelo (§6.1, §6.5) permite **configurarlo** en `shop_settings` (junto con `operator_identification_mark`, para el número de autorización del establecimiento o marca de identificación de Reglamento 853/2004), pero solo se **muestra y se exige** en una etiqueta cuando el `label_profiles` de ese tipo de producto tiene `requires_health_mark = true` — valor que por defecto es `false` hasta que el responsable APPCC/asesor sanitario confirme que aplica. Esto deja de ser un bloqueante de desarrollo: la estructura ya soporta el dato exista o no, y da igual si acaba aplicando a cero, uno o varios perfiles. Lo único que queda abierto es la pregunta concreta de negocio, recogida en el punto 1 de "Siguen pendientes".
- **Identidad del trabajador → nombre operativo dentro de la misma sesión compartida, no cuentas nuevas.** Seguirá existiendo **un único perfil de administrador** con la contraseña compartida actual (`ADMIN_PASSWORD`) — no se crean cuentas ni roles adicionales, ni un sistema de permisos por usuario. El único cambio es pedir un nombre operativo (texto libre) al iniciar sesión, guardarlo como claim en la cookie/JWT de esa misma sesión (cambio en `src/lib/admin-auth.ts` y el formulario de login) y usarlo únicamente para anotar en `printed_by`/`created_by` quién realizó cada preparación o impresión. No representa una identidad autenticada — cualquiera con la contraseña compartida puede escribir cualquier nombre — y no debe confundirse con un sistema de cuentas: es una etiqueta de texto sobre la sesión única existente, nada más. (Y para evitar cualquier ambigüedad de vocabulario: este "nombre operativo del panel" no tiene relación con `label_profiles` — los perfiles de etiquetado de §6.5/§9 son configuraciones de contenido/formato asociadas a productos, no usuarios ni permisos del panel.) La opción de cuentas individuales (`admin_users`) queda descartada para este alcance y solo se menciona en §15 como posible evolución futura si el negocio decide en otro momento reforzar la auditoría con autenticación real por persona.
- **Packs multi-producto → no existen.** Confirmado que hoy no hay ningún pack que se venda como varias líneas separadas del carrito pero se entregue en un único envase físico; cada pack ya es un producto único en el catálogo. No hace falta ninguna funcionalidad de "agrupar líneas en una etiqueta" — el diseño de §8 (una etiqueta por línea de pedido) es suficiente.
- **Impresora confirmada: TSC DA210 (térmica directa), etiqueta principal 100×70 mm.** Coincide con el valor por defecto ya usado en `label_profiles.page_width_mm`/`page_height_mm` (§6.5, §12), que deja de ser una suposición y pasa a ser el tamaño real. Nota técnica: la DA210 se instala en Windows con un driver GDI (TSC/Seagull) que la expone como una impresora estándar — compatible con `window.print()` sin necesidad de generar ZPL/TSPL a mano. Antes de la Fase 5 hay que crear en el driver de Windows un tamaño de papel personalizado de 100×70 mm (sin márgenes) para que coincida con el `@page size` del CSS de impresión; si no coinciden, el navegador puede escalar o recortar el contenido.

### Siguen pendientes (bloquean la activación legal en producción, no el desarrollo técnico)

1. **Validación APPCC de cada tipo de producto.** El responsable de seguridad alimentaria/APPCC o asesor especializado debe confirmar, por tipo de producto: qué campos son obligatorios (`label_profiles.required_fields`), el tipo de fecha aplicable, la vida útil, las condiciones de conservación, los requisitos de trazabilidad, **y si ese producto necesita mostrar marca sanitaria/de identificación** (`requires_health_mark`) — y en ese caso, obtener el dato y el texto exactos a configurar en `shop_settings`. El sistema aporta la estructura para declarar todo esto sin tocar código; no determina por sí mismo ninguna de estas reglas. No bloquea el desarrollo técnico (Fases 1-6 de §15 pueden avanzar con perfiles provisionales), pero sí bloquea la activación real en producción hasta que se confirme.
2. **Retención de 6 meses.** Ya implementada para `product_labels`; hay que decidir si `label_print_events` debe conservarse más tiempo que la etiqueta que documenta (algunas normativas de trazabilidad piden plazos más largos que la caducidad del producto) — es una decisión legal, no técnica.
3. **Venta por peso real (futuro).** Hoy las variantes tienen precio fijo (`product_variants.price`), no hay venta "a tanto el kilo" con precio variable. Si en el futuro se introduce, el modelo de `estimated_weight_grams`/`weight_grams` de este diseño ya lo soporta sin cambios adicionales, pero el precio del pedido es un tema aparte, fuera de alcance de este informe.

---

## 18. Recomendación final

Extender el modelo ya empezado (`product_labels` + plantilla en `products`) en lugar de sustituirlo: añadir `label_profiles` para escalar por tipo de producto, ampliar `order_items` con el snapshot legal completo que hoy falta, y añadir `label_print_events` como histórico inmutable de impresión — son los tres huecos reales del diseño actual. Tratar cada fila de `product_labels` como "un envase físico = una etiqueta" (con `package_sequence`/`units_in_package`) resuelve de forma simple todos los casos de empaquetado planteados, sin tablas adicionales. Mantener la impresión en `window.print()` con una ruta dedicada sin cabecera de admin y una plantilla React compartida entre previsualización e impresión es suficiente para el volumen de un solo restaurante, con la TSC DA210 y 100×70 mm ya confirmados como formato objetivo, dejando QZ Tray/PrintNode como evolución natural si el volumen crece o se necesita impresión silenciosa. El RGSEAA/marca de identificación quedan resueltos como dato configurable y condicional (`requires_health_mark` por perfil, §6.5, §17) — no bloquean el desarrollo. La identidad del trabajador se resuelve con un nombre operativo dentro del único perfil de administrador compartido que ya existe (sin cuentas ni roles nuevos), y los packs multi-producto y la impresora quedan también cerrados (§17). Lo único que sigue bloqueando la **activación legal en producción** (no el desarrollo técnico) es que el responsable de seguridad alimentaria/APPCC confirme, por tipo de producto, los campos obligatorios, la vida útil, la conservación, la trazabilidad y si aplica marca sanitaria/de identificación — el sistema puede construirse ya con perfiles provisionales y ajustarse sin tocar código en cuanto llegue esa validación.

---

## 19. Estado de la implementación (2026-07-15)

Todo lo descrito en §1-§18 se ha implementado. Esta sección documenta qué se construyó exactamente, las simplificaciones adoptadas durante la implementación (algunas por instrucción explícita, otras por criterio propio para no sobrearquitecturar) y qué sigue pendiente antes de producción.

### 19.1 Migraciones nuevas (no se modificó ninguna migración ya aplicada)

| Archivo | Contenido |
|---|---|
| `supabase/migrations/20260715090000_0012_label_profiles.sql` | Tabla `label_profiles` + 4 perfiles provisionales (`carne_vacuno`, `preparado_carnico`, `elaborado_refrigerado`, `elaborado_congelado`) |
| `supabase/migrations/20260715090100_0013_products_shop_settings_labels.sql` | `products`: `label_profile_id`, `label_display_name`, `country_of_origin`, `usual_units_per_package`, `suggested_package_count`. `shop_settings`: `operator_*`. Backfill de los 10 productos del seed de desarrollo (uno, "Pack Gourmet El Buey", se deja deliberadamente sin perfil asignado como caso de prueba de la validación) |
| `supabase/migrations/20260715090200_0014_order_items_label_snapshot.sql` | Snapshot legal completo en `order_items` (antes solo existía para alérgenos) |
| `supabase/migrations/20260715090300_0015_extend_product_labels.sql` | Extiende `product_labels` (envase = etiqueta, estado, fechas, trazabilidad de vacuno...) y **reemplaza** `suggest_product_label_fields()` para que copie del snapshot congelado de `order_items`, no de `products` en vivo |
| `supabase/migrations/20260715090400_0016_label_print_events.sql` | Tabla `label_print_events` (histórico append-only) + ajuste del job `pg_cron` de retención para que nunca borre una etiqueta con impresiones registradas |
| `supabase/migrations/20260715090500_0017_orders_labeled_at.sql` | `orders.labeled_at` / `orders.labeled_by` |
| `supabase/migrations/20260715090600_0018_label_tables_rls.sql` | RLS en `label_profiles` y `label_print_events`, mismo patrón que el resto de tablas de pedidos |

**Importante:** estas migraciones se han escrito siguiendo exactamente el estilo y las convenciones de las migraciones existentes, pero **no se han aplicado contra ningún proyecto Supabase real** — este entorno no tiene acceso a la base de datos del proyecto ni a Docker/Supabase local. Antes de usarlas hay que ejecutar `supabase db push` (o el flujo de migraciones habitual del equipo) contra un entorno de *staging* primero, revisar el resultado, y solo después contra producción.

### 19.2 Tipos de Supabase

`src/supabase/types.ts` se ha actualizado **a mano** para reflejar las tablas y columnas nuevas, con el mismo formato que genera `supabase gen types`. Es un sustituto razonado, no una regeneración real — en cuanto las migraciones se apliquen de verdad, hay que ejecutar `supabase gen types typescript --linked > src/supabase/types.ts` (o el comando equivalente del proyecto) y revisar el diff contra este archivo para detectar cualquier discrepancia.

### 19.3 Simplificaciones adoptadas respecto al diseño original (§1-§18)

Instruidas explícitamente en el encargo de implementación:

- **Una única plantilla React (`FoodLabel`)** con bloques condicionales por `label_profiles.visibleFields`/`fieldOrder` — no hay `ChuletonLabel`, `BurgerLabel`, etc., ni un `template_key` por perfil (se eliminó del diseño original de §6.5).
- **Un único formato físico, 100×70 mm**, como constantes (`LABEL_WIDTH_MM`/`LABEL_HEIGHT_MM` en `src/lib/labels/constants.ts`), no como columnas configurables por perfil (`page_width_mm`/`page_height_mm` del diseño original de §6.5 no se implementaron).
- **Un único perfil de administrador compartido.** El login pide contraseña + nombre operativo; el nombre y un identificador de sesión (`sid`) viajan como claims dentro del mismo JWT de sesión (`src/lib/admin-auth.ts`). No existen cuentas, roles ni tabla `admin_users`.
- **Configuración de envasado a nivel de producto, no de variante** (`usual_units_per_package`, `suggested_package_count` en `products`), tal como se pidió explícitamente en la pantalla de configuración — una simplificación consciente si un mismo producto tiene variantes con tamaños de pack muy distintos (queda anotado como limitación en §19.5).

Decisiones propias durante la implementación, para no sobrearquitecturar más allá de lo pedido:

- **`field_order` y `preparation_fields` se derivan automáticamente**, no se piden en el formulario de perfil: `field_order` sigue el orden fijo del catálogo (`LABEL_FIELD_KEYS`); `preparation_fields` es el subconjunto de `visible_fields` cuyo origen de dato es "preparación" (`LABEL_FIELD_SOURCE`). Evita una UI de reordenación manual que no aportaba valor real para 4-8 perfiles.
- **`net_weight`, `lot`, `beef_traceability` e `identification_mark` no aparecen en la matriz de checkboxes del formulario de perfil** — los gobiernan directamente los 4 interruptores `requiresWeight/requiresLot/requiresBeefTraceability/requiresHealthMark`, para no pedir el mismo dato dos veces.
- **`blocking_fields` es siempre subconjunto de `required_fields`** (validado con zod, `src/lib/labels/label-profile-schema.ts`): un campo no puede bloquear la impresión si no es obligatorio.
- **La identidad del trabajador para pedidos antiguos:** si una sesión se creó antes de este cambio (sin `workerName`/`sid` en el JWT), los endpoints de etiquetado la tratan como no autenticada y piden reiniciar sesión, en vez de registrar una impresión sin nombre.

### 19.4 Archivos y rutas nuevas (además de las migraciones)

**Lógica compartida** (`src/lib/labels/`): `label-fields.ts` (catálogo de 17 claves), `constants.ts`, `label-date.ts`, `label-package-suggestion.ts`, `label-snapshot.ts` (resolución de valores + snapshot de impresión), `label-validation.ts`, `label-profile-schema.ts`, `label-profile-form.ts` (formulario compacto ↔ arrays de BD), `product-label-config-schema.ts`, `label-preparation-schema.ts`.

**Sesión admin:** `src/lib/admin-auth.ts` y `src/lib/admin-session.ts` ampliados (nombre operativo + `sid`); `src/app/api/admin/auth/route.ts` y `src/app/admin/login/page.tsx` piden el nombre.

**Snapshot en el pedido:** `src/app/api/checkout/create-session/route.ts` ampliado para congelar el snapshot legal completo (antes solo alérgenos).

**Configuración** (`/admin/configuracion/etiquetas`): página + `OperatorConfigForm`, `LabelProfileForm`, `ProductLabelConfigForm` (`src/components/Admin/Labels/`); APIs en `src/app/api/admin/configuracion/etiquetas/{operador,perfiles,perfiles/[id],productos/[id]}/route.ts`.

**Preparar y etiquetar:** página `src/app/admin/pedidos/[id]/etiquetar/page.tsx` + `LabelLineCard.tsx` (incluye la fila de cada envase); APIs `src/app/api/admin/pedidos/[id]/etiquetas/route.ts` (generar), `src/app/api/admin/etiquetas/[id]/route.ts` (editar), `src/app/api/admin/etiquetas/[id]/anular/route.ts`, `src/app/api/admin/pedidos/[id]/preparado/route.ts` (marcar como preparado).

**Impresión:** `FoodLabel.tsx` (plantilla única), `PrintLabelsClient.tsx` (dispara `window.print()`, escucha `afterprint`, pide confirmación), página `src/app/admin/pedidos/[id]/etiquetas/imprimir/page.tsx`, página de previsualización `src/app/admin/pedidos/[id]/etiquetas/[labelId]/vista-previa/page.tsx`, API `src/app/api/admin/etiquetas/imprimir/route.ts` (registra impresión/reimpresión, valida bloqueantes antes de registrar).

**Integración en el pedido:** `src/app/admin/pedidos/[id]/page.tsx` (botón + resumen de envases), `src/components/Admin/AdminHeader.tsx` (enlace a Configuración de etiquetas), `src/lib/admin/event-labels.ts` (`PEDIDO_ETIQUETADO`).

### 19.5 Limitaciones conocidas (a tener en cuenta, no bloqueantes)

- **Envasado a nivel de producto, no de variante:** si un mismo producto tuviera variantes con formatos de pack muy distintos, `usual_units_per_package`/`suggested_package_count` es una aproximación única para todo el producto — el trabajador siempre puede corregir el número de envases y las unidades por envase línea a línea al preparar, así que no bloquea el uso, solo hace el valor sugerido menos preciso en ese caso concreto.
- **Sin reordenación manual de campos** dentro de una etiqueta (ver §19.3) — el orden sigue el catálogo fijo.
- **`ESLint` no está configurado en este repositorio** (no hay `eslint.config.*` ni la dependencia instalada, y es así desde el commit inicial — no es algo que haya roto esta implementación). `next lint` tampoco funciona en Next.js 16 tal como está instalado. No se ha añadido configuración de ESLint como parte de este encargo por ser una decisión de tooling más allá del alcance pedido; se señala aquí para que se decida aparte.
- **Migraciones sin aplicar** (ver §19.1) — validadas por lectura y por consistencia con el resto del esquema, no ejecutadas contra una base de datos real.

### 19.6 Pruebas realizadas

- **`npx tsc --noEmit`** — sin errores.
- **`npm run build`** (`next build`, Turbopack) — compila correctamente; las 9 rutas nuevas aparecen como `ƒ` (dinámicas), coherente con que usan cookies de sesión/`force-dynamic`.
- **`npm test`** (vitest, configurado en esta implementación — `vitest.config.ts`, script `test` en `package.json`) — **36 pruebas en 6 archivos, todas en verde**, cubriendo:
  - `label-fields.test.ts`: el catálogo de campos es internamente consistente (toda clave tiene etiqueta humana y origen de dato asignados, sin duplicados).
  - `label-date.test.ts`: formato de fechas sin desplazamiento de zona horaria, valores ausentes/no reconocidos.
  - `label-package-suggestion.test.ts`: casos "chuletón suelto" (1 envase por unidad) vs "pack ya es un envase" (1 envase por unidad vendida), y entradas inválidas.
  - `label-validation.test.ts`: alérgenos `null` (ausente) vs `[]` (declarado sin alérgenos) — no deben tratarse igual; clasificación correcta de incidencias por origen (`product_config`/`preparation`/`operator_config`); un campo obligatorio no bloqueante no marca `blocksPrinting`; los datos del operador solo se exigen si el perfil lo pide.
  - `label-profile-form.test.ts`: expansión de la matriz del formulario a los arrays de BD, exclusividad `expiry_date`/`best_before_date` según `dateType`, derivación automática de `preparation_fields` y `field_order`, ida y vuelta `toLabelProfileFormInput` ↔ `buildLabelProfileArrays`.
  - `label-snapshot.test.ts`: combinación de instrucciones de uso + modo de cocinado; combinación de RGSEAA + marca de identificación; el peso mostrado es siempre el real de esa etiqueta; parseo defensivo de `label_profile_snapshot` (incluidos pedidos antiguos sin snapshot y claves de campo desconocidas).

No se han escrito pruebas de integración contra Supabase real (no hay base de datos disponible en este entorno) ni pruebas end-to-end de la interfaz — la verificación de la UI (generar, editar, previsualizar, imprimir con la TSC DA210 real) queda pendiente de una prueba manual en un entorno con la base de datos migrada y la impresora conectada.

### 19.7 Decisiones pendientes para producción

Las mismas de §17, sin cambios: validación APPCC de los campos obligatorios/vida útil/conservación/trazabilidad por tipo de producto, decisión sobre el plazo de retención de `label_print_events`, y aplicar las migraciones en un entorno real (empezando por *staging*) antes de dar la función por operativa.
