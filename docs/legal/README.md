# Textos legales — fuente canónica

Esta carpeta es la **fuente de verdad** de los textos legales de la tienda online. El contenido jurídico vive aquí, en Markdown, y aquí es donde se revisa, se versiona y se valida con el abogado.

Las páginas de `src/app/` (condiciones de contratación, política de privacidad, política de cookies, aviso legal) son **la publicación** de estos textos, no su original: replican lo que dice este directorio, con el formato y el diseño del sitio.

Por tanto, **cualquier cambio legal empieza aquí**: primero se edita el `.md` correspondiente, se sube su número de versión y se anota la fecha, y solo después se propaga el cambio a la página de `src/app/` que lo publica. Nunca al revés — un texto corregido directamente en el código y no reflejado aquí se considera una desviación que hay que revertir.

Cada documento lleva en su cabecera versión, fecha y estado (`pendiente de validación jurídica` / `validado`). Un documento no validado no debería publicarse.
