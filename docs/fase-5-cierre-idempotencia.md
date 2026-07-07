# Fase 5 — Cierre del hueco de idempotencia (anotado desde la Fase 1)

**Fecha:** 2026-07-06

## El hueco

Anotado por primera vez en la auditoría de Fase 1 ([docs/auditoria-fase-1.md](auditoria-fase-1.md), sección 4: "GAP conocido: no idempotente por sí sola"), confirmado como inerte en ese momento (sin caller todavía), y vuelto a confirmar ya explotable en la auditoría de Fase 4 ([docs/auditoria-fase-4.md](auditoria-fase-4.md), punto 5): el stub de `POST /api/pagos/notificacion` procesaba dos notificaciones para el mismo pedido sin comprobar si ya estaba `PAID`, y `decrement_stock_and_confirm_order` no bloqueaba la fila del pedido antes de descontar stock.

## El cierre (Fase 5)

- **Migración `supabase/migrations/20260706090000_0010_idempotent_stock_rpc.sql`:** `decrement_stock_and_confirm_order` ahora hace `SELECT status FROM orders WHERE id = p_order_id FOR UPDATE` al principio. Si `status = 'PAID'`, sale con `{ok: true, already_processed: true}` sin tocar stock ni promoción. El `FOR UPDATE` serializa dos llamadas concurrentes de verdad — no es solo una comprobación de `if`, es un bloqueo de fila real.
- **`src/app/api/pagos/notificacion/route.ts` (Unidades 2-3):** allowlist estricta de `Ds_Response` (0000-0099, nunca blocklist), rama de rechazo separada de la de éxito, y el camino de éxito delega la idempotencia, el descuento de stock y el consumo de promoción a la RPC anterior dentro de una única llamada.
- **Consumo de promoción integrado:** `current_redemptions` se incrementa dentro de la misma transacción que el stock (parámetro `p_promotion_id`), con el tope como condición atómica del propio `UPDATE` — cerrando también la ventana de sobre-consumo por carrera que existía al vivir como un `UPDATE` suelto fuera de la RPC.

## Verificación (Unidad 5 — concurrencia real, no secuencial)

Los tres escenarios se dispararon con `Promise.all` sobre notificaciones firmadas a mano (mismo algoritmo HMAC_SHA256_V1 que usó la auditoría de Fase 4), contra `tienda-buey-dev`, con lecturas de BD antes/después:

| Escenario | Resultado |
|---|---|
| Notificación duplicada real (2 llamadas paralelas, mismo pedido, `Ds_Response=0000`) | Stock descontado una sola vez (20→18), 1 fila en `payments`, 1 solo juego de eventos (`PAGO_CONFIRMADO`, `STOCK_DESCONTADO`, emails) — la segunda llamada salió por `already_processed: true`. |
| Última unidad disputada (stock=1, 2 pedidos distintos, notificaciones en paralelo) | Un pedido `PAID` con stock a 0, el otro `STOCK_ERROR` con el detalle de la variante — nunca ambos `PAID`, nunca stock negativo. |
| Promoción en el límite (`current_redemptions = max_redemptions - 1`, 2 pedidos con regalo, notificaciones en paralelo) | `current_redemptions` terminó exactamente en `max_redemptions` (10/10, no 11). Un pedido `PROMOCION_APLICADA`, el otro `PROMOCION_NO_APLICADA` (`reason: AGOTADA`) — ambos `PAID`, ninguno bloqueado ni marcado como error por la promoción agotada. |

Los tres escenarios pasaron a la primera; no hizo falta corregir nada en la implementación de la Unidad 1-4. Todos los datos de prueba (pedidos, pagos, histórico) se borraron y el stock/promoción se restauraron a su estado de seed al terminar cada prueba.

## Estado

El hueco de idempotencia queda cerrado. Pendiente: auditoría forense completa de la Fase 5 (nivel Fase 1, esfuerzo Extra/Max) antes de avanzar a la Fase 6/7.
