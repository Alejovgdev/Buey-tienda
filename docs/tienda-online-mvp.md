# Tienda Online — El Buey Madurado
## Informe Técnico MVP

**Versión:** 1.1  
**Fecha:** Junio 2026  
**Proyecto:** El Buey Madurado — Tienda Online de Productos a Domicilio  
**Tipo:** Documento técnico de referencia para desarrollo

---

## Índice

1. [Resumen ejecutivo](#1-resumen-ejecutivo)
2. [Objetivo del MVP](#2-objetivo-del-mvp)
3. [Stack técnico](#3-stack-técnico)
4. [Alcance funcional](#4-alcance-funcional)
5. [Fuera de alcance](#5-fuera-de-alcance)
6. [Arquitectura recomendada](#6-arquitectura-recomendada)
7. [Flujo completo de compra](#7-flujo-completo-de-compra)
8. [Modelo de datos](#8-modelo-de-datos)
9. [Supabase Storage](#9-supabase-storage)
10. [Gestión de productos desde Supabase Studio](#10-gestión-de-productos-desde-supabase-studio)
11. [Alérgenos](#11-alérgenos)
11bis. [Etiquetas de producto y trazabilidad](#11-bis--etiquetas-de-producto-y-trazabilidad)
12. [Gestión de stock](#12-gestión-de-stock)
13. [Promociones simples automáticas](#13-promociones-simples-automáticas)
14. [Pausa de tienda / cierres / vacaciones](#14-pausa-de-tienda--cierres--vacaciones)
15. [Redsys (TPV Virtual) y notificación](#15-redsys-tpv-virtual-y-notificación)
16. [Emails con Resend](#16-emails-con-resend)
17. [Panel admin mínimo](#17-panel-admin-mínimo)
18. [Histórico de pedidos](#18-histórico-de-pedidos)
19. [Seguridad mínima](#19-seguridad-mínima)
20. [Preguntas pendientes al cliente](#20-preguntas-pendientes-al-cliente)
21. [Plan de implementación por fases](#21-plan-de-implementación-por-fases)
22. [Plan de pruebas antes de lanzamiento](#22-plan-de-pruebas-antes-de-lanzamiento)
23. [Riesgos y mitigaciones](#23-riesgos-y-mitigaciones)
24. [Próximas decisiones](#24-próximas-decisiones)
25. [Datos de seed de desarrollo](#25-datos-de-seed-de-desarrollo)

---

## 1. Resumen ejecutivo

La tienda online de El Buey Madurado es una sección nueva que se integra dentro de la web actual (Next.js + Vercel), sin repositorios separados, sin subdominios y sin plataformas externas como Shopify.

El objetivo es vender productos físicos a domicilio (packs de carne madurada, hamburguesas, croquetas, productos gourmet, etc.) de forma sencilla: el cliente compra, paga con el TPV Virtual del banco y recibe un email de confirmación. El pedido aparece en un panel admin propio para que el restaurante lo prepare manualmente. La logística posterior queda completamente fuera del sistema.

El MVP no es un ecommerce complejo. Es la versión mínima funcional para empezar a vender online sin cuentas de usuario, sin logística integrada, sin facturación avanzada y sin automatización de envíos.

El stack añade solo lo necesario sobre lo existente: **Supabase** (base de datos e imágenes), **Redsys TPV Virtual** (pagos) y **Resend** (emails transaccionales). La gestión de productos se hace directamente desde **Supabase Studio**, eliminando semanas de desarrollo de panel de administración de catálogo sin valor real para el lanzamiento.

Los dos puntos técnicos que requieren más atención son:

- El flujo de confirmación de pago: el pedido solo se marca como pagado cuando llega la notificación online de Redsys, nunca por el redirect del navegador.
- El descuento de stock: se hace de forma atómica en base de datos para evitar overselling en pedidos simultáneos.

**Tiempo estimado de desarrollo:** 5–7 semanas para un desarrollador que conoce el stack. El cuello de botella habitual no es el código sino las decisiones de negocio pendientes: productos, precios, IVA, gastos de envío, textos legales e imágenes.

---

## 2. Objetivo del MVP

Permitir que un cliente pueda:

1. Navegar el catálogo de productos del restaurante.
2. Seleccionar productos y variantes (peso, pack, unidades).
3. Añadir productos al carrito.
4. Rellenar sus datos de entrega sin necesidad de crear una cuenta.
5. Pagar con tarjeta a través del TPV Virtual (Redsys).
6. Recibir un email de confirmación con el resumen de su pedido.

Y permitir que el restaurante pueda:

1. Recibir un email interno con los datos del nuevo pedido.
2. Ver el pedido en un panel admin propio con toda la información necesaria para prepararlo.
3. Gestionar el catálogo de productos, variantes, stock, imágenes y alérgenos desde Supabase Studio.
4. Pausar temporalmente el checkout si la tienda no acepta pedidos (vacaciones, cierre, etc.).

---

## 3. Stack técnico

### Proyecto base (existente)

| Tecnología | Uso |
|------------|-----|
| Next.js App Router | Framework principal |
| TypeScript | Tipado estático |
| Tailwind CSS | Estilos |
| Framer Motion | Animaciones |
| Vercel | Hosting y despliegue |

### Añadido para la tienda

| Tecnología | Uso |
|------------|-----|
| Supabase PostgreSQL | Base de datos |
| Supabase Storage | Almacenamiento de imágenes de productos |
| Supabase Pro | Plan de producción (requerido para SLA y límites) |
| @supabase/supabase-js | Cliente oficial de Supabase para Next.js |
| Supabase CLI | Migraciones SQL y generación de tipos TypeScript |
| Redsys TPV Virtual | Pasarela de pagos (banco) |
| redsys-easy | Librería npm para firmar y verificar mensajes Redsys |
| Resend | Emails transaccionales |
| React Email | Plantillas de email como componentes React |
| Zod | Validación de datos en frontend y backend |

### Decisiones descartadas

- **Shopify:** Se descarta. La tienda vive dentro del proyecto Next.js actual.
- **Prisma ORM:** Se descarta. Añade una capa de abstracción innecesaria para este MVP. Las consultas son simples y directas, la operación crítica de descuento de stock se implementa mejor como función RPC en PostgreSQL que como transacción de Prisma, y Supabase CLI ya proporciona migraciones SQL y generación de tipos TypeScript. Prisma compensaría en proyectos con muchas relaciones complejas, múltiples fuentes de datos o equipos grandes — aquí no aporta lo suficiente para justificar la dependencia.
- **Stripe como pasarela de pago:** Se descarta en favor de Redsys TPV Virtual. El restaurante ya trabaja con su banco para operativa de cobros; contratar el TPV Virtual es el camino natural. Evita comisiones y procesos KYC de una pasarela internacional y cumple los requisitos del mercado español.
- **Formulario de tarjeta propio (Payment Intents o similar):** Se descarta. El cliente paga en la página segura de Redsys/banco (redirect). Elimina la responsabilidad de gestionar datos de tarjeta en el servidor y cumple PCI-DSS sin esfuerzo adicional.
- **NextAuth / sistema de autenticación de clientes:** Sin cuentas de usuario en el MVP. Compra como invitado.
- **Panel de administración de productos propio:** Se gestiona desde Supabase Studio.

---

## 4. Alcance funcional

La tienda debe permitir las siguientes funcionalidades en el MVP:

1. Ver catálogo de productos organizado por categorías.
2. Ver ficha de producto con imágenes, descripción, variantes disponibles e información de alérgenos.
3. Seleccionar variantes simples (peso cerrado, pack, unidades).
4. Ver si una variante está disponible o agotada.
5. Añadir productos al carrito.
6. Ver resumen del carrito con subtotal y promoción activa si aplica.
7. Ver aviso de tienda pausada o cerrada temporalmente si corresponde.
8. Rellenar checkout como invitado (sin registro):
   - Nombre y apellidos
   - Email
   - Teléfono
   - Dirección, código postal, ciudad y provincia
   - Observaciones opcionales
   - Aceptación de condiciones legales
9. Pagar con tarjeta a través del TPV Virtual (Redsys).
10. Ver página de confirmación de pedido recibido.
11. Recibir email de confirmación con resumen del pedido, datos de entrega y alérgenos si aplica.
12. El restaurante recibe email interno con datos del pedido para preparación.
13. El pedido aparece en el panel admin con toda la información necesaria.
14. El restaurante puede cambiar el estado del pedido y añadir notas internas.
15. El restaurante puede ver el histórico/timeline de eventos de cada pedido.
16. El sistema aplica automáticamente una promoción simple si el pedido supera un importe mínimo (producto de regalo).
17. El restaurante puede pausar temporalmente el checkout desde Supabase Studio.

---

## 5. Fuera de alcance

Las siguientes funcionalidades **no deben implementarse** en el MVP:

- Shopify o cualquier plataforma ecommerce externa
- Cuentas de usuario para clientes
- Área cliente con historial de pedidos
- Login o registro para compradores
- Integración con transportistas (MRW, SEUR, DHL, etc.)
- Generación automática de etiquetas de envío
- Tracking de envíos en la web
- Emails de seguimiento de envío o entrega
- Códigos de descuento o cupones (ej: BUEY10)
- Sistema avanzado de descuentos o reglas combinadas
- Promociones por categoría, por cliente o acumulables
- Facturación automática (el email de confirmación es suficiente para el MVP)
- Reseñas de productos
- Recomendaciones o upsells
- Panel propio de gestión de productos, variantes, imágenes o stock
- Panel propio de gestión avanzada de promociones
- Panel avanzado de calendario o disponibilidad
- Gestión avanzada de almacén
- Reservas temporales de stock (el carrito no bloquea unidades)
- Multi-sucursal
- Multi-idioma
- Venta a Canarias, Ceuta o Melilla (complejidad aduanera para productos cárnicos)
- Estados de pedido centrados en logística (SHIPPED, DELIVERED, IN_TRANSIT)

---

## 6. Arquitectura recomendada

### Integración en el proyecto actual

La tienda se integra como una sección adicional dentro del mismo proyecto Next.js. Comparte Navbar, Footer, estilos globales y despliegue en Vercel. No hay cambios en las rutas existentes del restaurante. El único elemento compartido que se modifica es el Navbar, al que se añade el enlace "Tienda" cuando esté lista.

### Estructura de rutas nuevas

```
src/app/
│
├── tienda/
│   ├── page.tsx                          → Landing: categorías y productos destacados
│   ├── [categoria]/
│   │   └── page.tsx                      → Listado de productos de una categoría
│   └── producto/
│       └── [slug]/
│           └── page.tsx                  → Ficha de producto con variantes y alérgenos
│
├── carrito/
│   └── page.tsx                          → Carrito con resumen y promoción activa
│
├── checkout/
│   └── page.tsx                          → Formulario de datos + resumen + botón de pago
│
├── pedido/
│   └── confirmacion/
│       └── page.tsx                      → Confirmación post-pago con polling de estado
│
└── admin/
    ├── login/
    │   └── page.tsx                      → Login del panel admin
    └── pedidos/
        ├── page.tsx                      → Listado de pedidos
        └── [id]/
            └── page.tsx                  → Detalle de pedido con timeline
```

### API Routes nuevas

```
POST  /api/checkout/create-session        → Valida datos, aplica promoción,
                                            crea pedido, genera payload de Redsys
GET   /api/pedidos/estado                 → Polling de estado post-pago
                                            (?order_number=BM-2026-00001)
GET   /api/tienda/promocion-activa        → Devuelve la promoción activa para
                                            el frontend del carrito
POST  /api/pagos/notificacion             → Notificación online de Redsys: confirma
                                            pago, descuenta stock, envía emails
POST  /api/admin/auth                     → Login del admin
POST  /api/admin/logout                   → Logout del admin
GET   /api/admin/pedidos                  → Listado de pedidos (protegida)
GET   /api/admin/pedidos/[id]             → Detalle de pedido (protegida)
PATCH /api/admin/pedidos/[id]/estado      → Cambiar estado (protegida)
PATCH /api/admin/pedidos/[id]/notas       → Añadir nota interna (protegida)
GET   /api/admin/pedidos/[id]/etiquetas   → Etiquetas de trazabilidad del pedido
POST  /api/admin/pedidos/[id]/etiquetas   → Crear etiqueta para un order_item
PATCH /api/admin/etiquetas/[id]           → Actualizar etiqueta existente
```

### Estructura de carpetas de código

```
src/
├── app/
│   ├── tienda/                           → Páginas del catálogo
│   ├── carrito/                          → Carrito
│   ├── checkout/                         → Checkout
│   ├── pedido/                           → Confirmación
│   ├── admin/                            → Panel admin
│   └── api/                              → API Routes
│
├── components/
│   ├── Tienda/
│   │   ├── ProductCard.tsx
│   │   ├── ProductGrid.tsx
│   │   ├── ProductDetail.tsx
│   │   ├── VariantSelector.tsx
│   │   ├── ProductImageGallery.tsx
│   │   ├── AllergensBadge.tsx
│   │   └── CategoryNav.tsx
│   ├── Carrito/
│   │   ├── CartContext.tsx
│   │   ├── CartItem.tsx
│   │   ├── CartSummary.tsx
│   │   └── PromocionBanner.tsx
│   ├── Checkout/
│   │   ├── CheckoutForm.tsx
│   │   └── OrderSummary.tsx
│   └── Admin/
│       ├── PedidosList.tsx
│       ├── PedidoDetail.tsx
│       ├── PedidoTimeline.tsx
│       └── EstadoBadge.tsx
│
├── lib/
│   ├── supabase.ts                       → Cliente público (ANON_KEY) para Server Components
│   ├── supabase-admin.ts                 → Cliente admin (SERVICE_ROLE_KEY) para API Routes y notificación
│   ├── redsys.ts                         → Instancia de redsys-easy configurada
│   ├── resend.ts                         → Cliente Resend
│   ├── shop-settings.ts                  → Helper para leer shop_settings
│   └── order-number.ts                   → Generador de order_number
│
├── supabase/
│   ├── migrations/                       → Archivos SQL de migración (Supabase CLI)
│   │   ├── 0001_initial_schema.sql
│   │   ├── 0002_rpc_decrement_stock.sql  → Función RPC de descuento atómico
│   │   └── 0003_product_labels.sql       → Tabla etiquetas, trigger, pg_cron, secuencia Redsys
│   └── types.ts                          → Tipos generados con: supabase gen types typescript
│
└── types/
    └── shop.ts                           → Tipos TypeScript de la tienda
```

### Separación de responsabilidades

| Responsabilidad | Dónde |
|----------------|-------|
| Estado del carrito y promoción visible | Frontend (React Context + localStorage) |
| Catálogo, fichas de producto | Servidor (Server Components) |
| Formulario de checkout | Cliente (Client Component + Zod) |
| Validación definitiva de datos | Backend (API Route) |
| Verificación de `accepting_orders` | Backend (primer paso en create-session) |
| Cálculo real de subtotal y promoción | Backend (precios desde BD, nunca del frontend) |
| Crear pedido y generar payload de Redsys | Backend |
| Confirmar pago y actualizar pedido | Backend (notificación online de Redsys) |
| Descuento atómico de stock | Backend (función RPC en PostgreSQL, llamada desde la notificación) |
| Envío de emails | Backend (dentro del handler de notificación) |
| Panel admin: lectura de pedidos | Servidor (Server Components con verificación de sesión) |
| Panel admin: mutaciones | Backend (API Routes protegidas) |

**Regla absoluta:** Los precios nunca se leen del body de la petición. El backend los calcula desde la base de datos usando los `variantId` que llegan del cliente. Tampoco se confía en totales ni en la aplicación de promociones que venga del frontend.

---

## 7. Flujo completo de compra

```
CATÁLOGO
  El cliente llega a /tienda
  └── Server Component carga categorías y productos destacados desde Supabase
      └── Si accepting_orders = false → muestra aviso pero catálogo visible
          └── Navega a /tienda/[categoria] o /tienda/producto/[slug]

FICHA DE PRODUCTO
  Server Component carga producto, variantes, imágenes y alérgenos
  └── Cliente selecciona variante
      └── Si stock > 0 → botón "Añadir al carrito" activo
          Si stock = 0 → botón desactivado con etiqueta "Agotado"
              └── Clic → producto añadido al CartContext
                  CartContext persiste en localStorage

CARRITO (/carrito)
  El cliente ve productos, cantidades editables y subtotal
  └── Frontend compara subtotal con la promoción activa (cargada de /api/tienda/promocion-activa)
      Si subtotal >= min_subtotal → muestra regalo y "¡Promoción aplicada!"
      Si subtotal < min_subtotal → muestra "Te faltan X€ para conseguir el regalo"
  └── Si accepting_orders = false → muestra banner con checkout_disabled_message
      └── Cliente hace clic en "Proceder al pago"

CHECKOUT (/checkout)
  El cliente rellena formulario: nombre, apellidos, email, teléfono,
  dirección, CP, ciudad, provincia, observaciones
  └── Acepta condiciones legales (checkbox obligatorio)
      └── Ve resumen: productos, regalo si aplica, gastos de envío, total
          └── Clic en "Pagar con tarjeta"

CREACIÓN DEL PEDIDO (POST /api/checkout/create-session)
  1.  Validación de datos con Zod
  2.  Verificar accepting_orders en shop_settings → si false, error 503
  3.  Leer precios reales de cada variant_id desde BD
  4.  Calcular subtotal real en backend
  5.  Calcular gastos de envío (subtotal < 15000 → 1000 céntimos; ≥ 15000 → 0)
  6.  Consultar promociones activas y vigentes
  7.  Si subtotal >= min_subtotal → verificar stock del regalo
      Si hay stock → marcar promoción para aplicar
      Si no hay stock → no aplicar promoción (registrar evento)
  8.  Verificar stock de todos los productos (incluido regalo si aplica)
      Si alguna variante sin stock suficiente → error 409
  9.  Generar order_number (BM-2026-00001)
  10. INSERT en orders (status: PENDING_PAYMENT)
  11. INSERT en order_items (con snapshots de nombre, variante, precio y alérgenos)
  12. INSERT en order_status_history: PEDIDO_CREADO
  13. Generar redsys_ds_order → llamar RPC generate_redsys_ds_order() → "26000001"
  14. UPDATE orders SET redsys_ds_order = '26000001'
  15. Construir payload de Redsys (Ds_MerchantParameters en Base64 + Ds_Signature HMAC-SHA256)
  16. INSERT en order_status_history: REDSYS_PAYLOAD_GENERADO
  17. Devolver { params, signature, signatureVersion, actionUrl } al frontend
  Frontend auto-envía form POST a la URL de Redsys (SIS)

PAGO EN REDSYS
  El cliente introduce datos de tarjeta en la página segura de Redsys/banco
  └── Si falla → Redsys redirige a /carrito?pago=fallido
      Si éxito → Redsys redirige a /pedido/confirmacion?order_number=BM-2026-00001
      (este redirect NO es la fuente de verdad — ver notificación más abajo)

PÁGINA DE CONFIRMACIÓN (/pedido/confirmacion)
  Muestra: "Pedido recibido, confirmando pago..."
  └── Polling cada 2s a GET /api/pedidos/estado?order_number=BM-2026-00001
      Cuando status = PAID → muestra confirmación completa con número de pedido
      Si pasan 30s sin confirmar → muestra mensaje de espera con datos
      de contacto del restaurante

NOTIFICACIÓN ONLINE DE REDSYS (POST /api/pagos/notificacion) ← FUENTE REAL DE VERDAD
  Redsys envía POST asíncrono con Ds_SignatureVersion, Ds_MerchantParameters, Ds_Signature
  └── Verificar firma con redsys-easy (processRestNotification)
      Si firma inválida → 400, log de error
      └── Decodificar Ds_MerchantParameters → extraer Ds_Order y Ds_Response
          └── Ds_Response 0000–0099 = autorizado; cualquier otro = denegado/error
              └── Buscar pedido por redsys_ds_order
                  └── Idempotencia: si el pedido ya está en PAID → 200 y salir
                      └── Si denegado → pedido → PAYMENT_FAILED, registrar evento, 200
                          Si autorizado:
                          └── Transacción atómica en PostgreSQL:
                              a. SELECT FOR UPDATE en las variantes afectadas
                              b. Verificar stock >= cantidad para cada línea (incluyendo regalo)
                              c. Si stock insuficiente → ROLLBACK, pedido → STOCK_ERROR,
                                 registro en histórico
                              d. Si éxito → descontar stock, actualizar pedido a PAID,
                                 INSERT en payments, registrar eventos en histórico
                          └── Enviar email al cliente (try/catch — no propaga error)
                              Registrar EMAIL_CLIENTE_ENVIADO o EMAIL_CLIENTE_ERROR
                          └── Enviar email interno al restaurante (try/catch)
                              Registrar EMAIL_INTERNO_ENVIADO o EMAIL_INTERNO_ERROR
                          └── Devolver 200 a Redsys (obligatorio — si no, reintenta)

PANEL ADMIN (/admin/pedidos)
  El restaurante ve el nuevo pedido con estado PAID
  └── Abre detalle → ve productos a preparar, datos del cliente,
      alérgenos, dirección, observaciones, regalo si aplica y timeline
      └── Cambia estado a PREPARING cuando empieza a prepararlo
          └── Usa notas internas para apuntar información de transporte manual
```

---

## 8. Modelo de datos

**Acceso a BD:** Supabase JS Client (`@supabase/supabase-js`)  
**Migraciones:** Supabase CLI (archivos SQL en `supabase/migrations/`)  
**Tipos:** Generados con `supabase gen types typescript` — se ejecuta tras cada migración  
**Host:** Supabase PostgreSQL (plan Pro en producción)

---

### `categories`

```sql
id           UUID        PK  DEFAULT gen_random_uuid()
slug         TEXT        UNIQUE NOT NULL    -- "packs-chuletones"
name         TEXT        NOT NULL           -- "Packs de Chuletones"
description  TEXT        NULLABLE
image_url    TEXT        NULLABLE           -- URL de Supabase Storage
sort_order   INT         DEFAULT 0
is_active    BOOLEAN     DEFAULT true
created_at   TIMESTAMPTZ DEFAULT now()
```

---

### `products`

```sql
id                   UUID        PK  DEFAULT gen_random_uuid()
slug                 TEXT        UNIQUE NOT NULL
name                 TEXT        NOT NULL
description          TEXT        NULLABLE
category_id          UUID        FK → categories.id NOT NULL
is_active            BOOLEAN     DEFAULT true
sort_order           INT         DEFAULT 0
allergens            TEXT[]      NULLABLE    -- ["gluten", "leche", "huevo"]
allergens_notes      TEXT        NULLABLE    -- "Puede contener trazas de frutos secos."
ingredients          TEXT        NULLABLE    -- Ingredientes (para etiquetas de trazabilidad)
storage_conditions   TEXT        NULLABLE    -- "Conservar entre 0°C y 4°C"
prep_instructions    TEXT        NULLABLE    -- "Descongelar 24h en nevera antes de consumir"
cooking_method       TEXT        NULLABLE    -- "Cocinar a la plancha o brasa"
created_at           TIMESTAMPTZ DEFAULT now()
updated_at           TIMESTAMPTZ DEFAULT now()
```

Relaciones: N:1 con `categories`, 1:N con `product_variants`, 1:N con `product_images`, 1:N con `product_labels`

El precio no vive en `products` sino en `product_variants`, porque cada variante puede tener precio distinto.

---

### `product_variants`

```sql
id           UUID        PK  DEFAULT gen_random_uuid()
product_id   UUID        FK → products.id NOT NULL
name         TEXT        NOT NULL    -- "1kg", "Pack 4 uds.", "Caja 12 uds."
price        INT         NOT NULL    -- en céntimos: 2500 = 25,00€
stock        INT         NOT NULL DEFAULT 0
is_active    BOOLEAN     DEFAULT true
sort_order   INT         DEFAULT 0
```

**Por qué precio en céntimos:** Redsys recibe el importe en céntimos (sin separador decimal). Evita errores de coma flotante. En frontend se divide entre 100 para mostrar (`(price / 100).toFixed(2) + "€"`).

**Stock = 0** significa agotado. No se usa `NULL` para stock en el MVP.

---

### `product_images`

```sql
id            UUID    PK  DEFAULT gen_random_uuid()
product_id    UUID    FK → products.id NOT NULL
storage_path  TEXT    NOT NULL    -- "products/chuleton-chuletero/main.webp"
url           TEXT    NOT NULL    -- URL pública completa de Supabase Storage
alt_text      TEXT    NULLABLE
is_main       BOOLEAN DEFAULT false
sort_order    INT     DEFAULT 0
```

---

### `promotions`

```sql
id                   UUID        PK  DEFAULT gen_random_uuid()
name                 TEXT        NOT NULL    -- "Pack burgers de regalo, primeros 10 pedidos"
type                 TEXT        NOT NULL    -- "GIFT_PRODUCT" (único tipo en MVP)
min_subtotal         INT         NULLABLE    -- en céntimos; NULL = sin mínimo
gift_variant_id      UUID        FK → product_variants.id NOT NULL
is_active            BOOLEAN     DEFAULT false
max_redemptions      INT         NULLABLE    -- NULL = sin límite; 10 = primeros 10 pedidos
current_redemptions  INT         NOT NULL DEFAULT 0  -- se incrementa en la notificación al confirmar
starts_at            TIMESTAMPTZ NULLABLE
ends_at              TIMESTAMPTZ NULLABLE
created_at           TIMESTAMPTZ DEFAULT now()
updated_at           TIMESTAMPTZ DEFAULT now()
```

Se gestiona desde Supabase Studio. Para activar: `is_active = true`. Para limitar usos: rellenar `max_redemptions`. Para ver cuántos se han usado: leer `current_redemptions`. Para programar: rellenar `starts_at` / `ends_at`.

El backend considera la promoción disponible si cumple:
```
is_active = true
AND (starts_at IS NULL OR starts_at <= now())
AND (ends_at IS NULL OR ends_at >= now())
AND (max_redemptions IS NULL OR current_redemptions < max_redemptions)
```

El incremento de `current_redemptions` ocurre **en el handler de notificación de Redsys**, no al crear el pedido. Así solo se cuenta un uso cuando el pago se confirma efectivamente.

---

### `shop_settings`

```sql
id                        UUID        PK  DEFAULT gen_random_uuid()
singleton                 BOOLEAN     NOT NULL DEFAULT true UNIQUE CHECK (singleton = true)
accepting_orders          BOOLEAN     NOT NULL DEFAULT true
notice_message            TEXT        NULLABLE  -- mensaje informativo (tienda abierta con aviso)
checkout_disabled_message TEXT        NULLABLE  -- mensaje cuando el checkout está bloqueado
updated_at                TIMESTAMPTZ DEFAULT now()
```

La constraint `UNIQUE` en `singleton = true` garantiza que solo pueda existir una fila. Se gestiona desde Supabase Studio editando esa única fila.

---

### `orders`

```sql
id                    UUID        PK  DEFAULT gen_random_uuid()
order_number          TEXT        UNIQUE NOT NULL    -- "BM-2026-00001"
status                TEXT        NOT NULL           -- ver estados más abajo

-- Snapshot del cliente al momento de la compra
customer_name         TEXT        NOT NULL
customer_last_name    TEXT        NOT NULL
customer_email        TEXT        NOT NULL
customer_phone        TEXT        NOT NULL

-- Snapshot de la dirección de envío al momento de la compra
shipping_street       TEXT        NOT NULL
shipping_city         TEXT        NOT NULL
shipping_province     TEXT        NOT NULL
shipping_postal_code  TEXT        NOT NULL
shipping_country      TEXT        NOT NULL DEFAULT 'ES'
shipping_notes        TEXT        NULLABLE

-- Totales en céntimos
subtotal              INT         NOT NULL
shipping_cost         INT         NOT NULL DEFAULT 0
total                 INT         NOT NULL

-- Notas internas del restaurante
admin_notes           TEXT        NULLABLE

-- Redsys
redsys_ds_order       TEXT        NULLABLE UNIQUE  -- "26000001" (año 2 dígitos + secuencia 6 dígitos)
                                                   -- Generado por RPC generate_redsys_ds_order()
                                                   -- Ds_Order: 4-12 chars, primeros 4 numéricos

-- Timestamps
paid_at               TIMESTAMPTZ NULLABLE
created_at            TIMESTAMPTZ DEFAULT now()
updated_at            TIMESTAMPTZ DEFAULT now()
```

**Nota de diseño — dos referencias de pedido:**  
`order_number` (BM-2026-00001) es el identificador visible para el cliente y el restaurante. `redsys_ds_order` ("26000001") es la referencia técnica que Redsys exige — su formato (4-12 chars, primeros 4 dígitos numéricos) es incompatible con `order_number`. Ambos viven en la misma fila; se usan según el contexto.

Los datos del cliente y la dirección son columnas planas en `orders`, no tablas separadas. Para compra como invitado sin cuentas de usuario, esto es correcto y significativamente más simple. Si en v2 se añaden cuentas de usuario, se puede añadir una FK opcional a `customers`.

---

### `order_items`

```sql
id                          UUID    PK  DEFAULT gen_random_uuid()
order_id                    UUID    FK → orders.id NOT NULL
product_variant_id          UUID    FK → product_variants.id NULLABLE
                                        -- nullable: protege si se borra la variante en futuro

-- Snapshots del momento de la compra
product_name_snapshot       TEXT    NOT NULL
variant_name_snapshot       TEXT    NOT NULL
unit_price_snapshot         INT     NOT NULL    -- en céntimos (0 si es regalo)
quantity                    INT     NOT NULL
line_total                  INT     NOT NULL    -- unit_price_snapshot × quantity

-- Snapshots de alérgenos
allergens_snapshot          TEXT[]  NULLABLE    -- copia de products.allergens
allergens_notes_snapshot    TEXT    NULLABLE    -- copia de products.allergens_notes

-- Promociones
item_type                   TEXT    NOT NULL DEFAULT 'PRODUCT'  -- 'PRODUCT' | 'GIFT'
promotion_id                UUID    FK → promotions.id NULLABLE -- solo si item_type = 'GIFT'
```

Los snapshots garantizan que si un producto cambia de nombre, precio, variante o alérgenos después de la compra, el pedido histórico conserva los datos exactos que tenía en el momento de la venta.

---

### `payments`

```sql
id                    UUID        PK  DEFAULT gen_random_uuid()
order_id              UUID        FK → orders.id UNIQUE NOT NULL
redsys_ds_order       TEXT        NOT NULL        -- referencia enviada a Redsys
redsys_ds_response    TEXT        NULLABLE        -- código de respuesta (0000–0099 = OK)
redsys_authorization  TEXT        NULLABLE        -- código de autorización del banco
amount                INT         NOT NULL        -- en céntimos
currency              TEXT        NOT NULL DEFAULT 'EUR'
status                TEXT        NOT NULL        -- 'succeeded' | 'failed' | 'refunded'
paid_at               TIMESTAMPTZ NULLABLE
created_at            TIMESTAMPTZ DEFAULT now()
```

---

### `order_status_history`

```sql
id               UUID        PK  DEFAULT gen_random_uuid()
order_id         UUID        FK → orders.id NOT NULL
event_type       TEXT        NOT NULL
previous_status  TEXT        NULLABLE
new_status       TEXT        NULLABLE
notes            TEXT        NULLABLE
metadata         JSONB       NULLABLE    -- datos adicionales según el evento
created_at       TIMESTAMPTZ DEFAULT now()
```

Tabla inmutable: solo se insertan filas, nunca se actualizan ni borran.

**Tipos de evento (`event_type`):**

```
PEDIDO_CREADO
REDSYS_PAYLOAD_GENERADO
PAGO_CONFIRMADO
PAGO_FALLIDO
STOCK_DESCONTADO
STOCK_ERROR
PROMOCION_APLICADA
REGALO_AÑADIDO
PROMOCION_NO_APLICADA   -- metadata: { reason: "AGOTADA" | "SIN_STOCK_REGALO" }
EMAIL_CLIENTE_ENVIADO
EMAIL_CLIENTE_ERROR
EMAIL_INTERNO_ENVIADO
EMAIL_INTERNO_ERROR
ESTADO_CAMBIADO
NOTA_INTERNA_AÑADIDA
```

---

### Estados del pedido

| Estado | Descripción |
|--------|-------------|
| `PENDING_PAYMENT` | Pedido creado, esperando confirmación de pago de Redsys |
| `PAID` | Pago confirmado por notificación de Redsys, stock descontado |
| `PREPARING` | El restaurante ha empezado a preparar el pedido |
| `CANCELLED` | Pedido cancelado (manual o por pago fallido) |
| `PAYMENT_FAILED` | Redsys comunicó que el pago fue denegado (Ds_Response fuera de rango 0000–0099) |
| `STOCK_ERROR` | Pago confirmado pero stock insuficiente para descontar |
| `NEEDS_REVIEW` | Situación inesperada que requiere revisión manual |

No se usa `SHIPPED`, `DELIVERED` ni ningún estado de logística. Si el restaurante quiere dejar constancia de algo del transporte, lo hace mediante notas internas.

### Transiciones de estado permitidas desde el panel admin

```
PAID         → PREPARING, CANCELLED
PREPARING    → CANCELLED
STOCK_ERROR  → NEEDS_REVIEW, CANCELLED
NEEDS_REVIEW → PREPARING, CANCELLED
```

---

## 9. Supabase Storage

### Bucket

```
product-images    (público — lectura sin autenticación)
```

Las imágenes de productos son contenido de libre acceso. Bucket público para lectura directa desde `<img>` y Next.js `Image`. La escritura (subida, borrado, actualización) se hace desde Supabase Studio o desde el backend con `SUPABASE_SERVICE_ROLE_KEY`, nunca desde el navegador del cliente.

### Estructura de carpetas

```
product-images/
├── categories/
│   ├── packs-chuletones.webp
│   ├── hamburguesas.webp
│   ├── croquetas.webp
│   └── gourmet.webp
└── products/
    ├── chuleton-chuletero/
    │   ├── main.webp
    │   ├── detalle-1.webp
    │   └── corte.webp
    ├── pack-burgers-4uds/
    │   ├── main.webp
    │   └── contenido.webp
    └── croquetas-jamon/
        └── main.webp
```

### Cómo guardar la referencia en base de datos

En `product_images` se guardan dos campos:

- **`storage_path`:** ruta relativa dentro del bucket (`products/chuleton-chuletero/main.webp`). Referencia estable que no cambia si migra el proyecto.
- **`url`:** URL pública completa. Se construye como `${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/product-images/${storage_path}`.

En `next.config.ts`, añadir el dominio de Supabase:

```typescript
images: {
  remotePatterns: [{ hostname: '*.supabase.co' }]
}
```

### Recomendaciones de formato

| Uso | Formato | Tamaño máximo | Dimensiones |
|-----|---------|---------------|-------------|
| Imagen principal de producto | WebP | 250 KB | 800×800 px |
| Imágenes de detalle | WebP | 300 KB | 1200×800 px |
| Imagen de categoría | WebP | 150 KB | 800×400 px |

**Nombres de archivo:** minúsculas, sin espacios, sin caracteres especiales, con guiones. Ejemplos correctos: `chuleton-chuletero-main.webp`, `pack-burgers-4uds-detalle-1.webp`. Ejemplos incorrectos: `Foto chuletón (1).jpg`, `IMG_20240312.jpg`.

Supabase Storage no transforma imágenes automáticamente. Lo que se sube es lo que se sirve. Optimizar en origen antes de subir.

---

## 10. Gestión de productos desde Supabase Studio

**No se desarrolla un panel de administración de productos dentro de la web.** Toda la gestión del catálogo se hace desde **Supabase Studio** (interfaz web de Supabase), que permite editar tablas de forma visual similar a una hoja de cálculo.

Desde Supabase Studio el equipo puede:

- Crear y editar categorías (`categories`)
- Crear y editar productos con descripción, alérgenos, ingredientes, condiciones de conservación, instrucciones de preparación y método de cocinado (`products`)
- Crear y editar variantes con nombre, precio y stock (`product_variants`)
- Desactivar productos o variantes (`is_active = false`)
- Actualizar precios
- Actualizar stock manualmente
- Subir imágenes al bucket y registrar las URLs en `product_images`
- Crear, activar y desactivar promociones (`promotions`)
- Activar o pausar la tienda (`shop_settings`)

### Tipos de producto soportados por el modelo

El modelo es genérico y soporta cualquier combinación de producto y variante:

| Producto | Variantes |
|----------|-----------|
| Chuletón madurado | 1kg / 1,5kg / 2kg |
| Entrecot | 400g / 800g |
| Tomahawk | Unidad ~1,2kg |
| Pack burgers wagyu | Pack 4 uds. / Pack 8 uds. |
| Croquetas de jamón | Caja 12 uds. / Caja 24 uds. |
| Pack gourmet | Pack básico / Pack premium |
| Producto de regalo | (variante con price = 0) |

**Importante:** El MVP vende formatos cerrados. No se implementa venta por peso variable exacto (ej: "1,237 kg × precio/kg"). Cada variante tiene un precio fijo.

---

## 11. Alérgenos

La información de alérgenos es obligatoria para una tienda online de alimentación. Está regulada por el Reglamento EU 1169/2011 y es especialmente relevante para productos elaborados como croquetas, burgers, packs preparados, salsas o marinados.

### Almacenamiento en `products`

```sql
allergens        TEXT[]    -- Lista de alérgenos: ["gluten", "leche", "huevo"]
allergens_notes  TEXT      -- Texto libre: "Puede contener trazas de frutos secos."
```

Se gestiona desde Supabase Studio junto al producto. No se crea una tabla separada de alérgenos para el MVP.

**Alérgenos de declaración obligatoria (14 alérgenos EU):**

```
gluten, crustáceos, huevo, pescado, cacahuetes, soja, leche,
frutos_secos, apio, mostaza, sésamo, dióxido_de_azufre, altramuces, moluscos
```

### Snapshot en `order_items`

Al crear el pedido, los alérgenos se copian como snapshot:

```sql
allergens_snapshot        TEXT[]    -- copia de products.allergens en el momento de la compra
allergens_notes_snapshot  TEXT      -- copia de products.allergens_notes
```

Si el restaurante modifica los alérgenos de un producto en Supabase Studio, los pedidos históricos mantienen la información que existía en el momento de la venta.

### Dónde se muestran los alérgenos

| Lugar | Detalle |
|-------|---------|
| Ficha de producto | Listado de alérgenos con iconos o badges + notas |
| Checkout (resumen) | Nota informativa si algún producto tiene alérgenos |
| Email al cliente | Sección de alérgenos por producto si hay datos |
| Email interno al restaurante | Alérgenos relevantes por línea de pedido |
| Panel admin (detalle de pedido) | Alérgenos del snapshot por cada producto |

---

## 11 bis — Etiquetas de producto y trazabilidad

> **Actualizado (2026-07-15):** el diseño de esta sección (una etiqueta por `order_item`, formulario directo sobre `product_labels`) se ha ampliado y ya está implementado — envase físico = etiqueta, perfiles de etiquetado configurables, snapshot legal completo en `order_items`, histórico de impresión/reimpresión y pantalla de configuración sin pasar por Supabase Studio. Ver `docs/FOOD_LABEL_ADMIN_DESIGN.md` (secciones 1-18 para el diseño, §19 para el estado real de la implementación) — es la referencia vigente para este sistema; lo que sigue en esta sección se conserva como contexto histórico de la v1.1.

### Propósito

Permite generar una etiqueta imprimible por cada producto de cada pedido con la información de trazabilidad requerida para productos elaborados de origen animal (Reglamento CE 853/2004). El restaurante crea la etiqueta desde el panel admin al preparar el pedido. La etiqueta se pre-rellena con los datos del producto (plantilla) y el admin puede ajustar los campos antes de guardarla.

### Campos de plantilla en `products` (nuevos en v1.1)

```sql
ingredients         TEXT  NULLABLE  -- "Carne de vacuno (100%)"
storage_conditions  TEXT  NULLABLE  -- "Conservar entre 0°C y 4°C"
prep_instructions   TEXT  NULLABLE  -- "Descongelar 24h en nevera antes de consumir"
cooking_method      TEXT  NULLABLE  -- "Cocinar a la plancha o brasa a alta temperatura"
```

Se gestionan desde Supabase Studio junto a los demás campos del producto. Son la plantilla de partida para cada etiqueta — se copian al crear la etiqueta y se pueden editar por pedido.

### Tabla `product_labels`

```sql
id                  UUID        PK  DEFAULT gen_random_uuid()
order_item_id       UUID        FK → order_items.id NULLABLE  -- qué línea de pedido originó esta etiqueta
product_id          UUID        FK → products.id NOT NULL
lote               TEXT        NOT NULL    -- "L260611-chuleton-vaca-madurada" (sugerido por trigger)
product_name        TEXT        NOT NULL    -- snapshot del nombre del producto
ingredients         TEXT        NULLABLE    -- snapshot de products.ingredients
allergens           TEXT[]      NULLABLE    -- snapshot de products.allergens
allergens_notes     TEXT        NULLABLE    -- snapshot de products.allergens_notes
storage_conditions  TEXT        NULLABLE    -- snapshot de products.storage_conditions
prep_instructions   TEXT        NULLABLE    -- snapshot de products.prep_instructions
cooking_method      TEXT        NULLABLE    -- snapshot de products.cooking_method
weight_grams        INT         NULLABLE    -- peso en gramos para esta unidad concreta
elaboration_date    DATE        NULLABLE    -- fecha de elaboración (manual)
expiry_date         DATE        NULLABLE    -- fecha de caducidad — SIEMPRE manual, nunca calculada
created_at          TIMESTAMPTZ DEFAULT now()
```

**Por qué `expiry_date` es siempre manual:** La vida útil de un producto cárnico depende del proceso de elaboración, temperatura de almacenamiento y factores que solo el equipo del restaurante puede valorar. Calcular automáticamente la caducidad sería una responsabilidad legal que el sistema no debe asumir.

### Trigger BEFORE INSERT — pre-relleno desde la plantilla

```sql
-- supabase/migrations/0003_product_labels.sql

CREATE OR REPLACE FUNCTION suggest_product_label_fields()
RETURNS TRIGGER AS $$
DECLARE
  p products%ROWTYPE;
BEGIN
  SELECT * INTO p FROM products WHERE id = NEW.product_id;

  IF NEW.product_name IS NULL OR NEW.product_name = '' THEN NEW.product_name := p.name; END IF;
  IF NEW.ingredients IS NULL        THEN NEW.ingredients       := p.ingredients;       END IF;
  IF NEW.allergens IS NULL          THEN NEW.allergens         := p.allergens;         END IF;
  IF NEW.allergens_notes IS NULL    THEN NEW.allergens_notes   := p.allergens_notes;   END IF;
  IF NEW.storage_conditions IS NULL THEN NEW.storage_conditions := p.storage_conditions; END IF;
  IF NEW.prep_instructions IS NULL  THEN NEW.prep_instructions  := p.prep_instructions;  END IF;
  IF NEW.cooking_method IS NULL     THEN NEW.cooking_method     := p.cooking_method;     END IF;

  -- Sugerir número de lote si no se ha especificado
  IF NEW.lote IS NULL OR NEW.lote = '' THEN
    NEW.lote := 'L'
      || to_char(COALESCE(NEW.elaboration_date, CURRENT_DATE), 'YYMMDD')
      || '-'
      || p.slug;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER before_insert_product_label
  BEFORE INSERT ON product_labels
  FOR EACH ROW EXECUTE FUNCTION suggest_product_label_fields();
```

**Formato del lote:** `L{YYMMDD}-{slug}` → por ejemplo `L260611-chuleton-vaca-madurada`. Es determinístico y trazable al producto y fecha de elaboración.

### Retención de datos — pg_cron

Las etiquetas se conservan 6 meses por motivos de trazabilidad. El borrado se gestiona con `pg_cron` (extensión de Supabase — activar desde Dashboard → Extensions → pg_cron):

```sql
-- En 0003_product_labels.sql, tras crear la tabla y el trigger:
SELECT cron.schedule(
  'delete-old-product-labels',
  '0 3 * * *',   -- diario a las 3:00 UTC
  $$DELETE FROM product_labels
    WHERE COALESCE(elaboration_date, created_at::date) < CURRENT_DATE - INTERVAL '6 months'$$
);
```

### Integración en el panel admin

En el detalle de pedido, bajo cada línea de producto:

- Si ya existe una etiqueta para ese `order_item_id`: mostrar los datos (lote, caducidad, fecha elaboración, peso) con botón "Editar".
- Si no existe: mostrar botón "Crear etiqueta". Al pulsar, abrir formulario pre-rellenado (el trigger aplica la plantilla del producto). El admin revisa y guarda.

**Campos editables en el formulario de etiqueta:**
- Lote (pre-rellenado, editable)
- Fecha de elaboración (date picker, obligatorio antes de guardar)
- Fecha de caducidad (date picker, obligatorio, siempre manual)
- Peso en gramos (opcional)
- Los demás campos (ingredientes, alérgenos, condiciones, etc.) son de solo lectura en este formulario — se editan desde Supabase Studio en el producto

### RLS de `product_labels`

La tabla `product_labels` solo es accesible con `SERVICE_ROLE_KEY`. No tiene política de lectura pública.

---

## 12. Gestión de stock

### Reglas del MVP

- El stock vive en `product_variants.stock` (número entero, en unidades).
- Se edita manualmente desde Supabase Studio.
- `stock = 0` significa agotado. No se usa `NULL`.
- La web muestra si una variante está disponible (`stock > 0`) o agotada (`stock = 0`).
- **El carrito no reserva stock.** Dos clientes pueden añadir la misma variante simultáneamente.
- Al crear el pedido, el backend verifica que cada variante tiene stock suficiente. Si no, devuelve error 409 antes de generar el payload de Redsys.
- El stock solo se descuenta cuando la notificación online de Redsys confirma el pago.

### Descuento atómico de stock en la notificación

El descuento se implementa como una **función RPC en PostgreSQL**, definida inicialmente en `supabase/migrations/0002_rpc_decrement_stock.sql` y corregida en `supabase/migrations/0009_fix_atomic_stock_rpc.sql`. Se llama desde el handler de notificación con el cliente admin de Supabase.

Usar una función RPC es la opción correcta para este caso: ejecuta toda la lógica de bloqueo, verificación y descuento en una única llamada dentro de la base de datos, sin depender de que el servidor de aplicación gestione la transacción. La función valida todas las líneas antes de descontar ninguna para evitar descuentos parciales.

```sql
-- supabase/migrations/0009_fix_atomic_stock_rpc.sql

CREATE OR REPLACE FUNCTION public.decrement_stock_and_confirm_order(
  p_order_id uuid,
  p_line_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  item record;
  v_stock int;
BEGIN
  -- Bloquear el pedido para evitar carreras sobre la misma confirmación.
  PERFORM 1
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'error', 'PEDIDO_NO_ENCONTRADO');
  END IF;

  -- Primera pasada: agrupar cantidades, bloquear variantes y validar.
  -- Importante: aquí NO se descuenta nada.
  FOR item IN
    SELECT parsed.variant_id, SUM(parsed.quantity)::int AS quantity
    FROM (
      SELECT
        (elem->>'variant_id')::uuid AS variant_id,
        (elem->>'quantity')::int AS quantity
      FROM jsonb_array_elements(p_line_items) AS elem
    ) parsed
    GROUP BY parsed.variant_id
    ORDER BY parsed.variant_id
  LOOP
    SELECT stock
    INTO v_stock
    FROM product_variants
    WHERE id = item.variant_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'VARIANTE_NO_ENCONTRADA',
        'variant_id', item.variant_id
      );
    END IF;

    IF v_stock < item.quantity THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'STOCK_INSUFICIENTE',
        'variant_id', item.variant_id,
        'requested', item.quantity,
        'available', v_stock
      );
    END IF;
  END LOOP;

  -- Segunda pasada: solo se descuenta si todas las líneas eran válidas.
  FOR item IN
    SELECT parsed.variant_id, SUM(parsed.quantity)::int AS quantity
    FROM (
      SELECT
        (elem->>'variant_id')::uuid AS variant_id,
        (elem->>'quantity')::int AS quantity
      FROM jsonb_array_elements(p_line_items) AS elem
    ) parsed
    GROUP BY parsed.variant_id
    ORDER BY parsed.variant_id
  LOOP
    UPDATE product_variants
    SET stock = stock - item.quantity
    WHERE id = item.variant_id;
  END LOOP;

  -- Confirmar el pedido solo después de descontar todo correctamente.
  UPDATE orders
  SET status = 'PAID', paid_at = now(), updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;
```

Llamada desde el handler de notificación con el cliente admin de Supabase:

```typescript
const { data, error } = await supabaseAdmin.rpc('decrement_stock_and_confirm_order', {
  p_order_id:   orderId,
  p_line_items: lineItems  // array con variant_id y quantity por línea
});

if (error || !data.ok) {
  // data.error === 'STOCK_INSUFICIENTE' → pedido a STOCK_ERROR
}
```

Si la función devuelve `ok: false`, el handler de notificación marca el pedido como `STOCK_ERROR`, registra el evento en el histórico con los datos de la variante que falló, y devuelve 200 a Redsys. El restaurante lo resuelve manualmente.

### Si el stock falla en la notificación

Situación: el pago fue cobrado por Redsys pero ya no hay stock suficiente (puede ocurrir si el stock se editó manualmente en Supabase Studio entre el checkout y la llegada de la notificación).

Comportamiento:
1. Rollback de la transacción.
2. Pedido → `STOCK_ERROR`.
3. Evento `STOCK_ERROR` registrado en `order_status_history` con `metadata` indicando qué variante falló y con qué stock disponible.
4. El restaurante ve el pedido marcado como `STOCK_ERROR` en el panel admin.
5. Resolución manual: el restaurante contacta al cliente por teléfono o email.

No hay automatización para este caso en el MVP.

---

## 13. Promociones simples automáticas

### Diseño

Se usa una tabla `promotions` gestionable desde Supabase Studio. Permite activar/desactivar promociones, cambiar umbrales, programar fechas y limitar el número de usos sin tocar código ni hacer deploys.

### Tipos de promoción soportados en el MVP

| Ejemplo | Configuración |
|---------|--------------|
| "Regalo para los 10 primeros pedidos" | `min_subtotal: NULL`, `max_redemptions: 10` |
| "Regalo para pedidos +200€" | `min_subtotal: 20000`, `max_redemptions: NULL` |
| "Regalo para los 10 primeros pedidos de +200€" | `min_subtotal: 20000`, `max_redemptions: 10` |

### Lógica en frontend (carrito)

El CartContext carga la promoción activa desde `GET /api/tienda/promocion-activa` al inicializar. El endpoint devuelve `null` si no hay ninguna disponible (agotada, inactiva o fuera de fechas).

Mensajes informativos posibles:

- Si hay promoción activa y `min_subtotal` no es `null` y `subtotal < min_subtotal`: "Te faltan X€ para conseguir [nombre del regalo]"
- Si la promoción está disponible y las condiciones se cumplen: "¡Promoción aplicada! [nombre del regalo] incluido"
- Si la promoción no está disponible (agotada): no mostrar el banner o mostrar "Promoción agotada"

El frontend es **solo informativo**. La decisión vinculante se toma siempre en el backend.

### Lógica en backend (create-session)

Al crear el pedido, el backend evalúa si la promoción es aplicable:

1. Calcular subtotal real desde precios de BD.
2. Consultar `promotions` con todos los criterios de disponibilidad:
   - `is_active = true`
   - fechas vigentes (o `NULL`)
   - `max_redemptions IS NULL OR current_redemptions < max_redemptions`
3. Si no hay promoción disponible → continuar sin regalo. Pedido normal.
4. Si hay promoción disponible y `min_subtotal` se cumple (o es `NULL`):
   - Verificar stock del `gift_variant_id`.
   - Si hay stock → añadir `order_item` con `item_type: GIFT`, `unit_price_snapshot: 0`, `promotion_id`.
   - Si no hay stock → no aplicar. El pedido continúa sin regalo.
5. Si `min_subtotal` no se cumple → no aplicar. Continuar normalmente.

**Regla fundamental:** Si la promoción no se aplica por cualquier razón (agotada, sin stock del regalo, subtotal insuficiente), **el pedido continúa y se procesa con normalidad**. Nunca se bloquea el checkout, nunca se marca el pedido como `STOCK_ERROR` ni `NEEDS_REVIEW` por este motivo.

### Incremento del contador en la notificación

`current_redemptions` se incrementa **en el handler de notificación de Redsys**, no al crear el pedido. Así solo se cuenta un uso real cuando el pago se confirma:

```sql
UPDATE promotions
SET current_redemptions = current_redemptions + 1,
    updated_at = now()
WHERE id = p_promotion_id;
```

Esto forma parte del flujo de la notificación, después de que la transacción de stock se complete con éxito. Si el pago falla o el stock falla, el contador no se incrementa.

### Eventos en el histórico

| Situación | Evento registrado |
|-----------|------------------|
| Promoción aplicada y regalo añadido | `PROMOCION_APLICADA` |
| Promoción agotada (`current_redemptions >= max_redemptions`) | `PROMOCION_NO_APLICADA` con `metadata: { reason: "AGOTADA" }` |
| Promoción sin stock del regalo | `PROMOCION_NO_APLICADA` con `metadata: { reason: "SIN_STOCK_REGALO" }` |
| Subtotal insuficiente (promoción visible pero no alcanzada) | No se registra evento — es el comportamiento normal |

### El regalo en el flujo de pago

El regalo **no se incluye en el importe enviado a Redsys** (solo se cobran productos reales + envío). El regalo aparece solo en:

- El resumen de checkout en la web (antes de redirigir a Redsys)
- `order_items` en la base de datos
- El email de confirmación al cliente
- El email interno al restaurante
- El panel admin

### Ejemplo visual en el carrito

```
Chuletón Chuletero 1kg          × 2      90,00€
Pack Burger Wagyu 4 uds.        × 1      18,00€
────────────────────────────────────────────────
🎁 Pack Burgers de regalo        × 1       0,00€
   Promoción: primeros 10 pedidos
────────────────────────────────────────────────
Subtotal                                108,00€
Gastos de envío                          10,00€
TOTAL                                   118,00€
```

### Solo una promoción activa simultánea

En el MVP no se contemplan promociones acumulables ni reglas combinadas. El backend toma la primera promoción que cumpla todos los criterios. Si se necesita cambiar de promoción, se desactiva la actual desde Supabase Studio y se activa la nueva.

---

## 14. Pausa de tienda / cierres / vacaciones

### Funcionamiento

La tabla `shop_settings` controla si la tienda acepta pedidos. Se gestiona editando la única fila desde Supabase Studio.

### Casos de uso

| Situación | Configuración |
|-----------|--------------|
| Operativa normal | `accepting_orders: true` |
| Aviso informativo (sin bloquear pedidos) | `accepting_orders: true` + `notice_message: "Hacemos envíos de lunes a viernes."` |
| Vacaciones o cierre temporal | `accepting_orders: false` + `checkout_disabled_message: "Cerrados por vacaciones. Volvemos el 1 de septiembre."` |
| Stock agotado temporalmente | `accepting_orders: false` + `checkout_disabled_message: "Estamos preparando nuevo stock. Vuelve pronto."` |

### Comportamiento en frontend

- Si `accepting_orders = true` y hay `notice_message`: mostrar banner informativo en `/tienda` y en el carrito. El checkout sigue funcionando.
- Si `accepting_orders = false`: mostrar `checkout_disabled_message` como banner visible en el carrito y en el checkout. El botón "Proceder al pago" y el botón "Pagar" quedan desactivados (`disabled`).
- El catálogo sigue visible en todos los casos.

### Validación en backend

En la API Route `POST /api/checkout/create-session`, como primer paso antes de cualquier otra lógica:

```typescript
const settings = await getShopSettings();

if (!settings?.accepting_orders) {
  return Response.json(
    {
      error: settings?.checkout_disabled_message
        ?? 'La tienda no acepta pedidos en este momento.'
    },
    { status: 503 }
  );
}
```

Esto garantiza que aunque alguien manipule el frontend o desactive JavaScript, no puede crear un pedido con la tienda pausada.

---

## 15. Redsys (TPV Virtual) y notificación

### Cómo funciona Redsys

El cliente sale al entorno seguro de Redsys (alojado por el banco) para introducir los datos de tarjeta. Nuestro servidor nunca ve ni toca datos de pago — solo genera y verifica firmas. El flujo es:

1. Backend genera el payload firmado (Ds_MerchantParameters + Ds_Signature).
2. Frontend auto-envía un form POST a la URL de Redsys (SIS).
3. El cliente paga en la página del banco.
4. Redsys envía una notificación online (POST asíncrono) a `NEXT_PUBLIC_BASE_URL/api/pagos/notificacion` — esta es la fuente de verdad.
5. Redsys redirige al cliente a `URL_OK` o `URL_KO` (nunca confiar en este redirect para confirmar el pago).

### Librería: redsys-easy

```bash
npm install redsys-easy
```

```typescript
// src/lib/redsys.ts
import { createRedsysAPI, SANDBOX_SIS_URL, PRODUCTION_SIS_URL } from 'redsys-easy';

export const redsys = createRedsysAPI({
  secretKey: process.env.REDSYS_SECRET_KEY!,
  urls: {
    redirect: process.env.REDSYS_ENVIRONMENT === 'production'
      ? PRODUCTION_SIS_URL
      : SANDBOX_SIS_URL,
  },
});
```

### Generación del payload en create-session

```typescript
// Generar redsys_ds_order desde una función RPC de PostgreSQL
const { data: dsOrder } = await supabaseAdmin.rpc('generate_redsys_ds_order');
// → "26000001" (2 dígitos año + 6 dígitos secuencia, ej. año 2026 → "26")

await supabaseAdmin
  .from('orders')
  .update({ redsys_ds_order: dsOrder })
  .eq('id', order.id);

const form = redsys.createRedirectForm({
  DS_MERCHANT_AMOUNT:          String(order.total),           // en céntimos
  DS_MERCHANT_ORDER:           dsOrder,                       // "26000001"
  DS_MERCHANT_MERCHANTCODE:    process.env.REDSYS_MERCHANT_CODE!,
  DS_MERCHANT_CURRENCY:        '978',                         // EUR
  DS_MERCHANT_TRANSACTIONTYPE: '0',                           // autorización estándar
  DS_MERCHANT_TERMINAL:        process.env.REDSYS_TERMINAL!,
  DS_MERCHANT_MERCHANTURL:     `${process.env.NEXT_PUBLIC_BASE_URL}/api/pagos/notificacion`,
  DS_MERCHANT_URLOK:           `${process.env.NEXT_PUBLIC_BASE_URL}/pedido/confirmacion?order_number=${order.order_number}`,
  DS_MERCHANT_URLKO:           `${process.env.NEXT_PUBLIC_BASE_URL}/carrito?pago=fallido`,
  DS_MERCHANT_PRODUCTDESCRIPTION: `Pedido ${order.order_number}`,
  DS_MERCHANT_TITULAR:         `${order.customer_name} ${order.customer_last_name}`,
});

// form.url          → URL de Redsys a la que enviar el form
// form.body.Ds_SignatureVersion
// form.body.Ds_MerchantParameters  (Base64)
// form.body.Ds_Signature           (HMAC-SHA256)
```

El frontend recibe `{ url, body }` y auto-envía el form:

```tsx
// El componente lo renderiza y hace submit automático via useEffect
<form id="redsys-form" action={actionUrl} method="POST">
  <input type="hidden" name="Ds_SignatureVersion" value={body.Ds_SignatureVersion} />
  <input type="hidden" name="Ds_MerchantParameters" value={body.Ds_MerchantParameters} />
  <input type="hidden" name="Ds_Signature" value={body.Ds_Signature} />
</form>
```

### Función RPC para generar Ds_Order

En `supabase/migrations/0003_product_labels.sql` (o en `0001_initial_schema.sql`):

```sql
CREATE SEQUENCE IF NOT EXISTS redsys_order_seq START 1;

CREATE OR REPLACE FUNCTION generate_redsys_ds_order()
RETURNS TEXT
LANGUAGE sql
AS $$
  SELECT to_char(CURRENT_DATE, 'YY') || LPAD(nextval('redsys_order_seq')::TEXT, 6, '0');
$$;
-- Resultado: "26000001", "26000002", ..., "26999999"
-- Formato válido para Redsys: 8 chars, primeros 4 dígitos numéricos ("2600" → OK)
```

### Handler de notificación (`POST /api/pagos/notificacion`)

La notificación llega como un POST con body URL-encoded. Redsys espera recibir HTTP 200 — si no lo recibe, reintenta hasta 3 veces.

```typescript
import { redsys } from '@/lib/redsys';

export async function POST(request: Request) {
  const body = await request.text(); // body URL-encoded
  const params = new URLSearchParams(body);

  const notification = {
    Ds_SignatureVersion:   params.get('Ds_SignatureVersion') ?? '',
    Ds_MerchantParameters: params.get('Ds_MerchantParameters') ?? '',
    Ds_Signature:          params.get('Ds_Signature') ?? '',
  };

  // 1. Verificar firma — si falla, alguien está suplantando a Redsys
  let result: ReturnType<typeof redsys.processRestNotification>;
  try {
    result = redsys.processRestNotification(notification);
  } catch {
    return new Response('Firma inválida', { status: 400 });
  }

  const dsResponse = result.Ds_Response;   // "0000"–"0099" = autorizado
  const dsOrder    = result.Ds_Order;       // "26000001"

  // 2. Buscar pedido por redsys_ds_order
  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('id, status, ...')
    .eq('redsys_ds_order', dsOrder)
    .single();

  if (!order) return new Response('Pedido no encontrado', { status: 400 });

  // 3. Idempotencia
  if (order.status === 'PAID') return Response.json({ ok: true });

  // 4. Pago denegado
  const authorized = dsResponse >= '0000' && dsResponse <= '0099';
  if (!authorized) {
    // → pedido a PAYMENT_FAILED, registrar evento, devolver 200
    return Response.json({ ok: true });
  }

  // 5. Transacción atómica (RPC decrement_stock_and_confirm_order)
  // 6. INSERT en payments con dsOrder, dsResponse, redsys_authorization
  // 7. Emails en try/catch (no propagan error)
  // 8. Devolver 200 siempre (salvo firma inválida)
  return Response.json({ ok: true });
}
```

### Errores de la notificación contemplados

| Situación | Comportamiento |
|-----------|---------------|
| Firma inválida | 400, log de error, no procesar |
| Pedido no encontrado en BD | 400, log de error crítico |
| Pedido ya en `PAID` | 200, salir (idempotencia) |
| Ds_Response fuera de rango 0000–0099 | Pedido → `PAYMENT_FAILED`, registro, 200 |
| Stock insuficiente | Rollback, `STOCK_ERROR`, registro en histórico, 200 |
| Error al enviar email | Log en histórico, continuar, 200 |
| Error inesperado | 500 → Redsys reintentará (máx. 3 intentos) |

**Por qué devolver 200 aunque falle el email:** Si el handler devuelve 500, Redsys reintentará. Sin idempotencia perfecta, esto puede procesar el mismo pago dos veces. El pedido queda creado correctamente y visible en el admin aunque el email falle.

### Entorno de pruebas (SIS-T)

| Parámetro | Valor |
|-----------|-------|
| URL | `https://sis-t.redsys.es:25443/sis/realizarPago` |
| REDSYS_MERCHANT_CODE | `999008881` |
| REDSYS_TERMINAL | `001` |
| REDSYS_SECRET_KEY | `sq7HjrUOBfKmC576ILgskD5srU870gJ7` |

**Tarjeta de prueba aprobada:** Pan `4548812049400004`, caducidad cualquier fecha futura, CVV `123`.  
**Tarjeta de prueba denegada:** el mismo pan con CVV `999`, o cualquier importe cuyo valor en céntimos termine en `96` (ej: `1096`, `2996`).

### Desarrollo local — notificación pública

La URL de notificación (`DS_MERCHANT_MERCHANTURL`) debe ser accesible públicamente desde internet. En local, usar ngrok:

```bash
ngrok http 3000
# Copiar la URL HTTPS generada (ej: https://abc123.ngrok-free.app)
# Usar como NEXT_PUBLIC_BASE_URL temporalmente en .env.local
```

Alternativa: hacer deploy de una rama de preview en Vercel y usar esa URL para las pruebas de integración.

### Entorno de producción

| Parámetro | Fuente |
|-----------|--------|
| REDSYS_MERCHANT_CODE | Banco / contrato TPV Virtual |
| REDSYS_TERMINAL | Banco / contrato TPV Virtual |
| REDSYS_SECRET_KEY | Banco / contrato TPV Virtual |
| REDSYS_ENVIRONMENT | `production` |
| URL SIS | `https://sis.redsys.es/sis/realizarPago` (gestionada por redsys-easy) |

---

## 16. Emails con Resend

Se usa **Resend** con **React Email** para las plantillas. Las plantillas son componentes React renderizados en el servidor, lo que facilita mantener el estilo de marca y reutilizar componentes de la web.

**Configuración del dominio de envío:** Los emails se envían desde `pedidos@restauranteelbueymadurado.com`. Para ello hay que verificar el dominio `restauranteelbueymadurado.com` en Resend añadiendo los registros DNS (SPF, DKIM, DMARC) que facilita Resend en su panel. El proveedor de DNS es Namecheap. **Sin esta verificación, los emails no se envían.**

**Plan de Resend:** Free tier — 3.000 emails/mes, límite de 100 emails/día. Suficiente para el lanzamiento. Si el volumen crece, actualizar al plan de pago.

### Email de confirmación al cliente

**Asunto:** `Pedido confirmado — El Buey Madurado #BM-2026-00001`

**Contenido:**

- Logo del restaurante
- "¡Tu pedido está confirmado!"
- Número de pedido destacado
- Tabla de productos: nombre, variante, cantidad, precio unitario, subtotal
- Si hay regalo: fila marcada con "🎁 [nombre del regalo] × 1 — REGALO INCLUIDO"
- Si hay alérgenos: sección "Información de alérgenos" por producto
- Gastos de envío
- **Total cobrado** (destacado)
- Sección "Tu pedido llegará a:"
  - Nombre completo
  - Dirección completa (calle, ciudad, provincia, CP)
  - Teléfono
- Observaciones del cliente si las había
- Texto de plazo de entrega estimado
- Contacto del restaurante para incidencias (email y teléfono)
- Footer con links a política de envíos y política de devoluciones

### Email interno al restaurante

**Asunto:** `NUEVO PEDIDO #BM-2026-00001 — El Buey Madurado`

**Contenido:**

- Número de pedido y fecha/hora exacta
- **Productos a preparar** (en grande y visible, es lo más importante):
  - Nombre del producto + variante + cantidad
  - Si hay regalo: `[REGALO PROMO] [nombre del regalo] × 1`
  - Alérgenos relevantes por línea si los hay
- Datos del cliente: nombre completo, email, teléfono
- Dirección de envío completa (con CP y provincia)
- Observaciones del cliente si las hay
- Total cobrado
- Link directo al pedido en el panel admin

**Variables de entorno:**
- `ADMIN_NOTIFICATION_EMAIL=elbueymaduradoxativa@gmail.com` — destino de los emails internos
- `EMAIL_FROM=pedidos@restauranteelbueymadurado.com` — dirección remitente (dominio verificado en Resend)

### Registro de estado en el histórico

Tanto el éxito como el error de cada envío se registran en `order_status_history`:

- `EMAIL_CLIENTE_ENVIADO` o `EMAIL_CLIENTE_ERROR`
- `EMAIL_INTERNO_ENVIADO` o `EMAIL_INTERNO_ERROR`

Los errores de email no interrumpen la notificación. El pedido se crea correctamente aunque Resend falle.

---

## 17. Panel admin mínimo

### Propósito

El panel admin existe exclusivamente para que el restaurante vea los pedidos y sepa qué tiene que preparar. No gestiona productos, stock, imágenes ni promociones — eso se hace desde Supabase Studio.

### Autenticación

Para el MVP con una o pocas personas gestionando el admin:

- Middleware en `src/middleware.ts` intercepta todas las rutas `/admin/*`
- Si no hay cookie `admin_session` válida → redirect a `/admin/login`
- `POST /api/admin/auth` compara la contraseña contra `process.env.ADMIN_PASSWORD` (en servidor, nunca en cliente)
- Si coincide: genera JWT firmado con `ADMIN_JWT_SECRET`, lo guarda en cookie `httpOnly, secure, sameSite: lax`
- Duración de sesión: 8 horas
- Si en el futuro se necesitan múltiples usuarios con acceso, se añade tabla `admin_users` con bcrypt

### Listado de pedidos (`/admin/pedidos`)

Tabla con:
- Número de pedido (enlace al detalle)
- Fecha y hora
- Nombre del cliente
- Total (en €)
- Badge de estado con colores:
  - `PENDING_PAYMENT` → gris
  - `PAID` → verde
  - `PREPARING` → azul
  - `CANCELLED` → rojo
  - `PAYMENT_FAILED` → rojo oscuro
  - `STOCK_ERROR` / `NEEDS_REVIEW` → naranja

Ordenado por fecha descendente. Filtro básico por estado.

### Detalle de pedido (`/admin/pedidos/[id]`)

```
Pedido #BM-2026-00001                    Estado: [PAID ▼]
Fecha: 11/06/2026 a las 14:32h

━━━ PRODUCTOS A PREPARAR ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Chuletón Chuletero 1kg          × 2      90,00€
    Alérgenos: —
    🏷 Etiqueta: Lote L260611-chuleton-vaca-madurada
       Elab: 11/06/2026 · Cad: 18/06/2026 · 1.000g  [Editar]

  Pack Burger Wagyu 4 uds.        × 1      18,00€
    Alérgenos: gluten, leche, huevo
    🏷 [Crear etiqueta]

  🎁 Pack Burgers de regalo       × 1       0,00€  [REGALO PROMO]
    Alérgenos: gluten, leche, huevo
    🏷 [Crear etiqueta]

━━━ TOTALES ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Subtotal                                108,00€
  Gastos de envío                          10,00€
  TOTAL COBRADO                           118,00€

━━━ DATOS DEL CLIENTE ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Juan García López
  juan@gmail.com · 666 123 456

━━━ DIRECCIÓN DE ENVÍO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Calle Mayor 12, 3ºB
  28001 Madrid (Madrid) · España

━━━ OBSERVACIONES DEL CLIENTE ━━━━━━━━━━━━━━━━━━━━━━━

  Dejar en conserjería si no hay nadie.

━━━ NOTAS INTERNAS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  [textarea con notas actuales del admin]
  [Botón: Guardar nota]

━━━ HISTÓRICO DEL PEDIDO ━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  ✓ 14:30  Pedido creado
  ✓ 14:30  Payload de Redsys generado
  ✓ 14:31  Pago confirmado (Ds_Response: 0000)
  ✓ 14:31  Stock descontado correctamente
  ✓ 14:31  Promoción aplicada: Pack Burgers de regalo
  ✓ 14:31  Email de confirmación enviado al cliente
  ✓ 14:31  Email interno enviado al restaurante
  ✓ 15:00  Estado cambiado: PAID → PREPARING
```

### Lo que el panel admin NO incluye

- CRUD de productos, variantes, imágenes o categorías
- Gestión de stock
- Gestión de promociones
- Panel de disponibilidad o calendario
- Gestión de usuarios o roles

---

## 18. Histórico de pedidos

La tabla `order_status_history` es el log de auditoría de cada pedido. Es **inmutable**: solo se insertan filas, nunca se actualizan ni borran. Permite reconstruir exactamente qué ocurrió y cuándo en cualquier pedido.

### Cuándo se inserta un evento

| Momento | Evento |
|---------|--------|
| Al crear el pedido | `PEDIDO_CREADO` |
| Al generar el payload de Redsys | `REDSYS_PAYLOAD_GENERADO` |
| Al confirmar el pago en la notificación | `PAGO_CONFIRMADO` con `metadata: { ds_response, ds_authorization }` |
| Si Redsys comunica pago denegado | `PAGO_FALLIDO` con `metadata: { ds_response }` |
| Al descontar el stock | `STOCK_DESCONTADO` |
| Si hay error de stock en la notificación | `STOCK_ERROR` con `metadata: { variant_id, requested, available }` |
| Al aplicar la promoción | `PROMOCION_APLICADA` + `REGALO_AÑADIDO` |
| Si la promoción está agotada o sin stock del regalo | `PROMOCION_NO_APLICADA` con `metadata: { reason: "AGOTADA" \| "SIN_STOCK_REGALO" }` — el pedido continúa sin regalo |
| Al enviar email al cliente | `EMAIL_CLIENTE_ENVIADO` o `EMAIL_CLIENTE_ERROR` |
| Al enviar email al restaurante | `EMAIL_INTERNO_ENVIADO` o `EMAIL_INTERNO_ERROR` |
| Al cambiar el estado desde el admin | `ESTADO_CAMBIADO` con `previous_status` y `new_status` |
| Al añadir nota interna | `NOTA_INTERNA_AÑADIDA` |

El campo `metadata JSONB` permite adjuntar contexto adicional cuando es relevante, como el identificador de la variante que falló en un error de stock o el código Ds_Response de Redsys.

---

## 19. Seguridad mínima

### Variables de entorno completas

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...           # Solo lectura pública (catálogo)
SUPABASE_SERVICE_ROLE_KEY=eyJ...               # NUNCA en frontend — solo backend

# Redsys TPV Virtual
REDSYS_MERCHANT_CODE=999008881                 # FUC del banco (dev: 999008881)
REDSYS_TERMINAL=001                            # Terminal (dev: 001)
REDSYS_SECRET_KEY=sq7HjrUOBfKmC576ILgskD5srU870gJ7  # NUNCA en frontend
REDSYS_ENVIRONMENT=test                        # "test" (SIS-T) | "production" (SIS)

# Resend
RESEND_API_KEY=re_...                          # NUNCA en frontend

# Admin
ADMIN_PASSWORD=contraseña-segura-larga         # NUNCA en frontend
ADMIN_JWT_SECRET=cadena-aleatoria-32chars      # NUNCA en frontend

# App
NEXT_PUBLIC_BASE_URL=https://restauranteelbueymadurado.com
ADMIN_NOTIFICATION_EMAIL=elbueymaduradoxativa@gmail.com
EMAIL_FROM=pedidos@restauranteelbueymadurado.com
```

**Regla:** Todo lo que empieza por `NEXT_PUBLIC_` puede verlo cualquier persona que abra las DevTools del navegador. Nunca poner secretos ahí. Para Redsys, ninguna variable es pública — la clave secreta y el código de comercio nunca deben estar en el frontend.

### Checklist de seguridad

| Punto | Medida |
|-------|--------|
| Panel admin | Middleware Next.js con JWT en cookie `httpOnly, secure` |
| Notificación de Redsys | Verificación de firma HMAC-SHA256 con `redsys-easy` antes de procesar |
| Precios en checkout | Se leen siempre de BD en backend, nunca del body del cliente |
| API Routes admin | Verifican cookie de sesión al inicio de cada handler |
| Supabase Storage — escritura | Solo vía `SERVICE_ROLE_KEY` desde backend |
| Mensajes de error al cliente | Sin exponer detalles de BD, stack traces ni IDs internos |
| Validación de datos | Zod en cliente (UX) y en backend (seguridad real) |
| Datos de clientes | Solo accesibles desde backend con `SERVICE_ROLE_KEY` |
| Webhook idempotente | Verificar estado del pedido antes de cualquier operación |

### Row Level Security (RLS) en Supabase

| Tabla | Política |
|-------|----------|
| `categories` | Lectura pública con `ANON_KEY` |
| `products` | Lectura pública con `ANON_KEY` |
| `product_variants` | Lectura pública con `ANON_KEY` |
| `product_images` | Lectura pública con `ANON_KEY` |
| `shop_settings` | Lectura pública con `ANON_KEY` |
| `promotions` | Solo accesible con `SERVICE_ROLE_KEY`. El frontend no lee la tabla directamente; usa `/api/tienda/promocion-activa`, que expone solo los datos públicos necesarios de una promoción activa |
| `orders` | Solo accesible con `SERVICE_ROLE_KEY` (backend) |
| `order_items` | Solo accesible con `SERVICE_ROLE_KEY` |
| `payments` | Solo accesible con `SERVICE_ROLE_KEY` |
| `order_status_history` | Solo accesible con `SERVICE_ROLE_KEY` |
| `product_labels` | Solo accesible con `SERVICE_ROLE_KEY` |

Activar RLS en todas las tablas en Supabase. Las tablas del catálogo y `shop_settings` tienen política de lectura pública. Las tablas de promociones, pedidos, pagos, histórico y etiquetas no tienen ninguna política pública — solo el `SERVICE_ROLE_KEY` las puede acceder.

---

## 20. Preguntas pendientes al cliente

Estas preguntas deben responderse **antes de escribir código**. Sin ellas no se puede crear los datos de catálogo ni escribir los textos del checkout.

> Las marcadas con ✅ ya tienen respuesta confirmada por el cliente.

1. **¿Qué productos exactos se venderán en el lanzamiento?** Nombres, descripciones y categorías.

2. **¿Qué variantes, precios y stock inicial tendrá cada producto?**
   Ejemplo: Chuletón Chuletero — 1kg = 40€, 1,5kg = 58€, 2kg = 74€ — stock inicial: 20 unidades de cada.

3. **¿Qué alérgenos contiene cada producto?**
   Necesario para rellenar `allergens` y `allergens_notes` en cada producto.

4. **¿Hay notas de trazas o advertencias específicas que deban mostrarse?**
   Ejemplo: "Elaborado en cocina donde se manipulan frutos secos."

5. **¿Los precios se muestran con IVA incluido? ¿Qué tipo de IVA aplica a cada producto?**
   El tipo de IVA aplicable a productos elaborados de origen animal puede variar. Confirmar con asesoría fiscal qué tipo aplica a cada familia de producto. Esto afecta a cómo se muestran los precios y al desglose en el email de confirmación.

6. ✅ **¿Se cobran gastos de envío?** — **RESUELTO:** 10€ para pedidos con subtotal < 150€; gratis para pedidos con subtotal ≥ 150€. Lógica implementada en el backend.

7. ✅ **¿A qué email deben llegar los emails internos de nuevos pedidos?** — **RESUELTO:** `elbueymaduradoxativa@gmail.com`

8. **¿Quién tendrá acceso al panel admin y desde qué dispositivo (ordenador / móvil)?**
   Si es principalmente móvil, el diseño del panel admin debe priorizarse para pantalla pequeña.

9. **¿Tienen contratado o en trámite el TPV Virtual con su banco?**
   Es necesario contactar con el banco para contratar el servicio TPV Virtual (Redsys). El banco proveerá el FUC (código de comercio), número de terminal y clave secreta. El tiempo de activación varía según el banco (habitual: 3–7 días hábiles).

10. **¿Tienen textos legales preparados?**
    Política de privacidad, condiciones de venta (con mención al derecho de desistimiento limitado para perecederos según Art. 103.d TRLGCU), política de envíos y política de devoluciones. Sin estos textos no se puede lanzar legalmente.

11. **¿Se quiere activar alguna promoción desde el día del lanzamiento?**
    Si sí:
    - ¿Cuál es el importe mínimo del pedido?
    - ¿Qué producto o variante es el regalo?
    - ¿Tiene stock limitado o es ilimitado?
    - ¿Tiene fecha de fin?

12. **¿Quieren que la tienda pueda pausarse en cierres o vacaciones?**
    - Si sí: ¿qué mensaje debe mostrarse cuando la tienda esté pausada?

13. **¿Las imágenes de los productos ya están preparadas en buena calidad?**
    Este suele ser el cuello de botella más frecuente. Deben estar en formato WebP, optimizadas y con nombres limpios.

14. **¿Qué estados del pedido quieren manejar desde el panel admin?**
    Se propone: `PAID → PREPARING → CANCELLED`. ¿Es suficiente o se necesita alguno más?

15. **¿Se va a vender solo a la Península Ibérica en el lanzamiento?**
    Baleares, Canarias, Ceuta y Melilla tienen complejidad logística adicional para productos cárnicos.

16. **¿Cuántos pedidos al día se esperan al lanzamiento?**
    Relevante para valorar si el panel admin necesita paginación o si la lista simple es suficiente.

---

## 21. Plan de implementación por fases

### Fase 0 — Prerrequisitos (1 semana, sin código)

- [ ] Responder todas las preguntas de la sección anterior
- [ ] Crear proyecto en Supabase (plan Free para desarrollo, Pro para producción)
- [x] Confirmar gastos de envío: 10€ (<150€) / gratis (≥150€)
- [ ] Contactar con el banco para contratar TPV Virtual (Redsys) — obtener FUC, terminal y clave secreta
- [ ] Crear cuenta en Resend (plan Free: 3.000 emails/mes, 100/día)
- [ ] Verificar dominio `restauranteelbueymadurado.com` en Resend (DNS: SPF, DKIM, DMARC en Namecheap)
- [ ] Tener listado definitivo de productos, variantes, precios, stock y alérgenos
- [ ] Rellenar campos de trazabilidad (`ingredients`, `storage_conditions`, etc.) para cada producto
- [ ] Preparar imágenes de todos los productos en WebP (optimizadas)
- [ ] Redactar o encargar textos legales (política de privacidad, condiciones, envíos, devoluciones)
- [ ] Confirmar tipo de IVA con asesoría fiscal
- [ ] Confirmar si habrá promoción activa en el lanzamiento

---

### Fase 1 — Base de datos y Storage (2–3 días)

> Nota: la Fase 1 ya fue ejecutada en desarrollo mediante las migraciones 0001–0008. Este checklist se mantiene como referencia del alcance técnico.

- [ ] Instalar `@supabase/supabase-js` y Supabase CLI
- [ ] Inicializar proyecto local con `supabase init` y vincular al proyecto remoto con `supabase link`
- [ ] Escribir migración SQL inicial (`supabase/migrations/0001_initial_schema.sql`) con todas las tablas: `categories`, `products` (con `allergens`, `allergens_notes`, `ingredients`, `storage_conditions`, `prep_instructions`, `cooking_method`), `product_variants`, `product_images`, `promotions`, `shop_settings`, `orders` (con `redsys_ds_order`), `order_items` (con snapshots de alérgenos), `payments` (con campos Redsys), `order_status_history`
- [ ] Escribir migración de función RPC (`supabase/migrations/0002_rpc_decrement_stock.sql`)
- [ ] Escribir migración de etiquetas y Redsys (`supabase/migrations/0003_product_labels.sql`): tabla `product_labels`, trigger, función `generate_redsys_ds_order`, secuencia `redsys_order_seq`, job de pg_cron para retención 6 meses
- [ ] Habilitar extensión `pg_cron` desde Supabase Dashboard → Extensions
- [ ] Aplicar migraciones con `supabase db push`
- [ ] Generar tipos TypeScript con `supabase gen types typescript --linked > src/supabase/types.ts`
- [ ] Crear `src/lib/supabase.ts` (cliente público con ANON_KEY) y `src/lib/supabase-admin.ts` (cliente servidor con SERVICE_ROLE_KEY)
- [ ] Crear bucket `product-images` en Supabase Storage con política pública de lectura
- [ ] Configurar RLS en todas las tablas según la política definida en la sección de seguridad
- [ ] Insertar datos iniciales: categorías, productos, variantes, imágenes, alérgenos, stock
- [ ] Crear fila inicial en `shop_settings` (`accepting_orders: true`)
- [ ] Crear promoción inicial en `promotions` si aplica (con `is_active: false` hasta que se confirme)
- [ ] Subir imágenes al bucket con la estructura de carpetas correcta
- [ ] Verificar lectura del catálogo completo desde una API Route de prueba

---

### Fase 2 — Catálogo público (3–4 días)

- [ ] Añadir dominio de Supabase Storage en `next.config.ts`
- [ ] Página `/tienda` — landing con categorías y productos destacados
- [ ] Página `/tienda/[categoria]` — listado de productos de una categoría
- [ ] Página `/tienda/producto/[slug]` — ficha con galería, variantes, stock y alérgenos
- [ ] Componentes: `ProductCard`, `ProductGrid`, `VariantSelector`, `ProductImageGallery`, `AllergensBadge`
- [ ] Lógica de "Agotado" cuando `stock = 0`
- [ ] Visualización de alérgenos en la ficha de producto
- [ ] Leer `shop_settings` y mostrar `notice_message` si aplica (banner informativo)
- [ ] Añadir enlace "Tienda" en el Navbar (puede estar oculto hasta el lanzamiento)

---

### Fase 3 — Carrito (2–3 días)

- [ ] `CartContext` con React Context
- [ ] Persistencia en localStorage
- [ ] Añadir/eliminar productos y cambiar cantidades
- [ ] Página `/carrito` con listado y subtotal
- [ ] Endpoint `GET /api/tienda/promocion-activa`
- [ ] Lógica de promoción en el frontend: mensajes informativos y regalo visible
- [ ] Banner de tienda pausada si `accepting_orders = false`
- [ ] Contador de productos en el Navbar
- [ ] Cálculo de gastos de envío (fijo o por importe mínimo)
- [ ] Aviso si algún producto del carrito contiene alérgenos

---

### Fase 4 — Checkout y Redsys (4–5 días)

- [ ] Instalar `redsys-easy`
- [ ] Crear `src/lib/redsys.ts` con instancia configurada
- [ ] Página `/checkout` con formulario validado (Zod en cliente)
- [ ] Deshabilitar botón de pago si `accepting_orders = false`
- [ ] API Route `POST /api/checkout/create-session`:
  - [ ] Validación con Zod en backend
  - [ ] Verificación de `accepting_orders` como primer paso
  - [ ] Lectura de precios reales desde BD
  - [ ] Cálculo real del subtotal y gastos de envío (10€ / gratis ≥150€)
  - [ ] Evaluación y aplicación de promoción
  - [ ] Verificación de stock
  - [ ] Copia de snapshots de producto, variante, precio y alérgenos en `order_items`
  - [ ] Creación de pedido `PENDING_PAYMENT`
  - [ ] Generación de `redsys_ds_order` via RPC `generate_redsys_ds_order()`
  - [ ] Generación de payload Redsys (Ds_MerchantParameters + Ds_Signature)
  - [ ] Registro de eventos en histórico (`REDSYS_PAYLOAD_GENERADO`)
  - [ ] Devolver `{ url, body }` al frontend para auto-submit del form
- [ ] Componente de auto-submit del form de Redsys en el frontend
- [ ] Página `/pedido/confirmacion` con polling de estado
- [ ] Endpoint `GET /api/pedidos/estado?order_number=BM-2026-00001`

---

### Fase 5 — Notificación y stock (2–3 días)

- [ ] API Route `POST /api/pagos/notificacion`:
  - [ ] Verificación de firma HMAC-SHA256 con `redsys.processRestNotification()`
  - [ ] Buscar pedido por `redsys_ds_order`
  - [ ] Idempotencia (verificar estado antes de procesar)
  - [ ] Gestión de pago denegado (Ds_Response fuera de 0000–0099)
  - [ ] Transacción atómica de descuento de stock (RPC `decrement_stock_and_confirm_order`)
  - [ ] Manejo de `STOCK_ERROR` (rollback, actualizar estado, registrar en histórico)
  - [ ] Actualización de `orders` a `PAID`
  - [ ] Creación de registro en `payments` (con `redsys_ds_response`, `redsys_authorization`)
  - [ ] Registro de todos los eventos en `order_status_history`
  - [ ] Siempre devolver 200 a Redsys (salvo firma inválida)
- [ ] Pruebas con entorno SIS-T (tarjeta de prueba `4548812049400004`, CVV `123`)
- [ ] Para probar en local: configurar ngrok y usar la URL pública como `NEXT_PUBLIC_BASE_URL` temporalmente

---

### Fase 6 — Emails (1–2 días)

- [ ] Instalar `resend` y `@react-email/components`
- [ ] Plantilla email confirmación al cliente (con alérgenos y regalo si aplica)
- [ ] Plantilla email interno al restaurante (con alérgenos y regalo si aplica)
- [ ] Integrar envío en el handler de notificación dentro de try/catch (no propaga errores)
- [ ] Registro de `EMAIL_CLIENTE_ENVIADO/ERROR` y `EMAIL_INTERNO_ENVIADO/ERROR` en histórico
- [ ] Prueba de emails en staging con bandejas reales

---

### Fase 7 — Panel admin (2–3 días)

- [ ] Middleware de autenticación en `src/middleware.ts`
- [ ] Página `/admin/login` con formulario
- [ ] API Route `POST /api/admin/auth` — login con cookie `httpOnly`
- [ ] API Route `POST /api/admin/logout`
- [ ] Página `/admin/pedidos` — listado con badges de estado y filtro
- [ ] Página `/admin/pedidos/[id]` — detalle completo:
  - [ ] Productos a preparar con alérgenos del snapshot
  - [ ] Regalo marcado visualmente si es `item_type: GIFT`
  - [ ] Datos del cliente y dirección
  - [ ] Observaciones del cliente
  - [ ] Notas internas (textarea + guardar)
  - [ ] Cambio de estado (dropdown con transiciones permitidas)
  - [ ] Timeline del histórico de eventos
- [ ] API Route `PATCH /api/admin/pedidos/[id]/estado`
- [ ] API Route `PATCH /api/admin/pedidos/[id]/notas`

---

### Fase 8 — Pruebas y lanzamiento (3–4 días)

- [ ] Ver [Sección 22 — Plan de pruebas](#22-plan-de-pruebas-antes-de-lanzamiento)
- [ ] Obtener credenciales de producción del TPV Virtual del banco (FUC, terminal, clave secreta)
- [ ] Actualizar variables de entorno en Vercel: `REDSYS_MERCHANT_CODE`, `REDSYS_TERMINAL`, `REDSYS_SECRET_KEY`, `REDSYS_ENVIRONMENT=production`
- [ ] Verificar que la URL de notificación (`/api/pagos/notificacion`) es accesible públicamente desde Redsys
- [ ] Configurar todas las variables de entorno de producción en Vercel
- [ ] Verificar dominio de Resend activo (DNS propagado)
- [ ] Activar Supabase Pro para producción
- [ ] Verificar páginas legales publicadas y enlazadas en footer y checkout
- [ ] Compra real de prueba con importe real (€1)
- [ ] Deploy final a producción

---

## 22. Plan de pruebas antes de lanzamiento

### Flujo principal

- [ ] Compra exitosa completa: catálogo → ficha → carrito → checkout → Redsys (SIS-T) → confirmación → email al cliente → email al restaurante → pedido en admin
- [ ] El número de pedido es único y tiene el formato correcto (BM-2026-00001)
- [ ] Los snapshots del pedido reflejan los datos del producto en el momento de la compra

### Pago y notificación

- [ ] Pago exitoso con tarjeta de prueba de Redsys SIS-T (pan `4548812049400004`, CVV `123`)
- [ ] Pago denegado (mismo pan, CVV `999`, o importe en céntimos terminado en `96`)
- [ ] Cancelación: el cliente cancela en la página de Redsys y vuelve a `/carrito?pago=fallido`
- [ ] El pedido no pasa a PAID por el redirect de URL_OK — solo por la notificación online
- [ ] La notificación es idempotente: si Redsys la envía dos veces, el estado no cambia en el segundo intento
- [ ] La notificación funciona correctamente desplegada en Vercel (la URL debe ser pública — no funciona en localhost sin ngrok)

### Stock

- [ ] Variante con stock = 0 aparece como "Agotado" en la ficha de producto
- [ ] Si se intenta hacer checkout con una variante sin stock, el backend devuelve error 409
- [ ] El stock se descuenta correctamente después del pago confirmado
- [ ] Prueba de stock concurrente: dos usuarios compran la última unidad simultáneamente — solo uno debería completarse, el otro debería resultar en STOCK_ERROR

### Promoción

- [ ] La promoción se muestra correctamente en el carrito cuando el subtotal la activa
- [ ] "Te faltan X€" se calcula correctamente cuando el subtotal no la activa
- [ ] El backend aplica la promoción aunque el frontend no la haya enviado
- [ ] El backend NO aplica la promoción aunque el frontend la haya enviado si el subtotal real no la activa
- [ ] El regalo aparece en `order_items` con `item_type: GIFT` y precio 0
- [ ] El regalo aparece en el email al cliente y en el email al restaurante
- [ ] El regalo aparece en el panel admin con marca visual de "REGALO PROMO"
- [ ] El stock del regalo se descuenta correctamente
- [ ] Si el regalo no tiene stock, la promoción no se aplica y el pedido continúa sin regalo

### Alérgenos

- [ ] Los alérgenos se muestran en la ficha de producto
- [ ] Los alérgenos se copian correctamente como snapshot en `order_items` al crear el pedido
- [ ] Si se modifica un producto en Supabase Studio, el pedido anterior conserva los alérgenos del snapshot
- [ ] Los alérgenos aparecen en el email al cliente
- [ ] Los alérgenos aparecen en el email al restaurante
- [ ] Los alérgenos del snapshot se muestran en el detalle de pedido en el panel admin

### Pausa de tienda

- [ ] Con `accepting_orders = false`: el checkout está bloqueado en frontend (botón desactivado)
- [ ] Con `accepting_orders = false`: el backend devuelve 503 si alguien llama a create-session directamente
- [ ] El mensaje `checkout_disabled_message` se muestra correctamente
- [ ] El catálogo sigue siendo visible con la tienda pausada
- [ ] Con `accepting_orders = true` y `notice_message`: se muestra el banner informativo pero el checkout funciona

### Panel admin

- [ ] El login funciona y genera cookie correctamente
- [ ] Las rutas `/admin/*` son inaccesibles sin cookie válida
- [ ] El listado de pedidos muestra todos los pedidos correctamente
- [ ] El detalle de pedido muestra todos los datos del snapshot (no los actuales del producto)
- [ ] El cambio de estado funciona y registra evento en el histórico
- [ ] Las notas internas se guardan correctamente
- [ ] El timeline del histórico refleja todos los eventos del pedido en orden cronológico

### Emails

- [ ] El email al cliente llega a la bandeja correcta con el formato esperado
- [ ] El email al restaurante llega con todos los datos necesarios para preparar el pedido
- [ ] Si Resend falla, el handler devuelve 200 a Redsys igualmente y el pedido queda creado
- [ ] Los errores de email quedan registrados en `order_status_history`

### Variables de entorno y configuración

- [ ] Todas las variables de entorno están configuradas en Vercel (producción)
- [ ] `REDSYS_ENVIRONMENT=production` en Vercel (cambiar de `test` a `production`)
- [ ] Las credenciales de producción del TPV Virtual (`REDSYS_MERCHANT_CODE`, `REDSYS_TERMINAL`, `REDSYS_SECRET_KEY`) son distintas a las de test
- [ ] La URL de notificación pública (`/api/pagos/notificacion`) responde correctamente desde internet
- [ ] Supabase Pro está activo en producción

---

## 23. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| **Notificación de Redsys no llega o se reintenta** | Baja | Alto | Handler idempotente: verificar `status = PAID` antes de actuar. Redsys reintenta hasta 3 veces |
| **Notificación duplicada procesa el pedido dos veces** | Baja | Alto | Idempotencia: si el pedido ya está en `PAID`, salir inmediatamente sin hacer nada |
| **Pago confirmado pero email falla** | Baja-Media | Medio | Email en try/catch que no propaga el error. El pedido queda en BD y visible en admin. Registrar `EMAIL_CLIENTE_ERROR` en histórico |
| **Overselling por pedidos simultáneos** | Baja | Medio | Transacción atómica con `SELECT FOR UPDATE` en la notificación. El segundo pedido recibirá `STOCK_ERROR` |
| **Promoción agotada o sin stock del regalo** | Baja | Bajo | El pedido continúa normalmente sin regalo. No se genera ningún error ni estado anómalo. Se registra `PROMOCION_NO_APLICADA` en el histórico. El restaurante lo ve en el panel si quiere gestionar algo manualmente |
| **Tienda pausada solo en frontend pero no en backend** | Media (error de impl.) | Medio | Siempre verificar `accepting_orders` como primer paso en `create-session`. La validación backend es la definitiva |
| **Variables de entorno mal configuradas en Vercel** | Alta (error humano) | Alto | Checklist explícito antes del deploy. Sin `REDSYS_SECRET_KEY`, el checkout no funciona. Sin `RESEND_API_KEY`, no hay emails |
| **Notificación de Redsys no llega en producción** | Media (setup) | Alto | Verificar que la URL `/api/pagos/notificacion` es HTTPS pública y responde 200. La URL debe coincidir exactamente con la enviada en `DS_MERCHANT_MERCHANTURL` |
| **Permisos de Supabase mal configurados** | Media (setup) | Alto | Verificar RLS en staging: el cliente no puede acceder a `orders` con la `ANON_KEY` |
| **Imágenes pesadas o mal subidas** | Media | Bajo | Pautas claras antes de subir: WebP < 300 KB. Verificar carga en la ficha de producto antes de lanzar |
| **Datos de dirección incorrectos** | Alta | Medio | Validar CP (5 dígitos numéricos), campos obligatorios. Resumen visible de dirección antes de pagar. El teléfono del cliente permite resolver incidencias |
| **IVA mal configurado** | Baja si se verifica | Alto (legal) | Confirmar tipo de IVA con asesoría fiscal antes de mostrar precios al público |
| **Textos legales no preparados en el lanzamiento** | Alta | Alto (legal) | Sin política de privacidad, condiciones de venta y política de devoluciones no se puede lanzar una tienda online en España |
| **Retraso en la activación del TPV Virtual** | Media | Alto si bloquea el lanzamiento | Contactar con el banco con suficiente antelación (habitual: 3–7 días hábiles). Sin TPV activo no hay checkout |
| **Alérgenos mal informados o incompletos** | Media | Alto (legal y sanitario) | Revisar con el equipo del restaurante cada producto antes de lanzar. Los alérgenos de declaración obligatoria están regulados por el Reglamento EU 1169/2011 |
| **Alérgenos cambiados posteriormente sin snapshot** | — | Alto | El snapshot en `order_items` (`allergens_snapshot`, `allergens_notes_snapshot`) garantiza que los pedidos históricos conservan la información original aunque el producto se modifique |
| **Pedido en PENDING_PAYMENT sin notificación** | Baja | Bajo | Si el cliente paga pero la notificación no llega (raro), el pedido queda en `PENDING_PAYMENT`. El admin puede revisarlo manualmente. Redsys reintenta hasta 3 veces |

---

## 24. Próximas decisiones

Antes de comenzar el desarrollo, deben quedar cerradas las siguientes decisiones. Están ordenadas por urgencia:

### Urgentes (bloquean el inicio del desarrollo)

1. **Listado definitivo de productos, variantes y precios** — Necesario para crear el seed de datos y las primeras imágenes.
2. **Tipo de IVA aplicable a cada producto** — Requiere confirmación con asesoría fiscal antes de mostrar precios al público.
3. **Alérgenos e ingredientes de cada producto** — Necesario para la tabla `products`, para el email de confirmación y para las etiquetas de trazabilidad.
4. ✅ **Gastos de envío** — **RESUELTO:** 10€ para subtotal < 150€ / gratis para subtotal ≥ 150€.
5. ✅ **Email de recepción de pedidos** — **RESUELTO:** `elbueymaduradoxativa@gmail.com`

### Importantes (bloquean el lanzamiento)

6. **Textos legales** — Política de privacidad, condiciones de venta, política de envíos y devoluciones. Pueden requerir redacción por parte de una asesoría.
7. **Contratación del TPV Virtual con el banco** — Solicitar con suficiente antelación (habitual: 3–7 días hábiles). El banco proporcionará FUC, terminal y clave secreta para producción.
8. **Imágenes de productos** — En formato WebP, optimizadas y con nombres limpios. Suelen ser el cuello de botella más frecuente.

### Deseables (no bloquean el inicio pero deben cerrarse en la Fase 0)

9. **Promoción inicial** — ¿Se lanza con alguna promoción activa? Si sí, definir umbral, producto de regalo, fechas y stock.
10. **Mensaje de tienda pausada** — ¿Qué texto debe mostrarse cuando la tienda no acepta pedidos?
11. **Dispositivo del admin** — ¿El panel admin se usará principalmente desde ordenador o móvil? Condiciona el diseño del panel.
12. **Zonas de envío** — ¿Solo Península en el lanzamiento? ¿Se incluye Baleares? Las Islas Canarias, Ceuta y Melilla tienen complejidades aduaneras adicionales para productos cárnicos.

### Para v2 (no deben afectar las decisiones del MVP)

- Cuentas de usuario y área cliente
- Integración con API de transportistas y tracking
- Facturación automática
- Múltiples métodos de pago (Bizum, transferencia)
- Panel de administración de productos dentro de la web
- Emails de seguimiento de envío
- Analytics de tienda (conversión, abandono de carrito)
- Expansión a nuevas zonas geográficas

---

*Documento actualizado en Junio 2026 (v1.1). Cualquier cambio de decisión posterior debe quedar reflejado en este documento antes de implementarlo.*

---

## 25. Datos de seed de desarrollo

Estos datos sirven de punto de partida para el entorno de desarrollo. Los precios son **placeholder** — deben sustituirse por los precios reales antes del lanzamiento. Los alérgenos están marcados como ilustrativos. Las imágenes de `product_images` (corregidas en `supabase/migrations/20260704113438_fix_seed_product_images_placeholder.sql`) apuntan a 5 fotos genéricas de carne compartidas entre los 10 productos — deben sustituirse por fotografía real por producto antes del lanzamiento.

### Categorías (4)

| slug | name | sort_order |
|------|------|-----------|
| `packs-carne-madurada` | Packs de Carne Madurada | 1 |
| `hamburguesas` | Hamburguesas Artesanas | 2 |
| `croquetas` | Croquetas | 3 |
| `gourmet` | Productos Gourmet | 4 |

### Productos (10) con variantes

**Categoría: Packs de Carne Madurada**

| slug | name | variantes (nombre → precio placeholder) | allergens |
|------|------|----------------------------------------|-----------|
| `chuleton-vaca-madurada` | Chuletón de Vaca Madurada | 1 kg → 4500 / 1,5 kg → 6500 / 2 kg → 8500 | `[]` |
| `tomahawk-madurado` | Tomahawk Madurado | Unidad ~1,2 kg → 5500 | `[]` |
| `entrecot-madurado` | Entrecot Madurado | 400 g → 2200 / 800 g → 4000 | `[]` |
| `pack-degustacion-madurado` | Pack Degustación Madurado | Único → 9900 | `[]` |

**Categoría: Hamburguesas Artesanas**

| slug | name | variantes | allergens |
|------|------|-----------|-----------|
| `burger-wagyu` | Burger Wagyu Artesana | Pack 4 uds. → 2200 / Pack 8 uds. → 4000 | `["gluten","huevo","leche"]` |
| `burger-angus` | Burger Angus Artesana | Pack 4 uds. → 1800 / Pack 8 uds. → 3200 | `["gluten","huevo"]` |

**Categoría: Croquetas**

| slug | name | variantes | allergens |
|------|------|-----------|-----------|
| `croquetas-jamon-iberico` | Croquetas de Jamón Ibérico | Caja 12 uds. → 1400 / Caja 24 uds. → 2600 | `["gluten","leche","huevo"]` |
| `croquetas-boletus` | Croquetas de Boletus | Caja 12 uds. → 1300 | `["gluten","leche","huevo"]` |

**Categoría: Productos Gourmet**

| slug | name | variantes | allergens |
|------|------|-----------|-----------|
| `salsa-chimichurri` | Salsa Chimichurri Artesana | Tarro 200 ml → 900 | `[]` |
| `pack-gourmet-el-buey` | Pack Gourmet El Buey | Pack básico → 8900 | `["gluten","leche","huevo"]` |

> **Precios en céntimos.** Stock inicial sugerido: 20 uds. para productos de carne, 30–40 uds. para croquetas y salsas.

### Promoción placeholder

```sql
-- is_active: false — activar manualmente desde Supabase Studio cuando se confirme
name:            "Burger Wagyu de regalo en pedidos +100€"
type:            "GIFT_PRODUCT"
min_subtotal:    10000          -- 100€ en céntimos
gift_variant_id: (UUID del "Burger Wagyu Artesana — Pack 4 uds.")
is_active:       false
max_redemptions: 10
```

> El umbral `+100€` es placeholder de desarrollo para mantener el seed actual sincronizado con esta sección. El umbral final de promoción queda pendiente de decisión de negocio antes del lanzamiento.

### Ejemplo de etiqueta de trazabilidad

```
order_item_id:      (UUID de la línea de Chuletón 1kg del pedido BM-2026-00001)
product_id:         (UUID de chuleton-vaca-madurada)
lote:               L260611-chuleton-vaca-madurada
product_name:       Chuletón de Vaca Madurada
ingredients:        (rellenar con el restaurante)
allergens:          []
storage_conditions: Conservar entre 0°C y 4°C
prep_instructions:  Sacar de la nevera 30 min antes de cocinar
cooking_method:     Cocinar a la brasa o plancha muy caliente
weight_grams:       1000
elaboration_date:   (rellenar manualmente)
expiry_date:        (rellenar manualmente — nunca calculada automáticamente)
```

### shop_settings inicial

```sql
accepting_orders:          true
notice_message:            NULL
checkout_disabled_message: NULL
```

---

## Changelog

### v1.1 — Junio 2026

- **Pasarela de pago:** Stripe reemplazado por Redsys TPV Virtual en todo el documento. Sección 15 reescrita. Variables de entorno actualizadas.
- **Gastos de envío cerrados:** 10€ para pedidos con subtotal < 150€; gratis para subtotal ≥ 150€.
- **IVA:** Eliminada la referencia incorrecta al 5% IVA superreducido. Pendiente confirmación con asesoría fiscal.
- **Dominio y emails:** `restauranteelbueymadurado.com`, admin `elbueymaduradoxativa@gmail.com`, remitente `pedidos@restauranteelbueymadurado.com`.
- **Pausa de tienda:** Eliminado el ejemplo de "Miércoles sin envíos" de la tabla de casos de uso.
- **Etiquetas de trazabilidad (sección 11bis):** Nuevos campos `ingredients`, `storage_conditions`, `prep_instructions`, `cooking_method` en `products`. Nueva tabla `product_labels` con trigger de pre-relleno y retención de 6 meses via pg_cron. Integración en el panel admin. Eliminado de "Fuera de alcance".
- **Decisiones resueltas:** Gastos de envío (sección 20 Q6) y email de notificación (sección 20 Q7) marcados como resueltos en secciones 20 y 24.
- **Seed de desarrollo (sección 25):** 10 productos en 4 categorías, promoción placeholder, ejemplo de etiqueta.

### v1.0 — Junio 2026

- Versión inicial del documento técnico.
