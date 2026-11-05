# T2: fallo de procesamiento y recuperación manual

Revisión: 2026-11-04. El fallo seguía presente: `orderError || !order` devolvía HTTP 200 y `ok: true` aun cuando Supabase no había podido consultar el pedido. Reproducido primero con un test que fallaba contra ese código.

## Comportamiento comprobado de Redsys

Antes de cambiar las respuestas se consultaron fuentes oficiales:

- [Realizar un pago, tratamiento del POST](https://pagosonline.redsys.es/desarrolladores-inicio/documentacion-operativa/autorizacion/): el resultado llega por POST firmado; la vuelta del navegador no sustituye esa notificación.
- [Manual de redirección, versión 4.1, apartado «No Recepción de Respuesta On-line», página 21](https://pagosonline.redsys.es/download/1735/?tmstv=1742935826): los errores del servidor siguen HTTP estándar y el resultado de la notificación se puede consultar en el portal.
- [Portal de Administración](https://pagosonline.redsys.es/pagina-de-inicio-pagosonline/principal-administracion-y-reporting/): permite consultar el detalle de las operaciones.

Estas fuentes no ofrecen una garantía de reenvío automático ante un HTTP 500. Esta corrección no depende de ello: el 500 declara fallo técnico, no revierte un cobro bancario ni asegura su recuperación. No se ha inspeccionado ni cambiado la configuración del terminal real.

## Corrección y límites

| Resultado | Respuesta y actuación |
| --- | --- |
| Error de consulta de pedido o líneas, excepción de transporte, error de RPC o resultado incompleto | HTTP 500; log con etapa, `Ds_Order`, respuesta, importe, autorización y error; sin confirmación ni emails. Si se perdió la respuesta de la RPC, el commit puede haber ocurrido. |
| Consulta correcta sin pedido | HTTP 200 con `ok: false, review_required: true`; log `order_missing`, requiere intervención. |
| RPC requiere revisión o ya registró un pago con fallo de stock | HTTP 200 con `ok: false, review_required: true`; conserva la decisión transaccional de T1, requiere intervención. |
| Pago confirmado o duplicado coherente | HTTP 200 con `ok: true`; el duplicado no repite stock, regalos, canjes, histórico ni intentos de email. |

Se comprueban también el UPDATE condicional de rechazo y sus filas afectadas, y los INSERT de histórico. Un UPDATE que ya no encuentra el estado pendiente no escribe una transición ficticia. Si falla el histórico auxiliar después de confirmar el pago, se registra el fallo y se mantiene el acuse: el pago ya está guardado. Los fallos de registro de los emails tampoco se confunden con fallos del envío.

La RPC de T1 no cambia: pago, stock, regalos y canje siguen en una transacción con bloqueo por pedido. No hay nuevas colas, tareas ni recuperación automática de emails o histórico.

## Procedimiento mínimo ante una incidencia

1. Localizar en los logs `[pagos/notificacion]` la etapa y el `Ds_Order`. Conservar la hora y el error. No se registra el POST firmado completo, datos de tarjeta ni datos personales del cliente.
2. Comprobar en el portal de Redsys la operación original: comercio, terminal, entorno, moneda, importe, autorización y resultado autorizado. Un 500 de la tienda no significa que el banco no haya cobrado. No volver a cobrar ni crear otro pedido para recuperarlo.
3. Tras restablecer Supabase, consultar `orders` por `redsys_ds_order` y `payments` por `order_id`. Si `payments` y `orders.paid_at` son coherentes, conservarlos junto al estado operativo. Si faltan datos históricos, hay un reembolso, `STOCK_ERROR`, `NEEDS_REVIEW`, un estado operativo ambiguo o el pedido realmente no existe, revisar manualmente con el banco y el responsable del pedido; no borrar barreras ni ponerlo artificialmente en `PENDING_PAYMENT`.
4. Para un pago autorizado verificado cuyo pedido sigue en `PENDING_PAYMENT` o `PAYMENT_FAILED`, recuperar mediante **la misma RPC de T1**, desde un entorno administrativo seguro. Usar los identificadores y datos originales contrastados con Redsys y las líneas guardadas del pedido. También es segura ante un commit cuya respuesta se perdió: devolverá `already_processed` si todo es coherente. No insertar `payments` ni descontar stock por separado.

Plantilla SQL para el operador (no ejecutada en esta revisión). Sustituir todos los marcadores; el importe es el entero en céntimos de Redsys, nunca el total en euros:

```sql
SELECT public.decrement_stock_and_confirm_order(
  p_order_id => '<UUID_PEDIDO>'::uuid,
  p_redsys_ds_order => '<DS_ORDER_ORIGINAL>',
  p_redsys_ds_response => '<DS_RESPONSE_AUTORIZADO>',
  p_redsys_authorization => '<AUTORIZACION_ORIGINAL>',
  p_amount => <IMPORTE_CENTIMOS>,
  p_line_items => (
    SELECT jsonb_agg(jsonb_build_object(
      'variant_id', product_variant_id,
      'quantity', quantity,
      'item_type', CASE WHEN item_type = 'GIFT' THEN 'GIFT' ELSE 'PRODUCT' END
    ))
    FROM public.order_items
    WHERE order_id = '<UUID_PEDIDO>'::uuid AND product_variant_id IS NOT NULL
  ),
  p_promotion_id => (
    SELECT promotion_id FROM public.order_items
    WHERE order_id = '<UUID_PEDIDO>'::uuid AND item_type = 'GIFT'
    LIMIT 1
  )
);
```

5. Comprobar el resultado de la RPC y releer pedido y pago. `ok: true` o `already_processed: true` confirman el procesamiento coherente. `ok: false` requiere inspeccionar el error: puede haber un pago guardado con `STOCK_ERROR` o una inconsistencia que la RPC protege; no forzar otro descuento. Registrar manualmente el resultado de la intervención. Esta llamada directa no envía emails ni reconstruye el histórico auxiliar de éxito; cualquier comunicación pendiente se revisa por separado, sin usar el reprocesamiento del cobro como mecanismo de reenvío.

## Pruebas y despliegue

Pruebas del handler con Supabase, Redsys y emails simulados: fallo de consulta, fallo de RPC, recuperación posterior del mismo pago y duplicado en estado operativo avanzado. Se cubren también respuesta perdida tras commit, transporte, líneas no disponibles, RPC incompleta y errores de UPDATE/histórico. La simulación comprueba la delegación y los efectos observables del handler; no sustituye una prueba SQL de concurrencia de T1.

- `npm.cmd test -- src/app/api/pagos/notificacion/route.test.ts`: 28/28 correctas.
- `npx.cmd tsc --noEmit --incremental false`: correcto.
- `npm.cmd test`: 167/168 correctas. Falla `src/lib/admin/food-labeling.test.ts` con `Tabla inesperada: payments`: su mock no contempla la consulta añadida en los cambios preexistentes de `src/app/admin/pedidos/[id]/page.tsx`. Esos cambios ajenos a T2 se han conservado.
- `git diff --check`: correcto. No se ejecutó `next build`, cuyo prerenderizado consulta la base configurada.

Desplegar el código actualizado. T2 no necesita migración nueva ni cambios de configuración. Es requisito previo que esté aplicada la [migración 0023 de T1](../supabase/migrations/20261104100000_0023_atomic_redsys_payment.sql), con su firma actual de RPC. No se ha verificado su despliegue remoto ni ejecutado cobros, correos u operaciones sobre servicios remotos.
