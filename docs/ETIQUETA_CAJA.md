# Etiqueta de caja — Qian Anjet 80 Ultra

Independiente de `FOOD_LABELING_ENABLED`, que permanece en `false`.

## Activación

Aplicar mediante el procedimiento habitual la migración pendiente
`supabase/migrations/20261104090000_0022_order_box_labels.sql` antes de usar
esta función. No se ha ejecutado desde este trabajo. Añade una tabla,
sin modificar pedidos, stock, pagos, etiquetas alimentarias ni tareas de limpieza.
No necesita nuevas variables de entorno: firma borradores con el secreto
administrativo existente y una audiencia JWT distinta de la sesión.

El acceso «Etiqueta de caja» aparece en pedidos `PAID` y `PREPARING`.
Ruta: `/admin/pedidos/[id]/etiqueta-caja`. Una copia ya confirmada puede
consultarse y reimprimirse también si el estado cambió después.

## Flujo y conservación

Abrir la vista previa solo lee datos y firma una copia temporal (8 horas),
vinculada al pedido, nombre del trabajador y sesión. Los nombres y cantidades
proceden de `order_items`; no del catálogo. El logo existente de Cloudinary
(`Logo-Buey_t9mc4b`) se conserva en `logo-buey-ticket-source.png` (767 × 763 px)
y la descarga antigua de 240 px en `logo-buey-ticket.png`, dentro de
`public/assets/images/`.

Las nuevas copias incorporan `logo-buey-thermal.png`: 224 × 224 puntos, paleta
de 1 bit, blanco y negro opacos, para imprimir a 28 mm y 8 puntos/mm (203 dpi).
Se obtiene con `node scripts/prepare-box-label-logo.mjs`, sin red, a partir del
original. Se eliminan grises y transparencias después de reducir a la resolución
útil, sin dilatar todos los trazos ni aumentar la densidad de la impresora.
En las copias antiguas se prepara la misma representación térmica en memoria a
partir del logo de su snapshot. No se reescribe la copia, ni se cambia el nombre
del trabajador, ni se sustituye su contenido por datos actuales.

Los regalos ordinarios se incluyen por defecto. Los afectados por la incidencia
existente `SIN_STOCK_REGALO_EN_CONFIRMACION` aparecen desmarcados con un aviso.
El trabajador selecciona solo los realmente embalados y actualiza la vista
previa antes de imprimir. Esto no resuelve ni borra la incidencia ni cancela la
obligación de entrega. `AGOTADA` y `REGALO_ENTREGADO_SIN_CANJE_CONTADO` no excluyen
un regalo entregado. La copia confirmada congela la selección; no hay distribución
entre cajas ni un nuevo sistema de incidencias.

El botón Imprimir imprime únicamente el documento del iframe. No se guarda nada
por abrir/cerrar/cancelar el diálogo. La primera confirmación explícita envía la
copia firmada, sin reconstruirla a partir de datos actuales. La PK por pedido
decide la primera confirmación; INSERT únicamente, nunca UPSERT. Repetir la misma
petición es idempotente. Una copia distinta concurrente recibe 409 y debe recargar
la ganadora antes de reimprimir. Ante un error de red puede reintentarse la misma
confirmación. Tras caducar el borrador hay que recargar e imprimir de nuevo si
todavía no se confirmó.

La tabla guarda copia, ID de borrador, sesión confirmante y fecha. Contiene
referencia, líneas, trabajador y bytes del logo; no datos personales del cliente.
RLS sin políticas públicas y privilegios SELECT/INSERT para service_role.
Las reimpresiones muestran la copia original, incluido el trabajador original;
confirmarlas en pantalla no crea otra copia ni cambia el pedido.

## Espacio vertical y papel POS-80-Series

