# Pendientes para la Fase 7 (panel admin) y notas operativas

Este documento recoge, en un solo sitio, lo que quedó pendiente al cerrar los
hallazgos de la auditoría de Fase 5 "final boss"
([docs/auditoria-fase-5-final-boss.md](auditoria-fase-5-final-boss.md)) y que
depende de que exista el panel admin (Fase 7) o de una gestión operativa
manual mientras tanto.

---

## Eventos que el panel admin debe mostrar de forma imposible de pasar por alto

Estos tipos de evento en `order_status_history` deben tener tratamiento visual
destacado en el panel admin (Fase 7) — no basta con listarlos igual que el resto
del histórico.

- **`IMPORTE_INCOHERENTE`** — pedido en `NEEDS_REVIEW` por posible manipulación o error
  de la notificación de pago (`Ds_Amount` no coincidía con `orders.total`).
  Requiere revisión manual antes de nada.
- **`PROMOCION_NO_APLICADA`** con `metadata.reason = 'SIN_STOCK_REGALO_EN_CONFIRMACION'`
  — **acción pendiente obligatoria, no un simple aviso.** El pedido se confirmó y
  cobró con normalidad, pero sin el regalo de la promoción porque se agotó su
  stock entre el checkout y la confirmación del pago. Decisión de negocio: el
  email de confirmación al cliente **no oculta nada** — le promete el regalo
  con total normalidad, igual que a cualquier otro pedido con promoción. Eso
  convierte la entrega real del regalo en un compromiso ya adquirido por
  escrito con el cliente, que el restaurante **tiene que cumplir sí o sí**
  (contactar al cliente o reponer una unidad para su envío), no una gestión
  opcional. El panel admin debe mostrar este caso como una tarea pendiente de
  resolver, al mismo nivel de urgencia visual que `IMPORTE_INCOHERENTE` —
  aunque el pedido en sí ya esté correctamente `PAID`.
- **`REGALO_ENTREGADO_SIN_CANJE_CONTADO`** — informativo, no bloquea el pedido, pero
  indica que se entregó un regalo de promoción que no contó dentro del límite
  oficial de canjes (hallazgo 2, aceptado como riesgo). Útil para llevar la
  cuenta real de cuántos regalos ha costado una promoción bajo tráfico
  concurrente.

---

## Nota operativa: colchón de stock del regalo de promociones

Las promociones de "regalo para los primeros N pedidos" pueden, bajo tráfico
concurrente muy ajustado (varios pedidos pagando en el mismo instante,
disputando el mismo cupo), entregar el regalo a alguna unidad más de N
(hallazgo 2 de la auditoría de Fase 5). Esto se acepta como riesgo para el
MVP: la mitigación es mantener manualmente un colchón de stock de la variante
de regalo por encima de `max_redemptions`. El caso de bloqueo total del
pedido (hallazgo 3) ya no depende de este colchón — se corrigió en código
(migración `supabase/migrations/20260706120000_0011_gift_stock_optional.sql`):
el pedido se confirma igualmente sin el regalo si este se queda sin stock,
sin bloquear la venta real.

---

## Otros pendientes de producción ya documentados en la auditoría de Fase 5

Ver [docs/auditoria-fase-5-final-boss.md](auditoria-fase-5-final-boss.md),
punto 8, para el detalle completo:

- Cambiar `ADMIN_NOTIFICATION_EMAIL` en Vercel a `elbueymaduradoxativa@gmail.com`
  antes de producción (en desarrollo usa una dirección distinta).
- Verificar el dominio `restauranteelbueymadurado.com` en Resend (SPF/DKIM/DMARC)
  y cambiar `EMAIL_FROM` a `pedidos@restauranteelbueymadurado.com` — mientras
  se use el dominio de pruebas de Resend (`onboarding@resend.dev`), tanto el
  email al cliente como el email interno fallarán en desarrollo.
