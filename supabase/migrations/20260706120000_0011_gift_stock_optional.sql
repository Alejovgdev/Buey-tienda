-- =============================================================================
-- 0011_gift_stock_optional.sql
-- Fase 5, cierre de hallazgos de la auditoria "final boss"
-- (docs/auditoria-fase-5-final-boss.md, hallazgo 3 / punto 4).
--
-- Problema cerrado: si el stock del regalo de una promocion se agota entre el
-- checkout y la confirmacion del pago, la RPC trataba esa linea GIFT igual que
-- cualquier producto real y bloqueaba el pedido ENTERO con STOCK_INSUFICIENTE
-- -> STOCK_ERROR, aunque los productos reales del pedido (ya cobrados por
-- Redsys) si tuvieran stock de sobra. Decision de negocio ya tomada: hasta que
-- exista el panel admin (Fase 7) nadie del restaurante veria ese bloqueo a
-- tiempo, asi que la unica proteccion real hoy es no bloquear en absoluto.
--
-- Cambio de comportamiento:
-- - p_line_items ahora incluye item_type ('PRODUCT' | 'GIFT') por linea.
-- - Si una variante NO es la del regalo, o si la propia demanda de producto
--   real sobre esa variante ya supera el stock, el comportamiento es IDENTICO
--   a la migracion 0010: bloquea todo el pedido con STOCK_INSUFICIENTE.
-- - Si la (unica) variante de regalo tiene stock suficiente para el producto
--   real que comparta esa misma variante pero NO alcanza para servir tambien
--   el regalo, se omite solo la porcion del regalo (no se descuenta, no se
--   pone en negativo) y se marca gift_skipped_no_stock:true en el resultado,
--   sin fallar el resto del pedido.
-- - Si eso ocurre, el consumo de la promocion (current_redemptions) tampoco se
--   intenta - no tiene sentido contar un canje cuyo regalo no se entrego.
-- - Se maneja explicitamente el caso en que la variante de regalo coincide con
--   una variante que el cliente tambien compro como producto real (el seed
--   actual lo permite: el regalo de la promocion es una variante vendible) -
--   agregando la demanda de PRODUCT y GIFT por separado sobre la misma
--   variante para no arriesgar un descuento que deje stock negativo.
--
-- Se mantiene intacto todo lo demas de la migracion 0010: el FOR UPDATE sobre
-- orders con la comprobacion de idempotencia dentro de la misma transaccion,
-- el FOR UPDATE por variante en orden determinista (ORDER BY variant_id, para
-- evitar deadlocks), y la firma de la funcion (mismos 3 argumentos, por lo que
-- no hace falta DROP FUNCTION - un CREATE OR REPLACE con la misma firma
-- conserva los GRANT/REVOKE existentes; aun asi se restatean al final por
-- claridad y para verificarlos en vivo tras aplicar esta migracion).
-- =============================================================================