El código anterior solicitaba con `@page` tamaños cortos, distintos del formulario
del controlador. Chrome puede centrar esa caja sobre una hoja mayor. Se reprodujo
en PDF con dos productos: el logo quedaba a unos 64 mm del borde superior al
seleccionar 80 × 210 mm. Con `@page { size: auto; margin: 0; }` se respeta el papel
seleccionado y el logo comienza a unos 2 mm en todas las páginas. Véase la
[colocación de cajas de página en la especificación CSS](https://www.w3.org/TR/css-page-3/#positioning-page-box).

El iframe conserva sus propios estilos. `html`, `body` y las páginas fluyen desde
arriba, sin altura de pantalla, centrado vertical ni altura mínima de impresión.
Las alturas mínimas y separación entre hojas solo se usan en la previsualización
en pantalla. La altura útil se calcula con las medidas reales de cabecera, logo,
filas, pie, padding y márgenes, más 1 mm de seguridad para redondeos.

La consulta de solo lectura del controlador instalado reveló otro detalle:
`Thermal Paper(80 x 210)` y los demás formularios de 80 mm anuncian **72,1 mm de
ancho lógico** a Windows. El valor predeterminado consultado era
`Thermal Paper(80 x 297)`, vertical y 203 dpi, aunque el navegador de la captura
estaba usando 80 × 210. No se han cambiado estas preferencias ni enviado trabajos.
El documento usa una zona de 72 mm con 2 mm de margen lateral, conservando
**68 mm de contenido**. Se centra horizontalmente si recibe una hoja de 80 mm;
también cabe al 100 % cuando recibe los 72,1 mm lógicos del controlador.

En el navegador:

- Destino **POS-80-Series** y papel **Thermal Paper (80 × 210)**.
- Orientación **Vertical** y **1 página por hoja**.
- Márgenes **Ninguno**, escala **Personalizada: 100 %**.
- **Encabezado y pie de página desactivado**. No hace falta activar gráficos de
  fondo: el logo es una imagen opaca y se valida también sin fondos.
- No seleccionar A4, «Ajustar a página» ni la escala «Predeterminado».

En Windows, abrir **POS-80-Series → Preferencias de impresión → Avanzadas**
(o el apartado de papel equivalente del controlador):

- Elegir **Thermal Paper(80 x 210)** también aquí, en lugar del predeterminado
  **Thermal Paper(80 x 297)**; orientación vertical y resolución **203 dpi**.
- No aumentar la densidad global para compensar el logo.
- Mantener el rollo de **80 mm**. Que el controlador comunique unos 72,1 mm útiles
  no significa que haya que seleccionar otro rollo ni reducir la escala.

En la aplicación:

- **Ajustar al contenido**, máximo **210 mm** por defecto: calcula e indica la
  longitud necesaria; no solicita una página CSS corta que pueda quedar centrada
  sobre 210 mm. El papel físico sigue siendo el seleccionado en el diálogo.
- Si el controlador permite formularios personalizados, crear **80 × L mm**,
  siendo L la longitud calculada (para varias hojas, usar la mayor), seleccionarlo
  también en el navegador y poner L como máximo en la aplicación. No usar un
  papel menor que ese máximo al imprimir pedidos extensos.
- **Páginas de longitud fija: 210 mm**: usar con el formulario 80 × 210.
  Las continuaciones se calculan para esa longitud. Si se elige otro formulario
  fijo de 80 × L, poner también L en la aplicación.
- Si el controlador solo ofrece 80 × 210, un ticket corto dejará papel sobrante
  **después** del contenido. Quitar ese avance exige un formulario más corto o
  una opción de longitud/avance del controlador; CSS no controla el corte físico.
- Los pedidos extensos se dividen en continuaciones numeradas, repitiendo pedido
  y trabajador. Un ticket de una sola hoja no muestra «Página 1 de 1» ni reserva
  espacio para ese contador. Incluso un nombre mayor que una página se divide sin truncarlo
  ni reducir la letra. Cambiar la longitud máxima vuelve a calcular la paginación.

Se prepara el PNG térmico, se confirma el render del portal y se espera su
decodificación y `document.fonts.ready`, seguidas de dos cuadros de renderizado,
antes de medir. Después de paginar se confirma y espera de nuevo el documento
actualizado, incluidos los logos de continuación, y se comprueba que el pie cabe.
La misma comprobación se repite antes de abrir el diálogo. El botón no se habilita
para una paginación o un logo anteriores.

## Comprobación física pendiente

Validación automática: `npm test`, `npx tsc --noEmit --incremental false` y
`npm run build`. La prueba opcional `npm run test:box-label-browser` usa Chrome
instalado (ruta alternativa mediante `CHROME_PATH`) y datos ficticios. Levanta
un servidor efímero de fixtures en localhost:3108; no es un servicio de impresión,
no usa credenciales ni consulta Supabase. Comprueba el componente real, espera
de recursos, selección de regalos, cancelación/confirmación y reimpresión sin
escrituras adicionales; exporta PDFs y capturas a un directorio temporal.

Se ha comprobado con Chrome: dos productos (contenido de 84 mm), regalo, longitud
fija de 210 mm, reimpresión con el logo antiguo, trabajador de nombre largo y caso
extremo de 90 líneas con un nombre de miles de caracteres, repartido en 24 páginas.
Además de los tamaños de contenido, cada caso se imprime en PDF con papel físico
emulado de **80 × 210** y ancho lógico de **72,1 × 210**, escala 1, sin márgenes y sin fondos. Se analizan las
matrices del PDF para verificar que el logo de cada página comienza a unos 2 mm,
sin centrado vertical. Se verifican texto completo, ausencia de recortes,
encabezados numerados (también en el modo fijo con varias páginas), carga del documento al llamar a imprimir, logo sin alfa
ni grises, y ausencia de páginas extra. Esto no equivale a probar el controlador
Windows ni la impresora física.
La persistencia y concurrencia se prueban con una base simulada; la migración
debe validarse en el entorno de base de datos elegido antes del uso real.

Probar en la Qian real: ancho/centrado a 100 %, densidad y legibilidad del logo,
nombre largo, regalo, varias continuaciones, longitud personalizada y modo fijo.
Comprobar márgenes mínimos del controlador y alimentación entre páginas.
No se han validado corte automático ni compatibilidad con papel adhesivo.
La aplicación no envía ESC/POS ni requiere un servicio local de impresión.

Referencias técnicas: [ficha del fabricante](https://fichas.qian.mx/QTP-BTWF-01.pdf),
[tamaños de página CSS](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@page/size),
[fuentes del documento](https://developer.mozilla.org/en-US/docs/Web/API/Document/fonts).
