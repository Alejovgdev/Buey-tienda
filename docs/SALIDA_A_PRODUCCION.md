# Salida a producción — pendientes

Lista de lo que hay que hacer o confirmar antes de abrir la tienda en producción. Recoge lo documentado en [AUDITORIA_FINAL_PRE_LANZAMIENTO.md](AUDITORIA_FINAL_PRE_LANZAMIENTO.md), [REVISION_LANZAMIENTO_2026-10-29.md](REVISION_LANZAMIENTO_2026-10-29.md) y los pasos de facturación de noviembre de 2026. Marcar cada punto al cerrarlo.

## 1. Variables de entorno en Vercel (entorno Production)

Nunca en `.env.local`, que es solo de desarrollo.

| Variable | Valor en producción | Notas |
|---|---|---|
| `EMAIL_FROM` | `El Buey Madurado <pedidos@restauranteelbueymadurado.com>` | **Obligatoria.** Si falta, los emails no se envían y queda un error en los logs. En local y previews se usa `onboarding@resend.dev`. |
| `EMAIL_REPLY_TO` | `elbueymaduradoxativa@gmail.com` | Recomendada. Si falta, los emails al cliente salen sin «responder a» y queda un aviso en los logs. |
| `ADMIN_NOTIFICATION_EMAIL` | `elbueymaduradoxativa@gmail.com` | Destino del email interno de nuevo pedido. |
| `RESEND_API_KEY` | Clave de la cuenta con `restauranteelbueymadurado.com` verificado | |
| `REDSYS_ENVIRONMENT` | `production` | |
| `REDSYS_MERCHANT_CODE`, `REDSYS_TERMINAL`, `REDSYS_SECRET_KEY` | Credenciales reales del TPV Virtual del banco | Las actuales son de pruebas. |
| `NEXT_PUBLIC_BASE_URL` | Dominio público definitivo | De aquí salen las URLs de aviso y retorno de Redsys y los enlaces de los emails (H-07). |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Proyecto Supabase de producción | No usar `tienda-buey-dev`. |
| `ADMIN_PASSWORD`, `ADMIN_JWT_SECRET` | Valores nuevos y robustos | No reutilizar los de desarrollo. |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Cuenta de Cloudinary de la tienda | |

## 2. Base de datos de producción

- [ ] Aplicar todas las migraciones de `supabase/migrations/` (incluidas 0024 IVA, 0025 facturas, 0026 almacén de PDF, 0027 factura tras revisión de stock y 0028 estado Enviado y recordatorio) y comprobar con `supabase migration list` que coinciden.
- [ ] Vaciar o no aplicar los datos de ejemplo de `0006_seed_dev.sql` (y el relleno de desarrollo de `0013`).
- [ ] Revisar en `shop_settings` los datos del emisor (razón social, NIF, dirección) y `shipping_vat_rate`.
- [ ] Revisar `products.vat_rate` de todo el catálogo (10 % confirmado por el gestor para carne y embutidos).

## 3. Facturación

- [ ] No publicar las Condiciones v1.3 (cláusula de factura electrónica) hasta que el envío automático de la factura en PDF funcione en producción.
- [ ] Comprobar en producción que el primer pago real genera `T<año>-0001` y que el cliente la recibe adjunta.
- [ ] **Pregunta pendiente para el gestor: pedidos cobrados y luego cancelados.** Hoy, si el banco cobra pero el pedido se queda en «Error de stock» y el admin lo cancela (y devuelve el dinero), no se emite factura. Solo se factura si se resuelve pasándolo a «Preparando». Como el cobro es por adelantado, el IVA podría deberse ya en el momento del pago. ¿Hay que emitir la factura al cobrar y, si se cancela, una rectificativa (serie R)? ¿O basta con no facturar porque la venta no llega a hacerse? La respuesta decide cómo tratar las cancelaciones en el paso 8 (rectificativas). Lo mismo vale para un pedido «Pagado» que se cancela antes de enviarse: ya tiene factura y hoy no se rectifica.

## 4. Pagos

- [ ] TPV Virtual en modo producción con credenciales reales del banco.
- [ ] H-07: verificar en un despliegue real de Vercel que `DS_MERCHANT_MERCHANTURL` apunta al dominio público correcto.
- [ ] Hacer un pago real de importe bajo y reembolsarlo antes de abrir.

## 5. Legal

- [ ] Validación jurídica de Condiciones, Política de privacidad y Aviso legal (todas «pendiente de validación jurídica»), incluidos los TODO de cada documento.
  - [ ] Revisar si los errores de envío (§5.2: producto equivocado o que falta) deben seguir el mismo procedimiento de aviso que el §5.5 (plazo de 24 horas y fotos). Hoy el §5.5 solo lo exige para pérdida de vacío, rotura de caja o mal estado del producto.

## 6. Seguridad pendiente de la auditoría

- [ ] H-05: revocación de la sesión de admin en servidor (o acortar la duración del token).
- [ ] Analizar una Content-Security-Policy (H-06 dejó solo las cabeceras mínimas).
