-- =============================================================================
-- 0007_post_review_fixes.sql
-- Ajustes post-revision de Fase 1.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- promotions: acceso solo backend, como orders.
-- RLS activado sin politica publica => deny por defecto para anon.
-- El backend accede con service_role, que bypassa RLS.
-- ---------------------------------------------------------------------------
DROP POLICY IF EXISTS "anon puede leer promociones" ON public.promotions;

-- ---------------------------------------------------------------------------
-- pg_cron: retencion diaria de etiquetas a las 03:00 UTC.
-- Reprograma el job existente por nombre.
-- ---------------------------------------------------------------------------
SELECT cron.schedule(
  'delete-old-product-labels',
  '0 3 * * *',
  $$DELETE FROM product_labels
    WHERE COALESCE(elaboration_date, created_at::date) < CURRENT_DATE - INTERVAL '6 months'$$
);

-- ---------------------------------------------------------------------------
-- CHECK constraints para evitar typos en estados y tipos de item.
-- Se consultan primero en pg_constraint para no duplicarlas si ya existen.
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'orders_status_check'
      AND conrelid = 'public.orders'::regclass
  ) THEN
    ALTER TABLE public.orders
      ADD CONSTRAINT orders_status_check
      CHECK (status IN (
        'PENDING_PAYMENT',
        'PAID',
        'PREPARING',
        'CANCELLED',
        'PAYMENT_FAILED',
        'STOCK_ERROR',
        'NEEDS_REVIEW'
      ));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'order_items_item_type_check'
      AND conrelid = 'public.order_items'::regclass
  ) THEN
    ALTER TABLE public.order_items
      ADD CONSTRAINT order_items_item_type_check
      CHECK (item_type IN ('PRODUCT', 'GIFT'));
  END IF;
END $$;
