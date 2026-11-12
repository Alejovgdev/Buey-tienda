# Cierre del diagnóstico local: Tienda y añadir al carrito

**No se modifica la aplicación.** Se conservan medios, diseño, animaciones,
navegación, persistencia y flujos comerciales. No se ha demostrado una corrección
pequeña que permita atribuir una mejora al código. Los cambios de esta revisión
son instrumentación local y este informe; no hay cambios de caché ni servicios.

## Entorno y evidencias

Se reutilizó la compilación de producción aislada del bloque 4, con Next.js
16.4.1 y Chrome 156.0.8078.80. Se comprobó que **los 219 archivos actuales de
`src` coinciden byte a byte con sus copias en esa compilación**. No se utiliza
un servidor de desarrollo ni se publica el build ficticio.

Condición principal: 390 × 844, DPR 2, UA Android, entrada táctil, CPU ×4,
latencia configurada 150 ms, descarga 200.000 B/s, subida 93.750 B/s, caché de
navegador desactivada y optimizador local de imágenes precalentado. Mismo
catálogo simulado y misma secuencia de interacción del bloque 4. No se ejecutaron
compilaciones o suites de pruebas durante las mediciones.

Cada control tiene **tres repeticiones**. La primera incluye una traza nativa
importable en Chrome DevTools; las dos restantes permiten contrastar la
instrumentación con visitas sin grabación. Se conservaron controles negativos,
muestras lentas y ensayos sin resultado interpretable. En total se registraron
72 visitas de medición, más precalentamientos y la regresión funcional.

La instrumentación recoge Navigation/Resource Timing, LCP con `paintTime` y
`presentationTime`, Event Timing por evento e interacción, tareas y fotogramas
largos, cambios de estilo, IntersectionObserver, animaciones nativas y duración
de `localStorage.setItem`. Las trazas conservan eventos de renderer, compositor,
presentación, CPU y marcas de diagnóstico. Los archivos brutos no se reescriben
al analizarlos; las capturas posteriores guardan también el hash y el indicador
`dataLossOccurred: false` recibido de Chrome.

## Tienda: elemento y desglose

El elemento LCP es la **primera foto de producto**:
`/_next/image?url=%2Fassets%2Fimages%2Fchuleton-corte.webp&w=384&q=75`.
Procede de una fotografía existente, no de una imagen ficticia pesada. El
recurso contiene **23.994 bytes de imagen**, y ocupa unos 171 × 214 px CSS.
La categoría tiene el mismo candidato. Se descubre en el HTML como imagen
`loading="lazy"`; su tarjeta tiene la entrada animada aprobada de 600 ms.

Desglose de las primeras visitas trazadas, en milisegundos. Son visitas concretas,
no sumas de medianas independientes:

| Tramo | Tienda | Categoría |
| --- | ---: | ---: |
| Navegación → primer byte del documento | 11,7 | 13,1 |
| Primer byte → inicio del recurso (`startTime`) | 584,3 | 560,7 |
| Cola/conexión hasta `requestStart` | 488,4 | 491,2 |
| Petición → fin de descarga del recurso | 831,1 | 812,9 |
| Fin de recurso → marca `paintTime` | 1.044,9 | 1.092,6 |
| `paintTime` → `presentationTime` | **3.383,6** | **17,5** |
| **LCP total** | **6.344,0** | **2.988,0** |

La imagen termina de descargar a 1.915,5 ms en Tienda. IntersectionObserver se
activa a 2.342,6 ms; la animación empieza aproximadamente a 2.359 ms, acaba a
2.957 ms y la marca de pintura se registra a 2.960,4 ms. El LCP se presenta a
6.344 ms. La traza contiene el tramo pendiente de presentación del compositor
y las notificaciones de presentación agrupadas al final del intervalo.

Entre `paintTime` y presentación se acumulan 139,6 ms de tareas de renderer,
ninguna de más de 2,4 ms en ese intervalo. **No aparece una tarea JavaScript
de 3,38 s ni una consulta pendiente que explique esa cola.** Todos los recursos
de esa visita habían terminado antes de 2.963 ms.

En Categoría se comparten la descarga, hidratación y entrada de la tarjeta,
pero no la cola adicional de 3,38 s. No se atribuye todo el tiempo posterior a
la descarga a la animación: solo dura 600 ms y termina antes de la cola larga.

La localización está demostrada en la fase de presentación del navegador bajo
estas condiciones. **La causa interna exacta de esa espera en Chrome no queda
confirmada.** No se presenta como un defecto de una versión concreta, de la GPU
o del alojamiento. Tampoco se sustituye el LCP de 6,344 s por `paintTime` de
2,960 s: son medidas distintas.