CREATE OR REPLACE FUNCTION public.decrement_stock_and_confirm_order(
  p_order_id uuid,
  p_line_items jsonb,
  p_promotion_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  item record;
  v_stock int;
  v_status text;
  v_promo_rowcount int;
  v_promotion_consumed boolean := false;
  v_gift_variant_id uuid;
  v_gift_requested_quantity int;
  v_gift_skipped boolean := false;
  v_product_only_quantity int;
  v_decrement int;
BEGIN
  IF p_line_items IS NULL
     OR jsonb_typeof(p_line_items) <> 'array'
     OR jsonb_array_length(p_line_items) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'LINE_ITEMS_INVALIDOS');
  END IF;

  -- Bloqueo real de la fila del pedido + comprobacion de idempotencia.
  SELECT status
  INTO v_status
  FROM orders
  WHERE id = p_order_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'PEDIDO_NO_ENCONTRADO',
      'order_id', p_order_id
    );
  END IF;

  IF v_status = 'PAID' THEN
    RETURN jsonb_build_object('ok', true, 'already_processed', true);
  END IF;

  -- La linea de regalo (si existe) se identifica una vez, fuera del bucle: en
  -- este diseno solo hay como mucho una promocion (y por tanto un
  -- gift_variant_id) aplicada por pedido.
  SELECT
    (elem->>'variant_id')::uuid,
    SUM((elem->>'quantity')::int)
  INTO v_gift_variant_id, v_gift_requested_quantity
  FROM jsonb_array_elements(p_line_items) AS elem
  WHERE elem->>'item_type' = 'GIFT'
  GROUP BY elem->>'variant_id';

  -- Primera pasada: agrupar por variante (cantidad de PRODUCT y de GIFT por
  -- separado, por si la variante de regalo coincide con una variante que el
  -- cliente tambien compro como producto real), bloquear y validar sin
  -- descontar nada todavia.
  FOR item IN
    SELECT
      g.variant_id,
      COALESCE(SUM(g.quantity) FILTER (WHERE g.item_type = 'PRODUCT'), 0)::int AS product_quantity,
      COALESCE(SUM(g.quantity) FILTER (WHERE g.item_type = 'GIFT'), 0)::int AS gift_quantity,
      SUM(g.quantity)::int AS total_quantity
    FROM (
      SELECT
        (elem->>'variant_id')::uuid AS variant_id,
        (elem->>'quantity')::int AS quantity,
        COALESCE(elem->>'item_type', 'PRODUCT') AS item_type
      FROM jsonb_array_elements(p_line_items) AS elem
    ) g
    GROUP BY g.variant_id
    ORDER BY g.variant_id
  LOOP
    IF item.variant_id IS NULL
       OR item.total_quantity IS NULL
       OR item.total_quantity <= 0 THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'LINE_ITEM_INVALIDO',
        'variant_id', item.variant_id,
        'quantity', item.total_quantity
      );
    END IF;

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

    IF item.variant_id = v_gift_variant_id THEN
      -- El producto real que comparta esta misma variante SIEMPRE bloquea el
      -- pedido entero si no hay stock ni para el, exactamente igual que
      -- cualquier otra variante.
      IF v_stock < item.product_quantity THEN
        RETURN jsonb_build_object(
          'ok', false,
          'error', 'STOCK_INSUFICIENTE',
          'variant_id', item.variant_id,
          'requested', item.product_quantity,
          'available', v_stock
        );
      END IF;

      -- Hay stock para el producto real, pero no alcanza para servir tambien
      -- el regalo: se omite solo el regalo, sin fallar el resto del pedido.
      IF v_stock < item.total_quantity THEN
        v_gift_skipped := true;
      END IF;
    ELSE
      -- Variante normal (sin regalo asociado): comportamiento identico al de
      -- antes de este cambio.
      IF v_stock < item.total_quantity THEN
        RETURN jsonb_build_object(
          'ok', false,
          'error', 'STOCK_INSUFICIENTE',
          'variant_id', item.variant_id,
          'requested', item.total_quantity,
          'available', v_stock
        );
      END IF;
    END IF;
  END LOOP;

  -- Segunda pasada: solo se ejecuta si todo lo anterior paso. Descuenta la
  -- cantidad total, salvo en la variante del regalo cuando se omitio - ahi
  -- solo se descuenta la parte de producto real (0 si no hay producto real
  -- compartiendo esa variante).
  FOR item IN
    SELECT
      g.variant_id,
      COALESCE(SUM(g.quantity) FILTER (WHERE g.item_type = 'PRODUCT'), 0)::int AS product_quantity,
      SUM(g.quantity)::int AS total_quantity
    FROM (
      SELECT
        (elem->>'variant_id')::uuid AS variant_id,
        (elem->>'quantity')::int AS quantity,
        COALESCE(elem->>'item_type', 'PRODUCT') AS item_type
      FROM jsonb_array_elements(p_line_items) AS elem
    ) g
    GROUP BY g.variant_id
    ORDER BY g.variant_id
  LOOP
    IF item.variant_id = v_gift_variant_id AND v_gift_skipped THEN
      v_decrement := item.product_quantity;
    ELSE
      v_decrement := item.total_quantity;
    END IF;

    UPDATE product_variants
    SET stock = stock - v_decrement
    WHERE id = item.variant_id;
  END LOOP;

  -- Consumo de la promocion: no se intenta si el regalo se omitio por falta
  -- de stock - no tiene sentido contar un canje cuyo regalo no se entrego.
  IF p_promotion_id IS NOT NULL AND NOT v_gift_skipped THEN
    UPDATE promotions
    SET current_redemptions = current_redemptions + 1,
        updated_at = now()
    WHERE id = p_promotion_id
      AND (max_redemptions IS NULL OR current_redemptions < max_redemptions);

    GET DIAGNOSTICS v_promo_rowcount = ROW_COUNT;
    v_promotion_consumed := v_promo_rowcount > 0;
  END IF;

  UPDATE orders
  SET status = 'PAID',
      paid_at = now(),
      updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object(
    'ok', true,
    'already_processed', false,
    'promotion_consumed', v_promotion_consumed,
    'gift_skipped_no_stock', v_gift_skipped
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.decrement_stock_and_confirm_order(uuid, jsonb, uuid)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.decrement_stock_and_confirm_order(uuid, jsonb, uuid)
  TO service_role;
