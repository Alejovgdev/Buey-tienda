# Integración local del restaurante — 4 de noviembre de 2026

Rama: `integracion/restaurante-20261104`. Sin commits que mezclen trabajo previo,
sin push, despliegues ni modificaciones de servicios remotos.

## Alcance aprobado e implementado

- Home del restaurante: galería responsive, promoción de La Navarra, vídeo,
  póster y bloque de contacto. Se conserva la altura adaptable del mapa de la
  tienda en PC y su bloqueo por consentimiento.
- Carta íntegra del origen: 101 fichas, seis categorías, agrupaciones,
  precios y textos originales, incluidos kebabs. Sus posiciones se calculan
  con la altura del navbar de la tienda y la altura real de las categorías.
- Imágenes WebP y encuadres del restaurante, museo y equipo. En Descuentos
  solo cambia la imagen de fondo; sus textos y formulario siguen iguales.
- Manifest, iconos, aviso e instrucciones de instalación existentes. El aviso
  solo se monta en `/`, `/carta`, `/reservas`, `/sobre-nosotros`, `/contacto`
  y `/sorteo`; se desmonta al salir de esas rutas. No hay service worker,
  funciones offline ni nuevas cachés de compra o datos privados.

El vídeo del origen se incorpora como `/hero-restaurante.mp4`. El anterior
`/hero.mp4` permanece intacto. Las opciones de los componentes compartidos
limitan las novedades del Home a Inicio: Contacto conserva vídeo, promoción
y bloque de contacto anteriores. La firma del footer conserva su recurso
anterior; solo la firma incorporada al Home usa WebP.

Navbar, menú, contador, footer, cookies, analítica, textos legales,
dependencias, configuración de seguridad, middleware y todos los archivos de
compra, pagos, stock, pedidos, sesiones y etiquetas se conservan. El
etiquetado alimentario permanece desactivado. La carta es independiente de
Supabase y del catálogo comercial.

## Punto recuperable y trabajo preexistente

Respaldo verificado antes de los cambios:
`.integration-backup.local/2026-11-04T19-05-15-999Z/`.

Contiene `worktree/`, con los archivos previos de trabajo, `state.json`, con
HEAD, rama, estado y hashes, y los parches staged/unstaged. Se excluyeron
Git, node_modules, .next y el propio directorio de respaldos de la copia de
trabajo. El directorio terminado en `.local` está ignorado por la regla
preexistente; no se modificó `.gitignore`.

Se conservan sin cambios los cuatro archivos previamente modificados
(revisión de lanzamiento, detalle de pedido, handler Redsys y su prueba),
así como los tres archivos sin seguimiento (configuración de Claude,
documentación T2 y prueba de importes administrativos).

Para recuperar un archivo anterior, comparar primero con su copia en
`worktree/` y restaurar solo el archivo necesario; no hacer reset del árbol
completo, pues incluye trabajo previo y puede haber trabajo posterior.
`state.json` permite distinguir los archivos existentes de los añadidos.
El respaldo es privado y puede contener configuración local: no publicarlo.

## Corrección posterior: espacio inicial y movimiento de la Carta

Se elimina el espacio vacío anterior al panel y, por decisión posterior del
usuario, se retira el texto introductorio «Descubre nuestras especialidades…».
El panel comienza a 16 px del borde inferior de la barra de categorías.

Se recupera el desplazamiento mediante `transform` del restaurante, usando
la misma transición para navbar y categorías. Se mantiene la duración y
curva que ya utilizaba el navbar de la tienda, sus alturas, menú y contador.
El desplazamiento comunicado a las categorías se actualiza antes del pintado
para que ambas animaciones empiecen juntas.

El respaldo previo a esta corrección está en
`.integration-backup.local/carta-spacing-2026-11-04T19-57-55-409Z/`.
Los cambios se limitan a Carta, la sincronización visual del navbar, su
regla CSS y este informe; no afectan a pagos, stock ni administración.
TypeScript y compilación de producción vuelven a pasar con datos locales.
Las capturas y mediciones de las animaciones están en
`.integration-backup.local/validation/carta-motion-results.json` y
`carta-fixed-*.png`. La prueba reproduce el hueco con la transición anterior
y mide su ausencia durante las transiciones corregidas, además de los
saltos entre categorías y los accesos del menú.

## Validación

- TypeScript: `npx.cmd tsc --noEmit --incremental false`, correcto.
- Compilación de producción: `next build --webpack`, correcta. Se hizo con
  Supabase sustituido por un servidor local de datos ficticios y un filtro
  de peticiones externas, sin modificar `.env.local`.
- Pruebas: 167 de 168 correctas, tanto antes como después de la integración.
  El fallo preexistente de `src/lib/admin/food-labeling.test.ts` es
  `Tabla inesperada: payments`: el mock no contempla la consulta que ya
  existía en el detalle administrativo. No se alteró ese trabajo ni la prueba.
- Chrome real: Home, mapa condicionado por consentimiento y altura de PC;
  Contacto conservado; Carta a 390, 820 y 1440 px, seis categorías y 101 fichas,
  sin desbordamiento horizontal y con saltos hacia arriba/abajo; carrito
  persistente y menú; formulario de checkout y consentimientos separados.
- Instalación excluida de catálogo, categoría, producto, carrito, checkout,
  confirmación y login administrativo. Sesión administrativa ficticia y
  redirección anónima comprobadas. Los estados de instalación iOS/Android,
  instrucciones, espera al consentimiento, aplazamiento, cancelación y cierre
  al navegar a tienda también pasan. Sin service worker ni errores JavaScript
  en las comprobaciones finales.
- Integridad: 743 archivos del origen, incluidos sus metadatos Git, conservan
  sus hashes y listado. Los archivos protegidos y el trabajo local previo
  conservan sus bytes. Los cambios existentes respecto al respaldo se limitan
  a los 14 archivos autorizados de interfaz/datos del restaurante; los nuevos
  archivos corresponden a recursos, instalación móvil, metadata de Carta y
  este informe.

Los artefactos, capturas y ayudantes de validación están en
`.integration-backup.local/validation/`. Las pruebas usan datos ficticios,
no ejecutan cobros, envíos de emails ni modificaciones remotas. El logotipo
remoto y el contenido real de Google Maps/CoverManager no se certifican con
la red externa bloqueada; sus componentes y configuración se conservan.
Las exclusiones y estados de instalación se comprueban con agentes iOS y
Android emulados en Chrome, sin instalar una app en un dispositivo físico.

## Revisión local

Para repetir la previsualización aislada con el build de validación:

```powershell
node .integration-backup.local/validation/run.mjs serve
```

Abrir `http://127.0.0.1:3198/` y `/carta`. El catálogo es ficticio y el servidor
de datos solo acepta lecturas. Para recompilar en ese mismo entorno, detener
primero el servidor y ejecutar `node .integration-backup.local/validation/run.mjs build`.

Para desarrollar con la configuración habitual de la tienda:

```powershell
npm.cmd run dev -- --hostname 127.0.0.1 --port 3000
```

Ese comando usa la configuración ya existente de la tienda. No utilizar el
build con fixtures como versión de publicación. Cualquier validación real
de pagos o servicios externos queda fuera de esta integración local.