## Controles de entorno y fixtures

Medianas de tres repeticiones; cada fila cambia únicamente el factor indicado
respecto a la condición principal, salvo el control de modo escritorio, que
también cambia la distribución por la barra de desplazamiento.

| Control de diagnóstico; misma aplicación | LCP Tienda | LCP Categoría |
| --- | ---: | ---: |
| CPU ×4 y red limitada, condición principal | 6,352 s | 3,004 s |
| CPU ×1, manteniendo la misma red | 2,324 s | 2,328 s |
| Red sin limitar, manteniendo CPU ×4 | 1,040 s | 1,048 s |
| Dos productos simulados en vez de tres | 6,236 s | — |
| Chrome con configuración gráfica predeterminada | 6,376 s | 3,012 s |
| Chrome lanzado con `--disable-features=TreesInViz` | 6,404 s | 3,028 s |
| `mobile:false`, mismo tamaño nominal y CPU/red | 6,340 s | 3,000 s |

Quitar solo la limitación de CPU reduce la cola pintura→presentación de Tienda
a 5–8 ms; quitar solo la de red la deja en 35–38 ms. Esto demuestra sensibilidad
al entorno de laboratorio, **no una mejora del código ni un resultado esperado
en todos los teléfonos reales**. CPU ×4 es una ralentización relativa del host,
no una reproducción exacta de un procesador móvil.

Las consultas a la API ficticia tardan menos de 1 ms; en la primera traza de
Tienda, la máxima registrada es 0,174 ms. No tienen un retraso artificial.
Reducir el catálogo a dos productos conserva la cola de presentación (~3,37 s),
por lo que el tercer producto no explica por sí solo el hallazgo. Las imágenes
son recursos reales locales pequeños; no hay evidencia para recomprimirlos.

Estos fixtures no reproducen latencia de una base de datos real, CDN, fotografías
definitivas o distribución de contenidos definitiva. No permiten certificar el
TTFB del despliegue. Ningún control altera ni recupera cachés del catálogo.

## Carrito: interacción exacta y subpartes

El registro corresponde a **tocar «Añadir al carrito» en la ficha**, después de
abrir/cerrar el menú y seleccionar «Formato menor» (9,75 €). Se añade una unidad
al carrito local. El máximo proviene del evento **`pointerdown`**, agrupado con
`pointerup` y `click` mediante el mismo `interactionId`.

Primera visita trazada, valores de PerformanceEventTiming redondeados por Chrome:

| Evento de esa interacción | Espera de entrada | Procesamiento del evento | Hasta presentación | Duración |
| --- | ---: | ---: | ---: | ---: |
| `pointerdown` | 14,4 ms | 1,3 ms | 448,3 ms | 464 ms |
| `click`, que ejecuta añadir | 16,0 ms | 7,4 ms | 352,6 ms | 376 ms |

La traza sin redondear registra para `click`: inicio 15.550,125 ms, procesamiento
15.566,167–15.573,574 ms, commit 15.580,101 ms y duración 376,609 ms. Se observa
presentación de fotogramas durante la animación; el registro tardío no se explica
por una tarea larga del manejador. `localStorage.setItem` dura 0,2 ms en esa
visita (mediana 0,1 ms en las tres). No se hace una petición de red para añadir.

El DOM muestra «Añadido» 23,1 ms después del inicio de `click`. **Una mutación DOM
no demuestra que los píxeles ya se hayan presentado**: no se publica «23 ms» como
latencia de respuesta. Tampoco se resta la animación de 350 ms a Event Timing ni
se identifica su duración con INP.

Controles táctiles, sin cambios en la aplicación:

| Preparación del toque | Máximo Event Timing, mediana (rango) |
| --- | ---: |
| Recorrido original | 464 ms (456–464) |
| Recorrido original y espera posterior ampliada para recoger eventos | 464 ms (448–464) |
| Mismo recorrido, centrando y estabilizando el botón antes del toque | 32 ms (32–40) |
| Recorrido directo, botón centrado, animación completa | 64 ms (56–72) |
| Control anterior anulando transformaciones/transiciones solo en el navegador | 24 ms (24–32) |

La misma animación completa puede convivir con una respuesta mucho más corta;
**456 ms no es su duración necesaria**. El resultado depende de la preparación,
posición y presentación en esta prueba. Centrar el botón añade scroll y una
espera de estabilización de 700 ms; no se aísla la posición como única causa.
Ese tiempo de preparación no se suma a Event Timing.

