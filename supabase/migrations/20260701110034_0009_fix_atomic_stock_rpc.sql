-- =============================================================================
-- 0009_fix_atomic_stock_rpc.sql
-- Corrige la atomicidad logica de decrement_stock_and_confirm_order.
--
-- La version anterior descontaba linea a linea y podia devolver ok:false
-- despues de haber descontado stock de lineas anteriores. Esta version:
-- - valida el payload,
-- - bloquea el pedido,
-- - agrupa cantidades por variante,
-- - bloquea y valida todas las variantes sin descontar,
-- - descuenta solo si todas las lineas son validas,
-- - marca el pedido como PAID al final.
-- =============================================================================

CREATE OR REPLACE FUNCTION public.decrement_stock_and_confirm_order(
  p_order_id uuid,
  p_line_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  item record;
  v_stock int;
BEGIN
  IF p_line_items IS NULL
     OR jsonb_typeof(p_line_items) <> 'array'
     OR jsonb_array_length(p_line_items) = 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'LINE_ITEMS_INVALIDOS'
    );
  END IF;

  -- Evita carreras sobre el mismo pedido durante la confirmacion.
  PERFORM 1
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

  -- Primera pasada: agrupar, bloquear variantes y validar sin descontar nada.
  FOR item IN
    SELECT
      parsed.variant_id,
      SUM(parsed.quantity)::int AS quantity
    FROM (
      SELECT
        (elem->>'variant_id')::uuid AS variant_id,
        (elem->>'quantity')::int AS quantity
      FROM jsonb_array_elements(p_line_items) AS elem
    ) parsed
    GROUP BY parsed.variant_id
    ORDER BY parsed.variant_id
  LOOP
    IF item.variant_id IS NULL
       OR item.quantity IS NULL
       OR item.quantity <= 0 THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'LINE_ITEM_INVALIDO',
        'variant_id', item.variant_id,
        'quantity', item.quantity
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

    IF v_stock < item.quantity THEN
      RETURN jsonb_build_object(
        'ok', false,
        'error', 'STOCK_INSUFICIENTE',
        'variant_id', item.variant_id,
        'requested', item.quantity,
        'available', v_stock
      );
    END IF;
  END LOOP;

  -- Segunda pasada: solo se ejecuta si todo existe y tiene stock suficiente.
  FOR item IN
    SELECT
      parsed.variant_id,
      SUM(parsed.quantity)::int AS quantity
    FROM (
      SELECT
        (elem->>'variant_id')::uuid AS variant_id,
        (elem->>'quantity')::int AS quantity
      FROM jsonb_array_elements(p_line_items) AS elem
    ) parsed
    GROUP BY parsed.variant_id
    ORDER BY parsed.variant_id
  LOOP
    UPDATE product_variants
    SET stock = stock - item.quantity
    WHERE id = item.variant_id;
  END LOOP;

  UPDATE orders
  SET status = 'PAID',
      paid_at = now(),
      updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.decrement_stock_and_confirm_order(uuid, jsonb)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.decrement_stock_and_confirm_order(uuid, jsonb)
  TO service_role;
