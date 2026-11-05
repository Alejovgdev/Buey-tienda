import 'server-only';
import { supabaseAdmin } from './supabase-admin';
import { getShopSettings } from './shop-settings';
import { calculateShippingCost } from './shipping';
import type { CheckoutLine } from './checkout-schema';
import type { CartItem } from '@/types/cart';
import type { CheckoutReview, CreateSessionError, StockIssueItem } from '@/types/checkout';

export type CheckoutVariant = {
  id: string;
  product_id: string;
  name: string;
  price: number;
  stock: number;
  is_active: boolean;
  product: {
    id: string;
    slug: string;
    is_active: boolean;
    name: string;
    allergens: string[] | null;
    allergens_notes: string | null;
    ingredients: string | null;
    storage_conditions: string | null;
    prep_instructions: string | null;
    cooking_method: string | null;
    country_of_origin: string | null;
    label_display_name: string | null;
    label_profile_id: string | null;
    usual_units_per_package: number;
    suggested_package_count: number;
  } | null;
};

// Los mismos datos actuales alimentan la revisión y el snapshot del pedido.
// No hay reservas, descuentos de stock, RPC de pago ni escrituras aquí.
const CHECKOUT_VARIANT_SELECT =
  'id, product_id, name, price, stock, is_active, product:products(id, slug, is_active, name, allergens, allergens_notes, ingredients, storage_conditions, prep_instructions, cooking_method, country_of_origin, label_display_name, label_profile_id, usual_units_per_package, suggested_package_count)';

type AvailabilityResult =
  | { ok: true; review: CheckoutReview; variantMap: Map<string, CheckoutVariant>; requestedQuantityByVariant: Map<string, number> }
  | { ok: false; status: number; error: CreateSessionError };

export async function getCheckoutAvailability(lines: CheckoutLine[]): Promise<AvailabilityResult> {
  try {
    const settings = await getShopSettings();
    if (!settings) throw new Error('No se pudo consultar la apertura');
    if (!settings.acceptingOrders) {
      return { ok: false, status: 503, error: {
        error: 'CHECKOUT_DESHABILITADO',
        message: settings.checkoutDisabledMessage ?? 'En este momento no podemos aceptar pedidos online.',
      } };
    }

    const requestedQuantityByVariant = new Map<string, number>();
    for (const line of lines) {
      requestedQuantityByVariant.set(line.variantId, (requestedQuantityByVariant.get(line.variantId) ?? 0) + line.quantity);
    }
    const { data, error } = await supabaseAdmin.from('product_variants')
      .select(CHECKOUT_VARIANT_SELECT).in('id', [...requestedQuantityByVariant.keys()]);
    if (error || !data) throw error ?? new Error('No se pudieron consultar las variantes');
    const variantMap = new Map((data as unknown as CheckoutVariant[]).map(row => [row.id, row]));
    const issues: StockIssueItem[] = [];
    const items: CartItem[] = [];
    let subtotal = 0;
    let pricesChanged = false;

    for (const [variantId, quantity] of requestedQuantityByVariant) {
      const variant = variantMap.get(variantId);
      const product = variant?.product;
      const selectedLines = lines.filter(line => line.variantId === variantId);
      const available = variant?.is_active === true && product?.is_active === true &&
        variant.product_id === product.id && selectedLines.every(line => line.productSlug === product.slug);
      if (variant && (!Number.isSafeInteger(variant.price) || variant.price < 0 ||
          !Number.isSafeInteger(variant.stock) || variant.stock < 0)) {
        throw new Error('Precio o stock no válido en catálogo');
      }
      if (!available || !variant || !product || quantity > 50 || variant.stock < quantity) {
        issues.push({
          variantId, productName: product?.name ?? 'Producto no disponible', variantName: variant?.name ?? '',
          requestedQuantity: quantity, availableStock: available && variant ? Math.min(variant.stock, 50) : 0, isGift: false,
        });
        continue;
      }
      subtotal += variant.price * quantity;
      pricesChanged ||= selectedLines.some(line => line.expectedUnitPrice !== variant.price);
      items.push({
        variantId, productSlug: product.slug, productName: product.name, variantName: variant.name,
        quantity, unitPrice: variant.price, stock: variant.stock, allergens: product.allergens ?? [], imageUrl: null,
      });
    }
    if (issues.length) {
      return { ok: false, status: 409, error: {
        error: 'STOCK_INSUFICIENTE',
        message: 'Algunos productos ya no están disponibles o no tienen la cantidad solicitada. Revisa el carrito.',
        items: issues,
      } };
    }
    const shippingCost = calculateShippingCost(subtotal);
    if (!Number.isSafeInteger(subtotal + shippingCost)) throw new Error('Importe no válido');
    return { ok: true, variantMap, requestedQuantityByVariant,
      review: { items, subtotal, shippingCost, total: subtotal + shippingCost, pricesChanged } };
  } catch (error) {
    console.error('[checkout] No se pudo comprobar la disponibilidad', error);
    return { ok: false, status: 503, error: {
      error: 'ERROR_INTERNO', message: 'No se ha podido comprobar la disponibilidad. Inténtalo de nuevo antes de pagar.',
    } };
  }
}
