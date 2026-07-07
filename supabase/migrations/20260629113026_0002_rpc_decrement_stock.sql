-- =============================================================================
-- 0002_rpc_decrement_stock.sql
-- Función RPC transaccional para descontar stock y confirmar pedido.
-- Se llama desde el handler de notificación de Redsys tras verificar la firma.
-- Sección 12 del documento técnico.
-- =============================================================================

CREATE OR REPLACE FUNCTION decrement_stock_and_confirm_order(
  p_order_id   UUID,
  p_line_items JSONB  -- [{ "variant_id": "uuid", "quantity": 2 }, ...]
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  item    JSONB;
  v_id    UUID;
  v_qty   INT;
  v_stock INT;
BEGIN
  -- Iterar líneas y bloquear filas para evitar race conditions (SELECT FOR UPDATE)
  FOR item IN SELECT * FROM jsonb_array_elements(p_line_items) LOOP
    v_id  := (item->>'variant_id')::UUID;
    v_qty := (item->>'quantity')::INT;

    SELECT stock INTO v_stock
    FROM product_variants
    WHERE id = v_id
    FOR UPDATE;

    -- Variante borrada desde Supabase Studio entre checkout y notificación
    IF v_stock IS NULL THEN
      RETURN jsonb_build_object(
        'ok',         false,
        'error',      'VARIANTE_NO_ENCONTRADA',
        'variant_id', v_id
      );
    END IF;

    IF v_stock < v_qty THEN
      RETURN jsonb_build_object(
        'ok',         false,
        'error',      'STOCK_INSUFICIENTE',
        'variant_id', v_id,
        'requested',  v_qty,
        'available',  v_stock
      );
    END IF;

    UPDATE product_variants
    SET stock = stock - v_qty
    WHERE id = v_id;
  END LOOP;

  -- Confirmar el pedido
  UPDATE orders
  SET status     = 'PAID',
      paid_at    = now(),
      updated_at = now()
  WHERE id = p_order_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;