Se ensayó `will-change: transform` únicamente mediante una hoja temporal del
navegador, manteniendo el recorrido original. Chrome dejó de emitir las entradas
esperadas de esa interacción, incluso ampliando la observación a más de cuatro
segundos. **Una entrada ausente no es 0 ms ni prueba una mejora.** El ensayo se
descarta; no se traslada a la aplicación. El control sin transformaciones tampoco
se implementa, porque retiraría comportamiento visual aprobado.

## Comparación con el bloque 4 y decisión

No hay un antes/después de optimización de aplicación: no se cambió su código.
La repetición con las mismas condiciones confirma los registros anteriores:

| Medida | Bloque 4 | Revisión actual |
| --- | ---: | ---: |
| LCP Tienda | 6,340 s | 6,352 s (6,344–6,380) |
| LCP Categoría | 3,008 s | 3,004 s (2,988–3,024) |
| Añadir: máximo por interacción | 456 ms | 464 ms (456–464) |

No se consideran mejoras ni regresiones las diferencias dentro de estos rangos.
La parte dominante de Tienda está localizada en presentación; las consultas y el
peso de la foto no la explican. El coste de cálculo/persistencia del carrito es
pequeño; su registro elevado se concentra en presentación en ese recorrido.

No hay base para cambiar cachés, consultas, lógica de carrito o fotografías. No
se modifica la entrada animada ni se cambia de biblioteca de animación. Ambos
pendientes quedan **cerrados como diagnóstico local**, con la comprobación en
el despliegue indicada abajo; no se certifican los Core Web Vitals de usuarios.

## Validación y archivos

- TypeScript correcto, **256 pruebas Vitest** correctas y sintaxis de los tres
  scripts comprobada con Node.
- Regresión de navegador correcta: precio/formato, persistencia real tras
  recarga (sin reinyectar el carrito), acumulación y límite de stock, aumentar,
  disminuir, eliminar y nueva recarga. La revisión local de checkout devuelve
  HTTP 200 y deja habilitado el formulario. **No se envía el formulario ni se
  crea pedido o sesión de pago.**
- Sin excepciones de navegador o peticiones inesperadas en los recorridos. Solo
  se permiten GET/HEAD a los fixtures y el POST de revisión al checkout local;
  el resto de operaciones y destinos remotos siguen bloqueados.
- Fuentes de aplicación idénticas a la compilación posterior al bloque 4;
  originales públicos y los 107 archivos inventariados de referencia intactos.
  Se mantienen todos los bloques SEO, disponibilidad, T1/T2, pagos y consentimiento.

Instrumentación: `scripts/diagnose-shop-performance.mjs`, con un modo específico
en `check-mobile-performance.mjs`; `performance-browser.mjs` conserva el perfil
original por defecto y permite controles explícitos solo en el laboratorio.

```powershell
node scripts/check-mobile-performance.mjs after --reuse --trace-pending
node scripts/check-mobile-performance.mjs after --reuse --trace-pending --diag-condition=cpu1
node scripts/check-mobile-performance.mjs after --reuse --trace-pending --diag-controls
node scripts/check-mobile-performance.mjs after --reuse --trace-pending --diag-final-controls
node scripts/check-mobile-performance.mjs after --reuse --trace-pending --diag-settled-controls
node scripts/check-mobile-performance.mjs after --reuse --trace-pending --diag-regression
```

`--reuse` requiere conservar el contexto y la compilación aislada del bloque 4.
Los resultados del bloque 4 no se sobrescriben. Evidencias ignoradas por Git en
`.pending-performance.local`: informes por control, `summary.json`,
`trace-findings.json`, `source-integrity.json`, `cart-regression.json` y trazas
`*.trace.json` importables desde Performance de Chrome DevTools.

## Comprobación acotada en el despliegue

Con el catálogo definitivo, repetir Tienda/Categoría y el toque exacto de añadir
en Chrome Android y Safari iPhone reales, con el botón tanto en la posición
original como después del scroll. Capturar TTFB, Resource Timing y traza de
presentación antes de decidir un cambio de animación o renderizado. Confirmar si
existe la misma cola de presentación y la respuesta elevada fuera del headless.

Separar latencia real de base de datos, CDN y fotografías definitivas del tramo
de presentación. Consultar datos de usuarios de Search Console/CrUX cuando
existan. Las pruebas locales no validan INP de campo ni justifican configurar
servicios o introducir otra integración.

Método contrastado con documentación oficial:
[desglose de LCP](https://web.dev/articles/optimize-lcp),
[subpartes de una interacción](https://web.dev/articles/optimize-inp) y
[trazas y límites de la emulación de CPU](https://developer.chrome.com/docs/devtools/performance/reference).
