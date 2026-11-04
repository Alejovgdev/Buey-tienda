-- T1: payment, stock and promotion are one transaction, serialized by order.
-- No backfill: historical paid_at was written with stock, but missing/conflicting
-- payments require reconciliation. Never infer fulfillment from status alone.
-- Deploy with the updated handler. Remove old signatures so an old caller fails
-- closed rather than bypassing payment registration.
DROP FUNCTION IF EXISTS public.decrement_stock_and_confirm_order(uuid, jsonb);
DROP FUNCTION IF EXISTS public.decrement_stock_and_confirm_order(uuid, jsonb, uuid);

CREATE OR REPLACE FUNCTION public.decrement_stock_and_confirm_order(
  p_order_id uuid,
  p_line_items jsonb,
  p_redsys_ds_order text,
  p_redsys_ds_response text,
  p_redsys_authorization text,
  p_amount integer,
  p_promotion_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  item record;
  v_stock int;
  v_order orders%ROWTYPE;
  v_payment payments%ROWTYPE;
  v_result jsonb;
  v_paid_at timestamptz := now();
  v_promo_rowcount int;
  v_promotion_consumed boolean := false;
  v_gift_variant_id uuid;
  v_gift_requested_quantity int;
  v_gift_skipped boolean := false;
  v_decrement int;
BEGIN
  SELECT * INTO v_order FROM orders WHERE id = p_order_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'review_required', true, 'error', 'PEDIDO_NO_ENCONTRADO');
  END IF;

  SELECT * INTO v_payment FROM payments WHERE order_id = p_order_id FOR UPDATE;
  -- Both the old stock RPC and the new one set orders.paid_at atomically with
  -- stock. Any payment row is also a barrier: a charge must never be retried
  -- automatically after a fulfillment failure, refund or inconsistent import.
  IF v_order.paid_at IS NOT NULL OR v_payment.id IS NOT NULL OR v_order.status = 'PAID' THEN
    IF v_order.paid_at IS NOT NULL
       AND v_payment.status IN ('succeeded', 'refunded')
       AND v_payment.paid_at IS NOT NULL
       AND v_payment.redsys_ds_order = v_order.redsys_ds_order
       AND v_payment.redsys_ds_order = p_redsys_ds_order
       AND v_payment.amount = v_order.total
       AND v_payment.amount = p_amount THEN
      RETURN jsonb_build_object('ok', true, 'already_processed', true);
    END IF;
    RETURN jsonb_build_object('ok', false, 'review_required', true,
      'error', 'PAYMENT_RECONCILIATION_REQUIRED');
  END IF;

  -- An unfulfilled operational order is ambiguous too. Do not reset its state.
  IF v_order.status NOT IN ('PENDING_PAYMENT', 'PAYMENT_FAILED') THEN
    RETURN jsonb_build_object('ok', false, 'review_required', true,
      'error', 'ORDER_RECONCILIATION_REQUIRED');
  END IF;
  IF p_redsys_ds_order IS DISTINCT FROM v_order.redsys_ds_order
     OR p_redsys_ds_order IS NULL
     OR p_redsys_ds_response IS NULL
     OR p_redsys_ds_response !~ '^00[0-9]{2}$' THEN
    RETURN jsonb_build_object('ok', false, 'review_required', true, 'error', 'PAGO_INVALIDO');
  END IF;
  IF p_amount IS DISTINCT FROM v_order.total THEN
    UPDATE orders SET status = 'NEEDS_REVIEW', updated_at = now() WHERE id = p_order_id;
    INSERT INTO order_status_history(order_id, event_type, previous_status, new_status, metadata)
    VALUES (p_order_id, 'IMPORTE_INCOHERENTE', v_order.status, 'NEEDS_REVIEW',
      jsonb_build_object('ds_amount', p_amount, 'order_total', v_order.total, 'ds_order', p_redsys_ds_order));
    RETURN jsonb_build_object('ok', false, 'review_required', true, 'error', 'IMPORTE_INCOHERENTE');
  END IF;

  <<fulfillment>>
  BEGIN
    IF p_line_items IS NULL
       OR jsonb_typeof(p_line_items) <> 'array'
       OR jsonb_array_length(p_line_items) = 0 THEN
      v_result := jsonb_build_object('ok', false, 'error', 'LINE_ITEMS_INVALIDOS');
      EXIT fulfillment;
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
        v_result := jsonb_build_object(
          'ok', false,
          'error', 'LINE_ITEM_INVALIDO',
          'variant_id', item.variant_id,
          'quantity', item.total_quantity
        );
        EXIT fulfillment;
      END IF;

      SELECT stock
      INTO v_stock
      FROM product_variants
      WHERE id = item.variant_id
      FOR UPDATE;

      IF NOT FOUND THEN
        v_result := jsonb_build_object(
          'ok', false,
          'error', 'VARIANTE_NO_ENCONTRADA',
          'variant_id', item.variant_id
        );
        EXIT fulfillment;
      END IF;

      IF item.variant_id = v_gift_variant_id THEN
        -- El producto real que comparta esta misma variante SIEMPRE bloquea el
        -- pedido entero si no hay stock ni para el, exactamente igual que
        -- cualquier otra variante.
        IF v_stock < item.product_quantity THEN
          v_result := jsonb_build_object(
            'ok', false,
            'error', 'STOCK_INSUFICIENTE',
            'variant_id', item.variant_id,
            'requested', item.product_quantity,
            'available', v_stock
          );
        EXIT fulfillment;
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
          v_result := jsonb_build_object(
            'ok', false,
            'error', 'STOCK_INSUFICIENTE',
            'variant_id', item.variant_id,
            'requested', item.total_quantity,
            'available', v_stock
          );
        EXIT fulfillment;
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

    v_result := jsonb_build_object(
      'ok', true,
      'already_processed', false,
      'promotion_consumed', v_promotion_consumed,
      'gift_skipped_no_stock', v_gift_skipped
    );
  END fulfillment;

  -- No ON CONFLICT and no swallowed exceptions: an INSERT failure rolls back
  -- stock, gifts, promotion and paid_at as well. The existing UNIQUE(order_id)
  -- remains a second barrier. Record the bank authorization even without stock.
  INSERT INTO payments(order_id, redsys_ds_order, redsys_ds_response,
    redsys_authorization, amount, status, paid_at)
  VALUES (p_order_id, p_redsys_ds_order, p_redsys_ds_response,
    p_redsys_authorization, p_amount, 'succeeded', v_paid_at);

  IF NOT (v_result->>'ok')::boolean THEN
    UPDATE orders SET status = 'STOCK_ERROR', updated_at = now() WHERE id = p_order_id;
    INSERT INTO order_status_history(order_id, event_type, previous_status, new_status, metadata)
    VALUES (p_order_id, 'STOCK_ERROR', v_order.status, 'STOCK_ERROR', v_result);
  END IF;
  RETURN v_result || jsonb_build_object('paid_at', v_paid_at);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.decrement_stock_and_confirm_order(uuid, jsonb, text, text, text, integer, uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.decrement_stock_and_confirm_order(uuid, jsonb, text, text, text, integer, uuid)
  TO service_role;
