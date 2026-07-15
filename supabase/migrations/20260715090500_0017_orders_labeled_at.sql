-- =============================================================================
-- 0017_orders_labeled_at.sql
-- Sistema de etiquetado alimentario, Unidad 6: marca de "pedido etiquetado".
-- Ver docs/FOOD_LABEL_ADMIN_DESIGN.md, §6.8.
--
-- Se añade como columnas independientes en vez de un valor nuevo en
-- orders.status para no tocar la máquina de estados de pago/cancelación ya
-- auditada en src/lib/admin/order-status.ts (PENDING_PAYMENT → PAID →
-- PREPARING → CANCELLED, etc.).
-- =============================================================================

ALTER TABLE orders
  ADD COLUMN labeled_at TIMESTAMPTZ,
  ADD COLUMN labeled_by TEXT;   -- nombre operativo de sesión (ver §17)
