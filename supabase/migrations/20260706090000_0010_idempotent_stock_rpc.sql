-- =============================================================================
-- 0010_idempotent_stock_rpc.sql
-- Fase 5, Unidad 1. Cierra el hueco de idempotencia anotado desde la
-- auditoria de Fase 1 y confirmado de nuevo en Fase 4: dos notificaciones de
-- Redsys para el mismo pedido descontaban stock dos veces porque la RPC
-- nunca comprobaba si el pedido ya estaba PAID.
--
-- Cambios sobre 0009_fix_atomic_stock_rpc.sql:
-- - SELECT ... FOR UPDATE sobre el pedido AL PRINCIPIO, antes de nada mas.
--   Si status = 'PAID', se sale inmediatamente con already_processed:true sin
--   tocar stock ni promocion. El bloqueo de fila (FOR UPDATE) es lo que hace
--   esto seguro bajo concurrencia real: dos llamadas casi simultaneas para el
--   mismo pedido se serializan aqui - la segunda espera a que la primera
--   termine su transaccion (haya dejado el pedido en PAID o no) antes de
--   poder leer el status.
-- - Nuevo parametro opcional p_promotion_id: si viene informado, el consumo
--   de la promocion (current_redemptions + 1) se hace dentro de la MISMA
--   transaccion que el descuento de stock, con el tope (max_redemptions) como
--   condicion atomica en el propio UPDATE - no como un UPDATE suelto despues,
--   fuera de la RPC, como vivia hasta ahora.
-- - Si la promocion ya esta agotada en el instante del UPDATE (0 filas
--   afectadas), no se falla la transaccion completa: el pedido y el stock se
--   confirman igual, simplemente sin regalo (regla ya establecida en la
--   seccion 13 del MVP: una promocion agotada nunca bloquea el pedido).
--
-- Se DROPea la funcion anterior (uuid, jsonb) porque anadir un parametro
-- cambia la firma - CREATE OR REPLACE con distinta lista de argumentos crea
-- un overload nuevo en vez de sustituir, dejando el 2-arg viejo colgando con
-- sus propios permisos. Con un unico caller (el handler de notificacion, que
-- se actualiza junto con esta migracion) no hay riesgo de romper nada vivo.
-- =============================================================================

DROP FUNCTION IF EXISTS public.decrement_stock_and_confirm_order(uuid, jsonb);

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
BEGIN
  IF p_line_items IS NULL
     OR jsonb_typeof(p_line_items) <> 'array'
     OR jsonb_array_length(p_line_items) = 0 THEN
    RETURN jsonb_build_object(
      'ok', false,
      'error', 'LINE_ITEMS_INVALIDOS'
    );
  END IF;

  -- Bloqueo real de la fila del pedido + comprobacion de idempotencia.
  -- Esto tiene que ir junto, en este orden: el FOR UPDATE es lo que serializa
  -- dos llamadas concurrentes; sin el, dos notificaciones casi simultaneas
  -- podrian leer status <> 'PAID' ambas antes de que ninguna termine.
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

  -- Consumo de la promocion, en la misma transaccion que el stock. El WHERE
  -- con el tope es la proteccion atomica adicional contra sobre-consumo por
  -- carrera: si dos pedidos con regalo llegan a la vez y solo cabe uno, el
  -- UPDATE de la segunda transaccion en llegar (una vez la primera libera el
  -- bloqueo de fila de `promotions`) ya vera el contador actualizado y
  -- afectara 0 filas.
  IF p_promotion_id IS NOT NULL THEN
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
    'promotion_consumed', v_promotion_consumed
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.decrement_stock_and_confirm_order(uuid, jsonb, uuid)
  FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.decrement_stock_and_confirm_order(uuid, jsonb, uuid)
  TO service_role;
