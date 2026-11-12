-- =============================================================================
-- 0024_vat.sql
-- Paso 3: tipo de IVA por producto y por envío, y copia del IVA aplicado en
-- cada pedido para poder emitir facturas.
--
-- Los precios siguen siendo IVA incluido: nada de esto cambia lo que ve ni lo
-- que paga el cliente. El desglose (base + cuota) se calcula en el servidor
-- (src/lib/vat.ts) al crear el pedido, redondeando por línea.
--
-- Las columnas de pedidos admiten NULL: los pedidos anteriores a esta
-- migración (solo pedidos de prueba) no se rellenan.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Tipos configurables. 10 % por defecto (carne y embutidos, confirmado por el
-- gestor). Se cambian por producto en products.vat_rate y para el envío en
-- shop_settings.shipping_vat_rate.
-- ---------------------------------------------------------------------------
ALTER TABLE products
  ADD COLUMN vat_rate NUMERIC(5,2) NOT NULL DEFAULT 10
    CONSTRAINT products_vat_rate_range CHECK (vat_rate >= 0 AND vat_rate <= 100);

ALTER TABLE shop_settings
  ADD COLUMN shipping_vat_rate NUMERIC(5,2) NOT NULL DEFAULT 10
    CONSTRAINT shop_settings_shipping_vat_rate_range CHECK (shipping_vat_rate >= 0 AND shipping_vat_rate <= 100);

-- ---------------------------------------------------------------------------
-- order_items: copia del IVA de cada línea.
-- Regalos (0 €): tipo NULL, base 0, cuota 0.
-- ---------------------------------------------------------------------------
ALTER TABLE order_items
  ADD COLUMN vat_rate   NUMERIC(5,2),
  ADD COLUMN tax_base   INT,           -- base imponible en céntimos
  ADD COLUMN vat_amount INT,           -- cuota de IVA en céntimos
  ADD CONSTRAINT order_items_vat_consistent CHECK (
    (vat_rate IS NULL AND tax_base IS NULL AND vat_amount IS NULL)
    OR (
      tax_base IS NOT NULL AND vat_amount IS NOT NULL
      AND tax_base >= 0 AND vat_amount >= 0
      AND tax_base + vat_amount = line_total
      AND (vat_rate IS NOT NULL OR line_total = 0)
    )
  );

-- ---------------------------------------------------------------------------
-- orders: IVA del envío y totales.
-- Envío gratis (0 €): tipo NULL, base 0, cuota 0.
-- ---------------------------------------------------------------------------
ALTER TABLE orders
  ADD COLUMN shipping_vat_rate   NUMERIC(5,2),
  ADD COLUMN shipping_tax_base   INT,
  ADD COLUMN shipping_vat_amount INT,
  ADD COLUMN tax_base_total      INT,
  ADD COLUMN vat_total           INT,
  ADD CONSTRAINT orders_shipping_vat_consistent CHECK (
    (shipping_vat_rate IS NULL AND shipping_tax_base IS NULL AND shipping_vat_amount IS NULL)
    OR (
      shipping_tax_base IS NOT NULL AND shipping_vat_amount IS NOT NULL
      AND shipping_tax_base >= 0 AND shipping_vat_amount >= 0
      AND shipping_tax_base + shipping_vat_amount = shipping_cost
      AND (shipping_vat_rate IS NOT NULL OR shipping_cost = 0)
    )
  ),
  ADD CONSTRAINT orders_vat_totals_consistent CHECK (
    (tax_base_total IS NULL AND vat_total IS NULL)
    OR (
      tax_base_total IS NOT NULL AND vat_total IS NOT NULL
      AND tax_base_total >= 0 AND vat_total >= 0
      AND tax_base_total + vat_total = total
    )
  );
