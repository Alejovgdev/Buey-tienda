import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { getShopSettings } from '@/lib/shop-settings';
import { calculateShippingCost } from '@/lib/shipping';
import { createSessionRequestSchema } from '@/lib/checkout-schema';
import { generateOrderNumber } from '@/lib/order-number';
import { redsys } from '@/lib/redsys';
import type { CreateSessionSuccess, StockIssueItem } from '@/types/checkout';

// Fase 4, Unidad 2. Nucleo del checkout: nada de lo que llega del frontend es
// fiable. Precios, stock y disponibilidad de la promocion se recalculan aqui
// desde BD; si el body trae un total o un precio, se ignora por completo.
export const dynamic = 'force-dynamic';

type VariantRow = {
  id: string;
  name: string;
  price: number;
  stock: number;
  is_active: boolean;
  product: { name: string; allergens: string[] | null; allergens_notes: string | null } | null;
};

type PromotionCandidate = {
  id: string;
  min_subtotal: number | null;
  max_redemptions: number | null;
  current_redemptions: number;
  gift_variant_id: string;
};

function genericErrorResponse() {
  return NextResponse.json(
    { error: 'ERROR_INTERNO', message: 'No se pudo procesar el pedido. Inténtalo de nuevo.' },
    { status: 500 }
  );
}

function getRequestBaseUrl(request: Request) {
  return new URL(request.url).origin;
}

export async function POST(request: Request) {
  let rawBody: unknown;
  try {
    rawBody = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'DATOS_INVALIDOS', message: 'No se ha podido leer el pedido enviado.' },
      { status: 400 }
    );
  }

  // 1. Validacion de servidor (la que cuenta) — el cliente ya valido lo mismo,
  // pero eso es solo UX.
  const parsed = createSessionRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'DATOS_INVALIDOS',
        message: 'Revisa los datos del formulario.',
        fieldErrors: parsed.error.flatten().fieldErrors,
      },
      { status: 400 }
    );
  }
  const { customer, items } = parsed.data;

  // 2. accepting_orders es el primer paso antes de tocar nada mas.
  const shopSettings = await getShopSettings();
  if (!shopSettings?.acceptingOrders) {
    return NextResponse.json(
      {
        error: 'CHECKOUT_DESHABILITADO',
        message:
          shopSettings?.checkoutDisabledMessage ??
          'En este momento no podemos aceptar pedidos online.',
      },
      { status: 503 }
    );
  }

  // 3. Precio y stock reales de cada variante — el precio del body se ignora.
  const variantIds = [...new Set(items.map((line) => line.variantId))];
  const { data: variantRows, error: variantsError } = await supabaseAdmin
    .from('product_variants')
    .select('id, name, price, stock, is_active, product:products(name, allergens, allergens_notes)')
    .in('id', variantIds);

  if (variantsError) {
    return genericErrorResponse();
  }

  const variantMap = new Map(
    ((variantRows as unknown as VariantRow[]) ?? []).map((row) => [row.id, row])
  );

  // Cantidad agregada por variante, por si el body repite el mismo variantId
  // en varias lineas — evita un hueco de sobreventa en la comprobacion de stock.
  const requestedQuantityByVariant = new Map<string, number>();
  for (const line of items) {
    requestedQuantityByVariant.set(
      line.variantId,
      (requestedQuantityByVariant.get(line.variantId) ?? 0) + line.quantity
    );
  }

  const stockIssues: StockIssueItem[] = [];
  let subtotal = 0;

  for (const [variantId, quantity] of requestedQuantityByVariant) {
    const variant = variantMap.get(variantId);
    if (!variant || !variant.is_active) {
      stockIssues.push({
        variantId,
        productName: variant?.product?.name ?? 'Producto no disponible',
        variantName: variant?.name ?? '',
        requestedQuantity: quantity,
        availableStock: 0,
        isGift: false,
      });
      continue;
    }
    if (variant.stock < quantity) {
      stockIssues.push({
        variantId: variant.id,
        productName: variant.product?.name ?? '',
        variantName: variant.name,
        requestedQuantity: quantity,
        availableStock: variant.stock,
        isGift: false,
      });
    }
    subtotal += variant.price * quantity;
  }

  // 5. Envio: misma regla que el carrito (10 €/gratis desde 150 €).
  const shippingCost = calculateShippingCost(subtotal);

  // 6. Promocion — los mismos 4 criterios que el endpoint publico, mas el
  // ORDER BY determinista que la auditoria de Fase 3 encontro que faltaba.
  // Consulta directa con supabaseAdmin: aqui la decision es vinculante, no
  // informativa, asi que no se reutiliza /api/tienda/promocion-activa.
  const nowIso = new Date().toISOString();
  const { data: promoRows, error: promoError } = await supabaseAdmin
    .from('promotions')
    .select('id, min_subtotal, max_redemptions, current_redemptions, gift_variant_id')
    .eq('is_active', true)
    .or(`starts_at.is.null,starts_at.lte.${nowIso}`)
    .or(`ends_at.is.null,ends_at.gte.${nowIso}`)
    .order('created_at', { ascending: true })
    .limit(1);

  if (promoError) {
    return genericErrorResponse();
  }

  const promoCandidate = (promoRows as unknown as PromotionCandidate[] | null)?.[0] ?? null;
  let giftLine: { variant: VariantRow; promotionId: string } | null = null;

  if (promoCandidate) {
    const redemptionsOk =
      promoCandidate.max_redemptions === null ||
      promoCandidate.current_redemptions < promoCandidate.max_redemptions;
    const subtotalOk =
      promoCandidate.min_subtotal === null || subtotal >= promoCandidate.min_subtotal;

    if (redemptionsOk && subtotalOk) {
      const { data: giftVariantRow, error: giftError } = await supabaseAdmin
        .from('product_variants')
        .select('id, name, price, stock, is_active, product:products(name, allergens, allergens_notes)')
        .eq('id', promoCandidate.gift_variant_id)
        .maybeSingle();

      if (giftError) {
        return genericErrorResponse();
      }

      const giftVariant = giftVariantRow as unknown as VariantRow | null;

      if (!giftVariant || !giftVariant.is_active || giftVariant.stock < 1) {
        stockIssues.push({
          variantId: giftVariant?.id ?? null,
          productName: giftVariant?.product?.name ?? 'Regalo de la promoción',
          variantName: giftVariant?.name ?? '',
          requestedQuantity: 1,
          availableStock: giftVariant?.is_active ? giftVariant.stock : 0,
          isGift: true,
        });
      } else {
        giftLine = { variant: giftVariant, promotionId: promoCandidate.id };
      }
    }
  }

  // 7. Si falta stock en cualquier linea (incluido el regalo) -> 409, nada se crea.
  if (stockIssues.length > 0) {
    return NextResponse.json(
      {
        error: 'STOCK_INSUFICIENTE',
        message: 'Uno o más productos de tu carrito ya no tienen el stock disponible que muestran.',
        items: stockIssues,
      },
      { status: 409 }
    );
  }

  const total = subtotal + shippingCost;

  try {
    // 8. order_number y redsys_ds_order, generados atomicamente en BD.
    const [orderNumber, { data: dsOrder, error: dsOrderError }] = await Promise.all([
      generateOrderNumber(),
      supabaseAdmin.rpc('generate_redsys_ds_order'),
    ]);

    if (dsOrderError || !dsOrder) {
      return genericErrorResponse();
    }

    // 9. INSERT orders.
    const { data: order, error: orderError } = await supabaseAdmin
      .from('orders')
      .insert({
        order_number: orderNumber,
        status: 'PENDING_PAYMENT',
        customer_name: customer.customerName,
        customer_last_name: customer.customerLastName,
        customer_email: customer.customerEmail,
        customer_phone: customer.customerPhone,
        shipping_street: customer.shippingStreet,
        shipping_city: customer.shippingCity,
        shipping_province: customer.shippingProvince,
        shipping_postal_code: customer.shippingPostalCode,
        shipping_country: customer.shippingCountry,
        shipping_notes: customer.shippingNotes ?? null,
        subtotal,
        shipping_cost: shippingCost,
        total,
        redsys_ds_order: dsOrder,
      })
      .select('id, order_number')
      .single();

    if (orderError || !order) {
      return genericErrorResponse();
    }

    // 10. INSERT order_items: una linea PRODUCT por variante + GIFT si aplica.
    const orderItemsPayload = [
      ...[...requestedQuantityByVariant].map(([variantId, quantity]) => {
        const variant = variantMap.get(variantId)!;
        return {
          order_id: order.id,
          product_variant_id: variant.id,
          product_name_snapshot: variant.product?.name ?? '',
          variant_name_snapshot: variant.name,
          unit_price_snapshot: variant.price,
          quantity,
          line_total: variant.price * quantity,
          allergens_snapshot: variant.product?.allergens ?? [],
          allergens_notes_snapshot: variant.product?.allergens_notes ?? null,
          item_type: 'PRODUCT',
          promotion_id: null as string | null,
        };
      }),
      ...(giftLine
        ? [
            {
              order_id: order.id,
              product_variant_id: giftLine.variant.id,
              product_name_snapshot: giftLine.variant.product?.name ?? '',
              variant_name_snapshot: giftLine.variant.name,
              unit_price_snapshot: 0,
              quantity: 1,
              line_total: 0,
              allergens_snapshot: giftLine.variant.product?.allergens ?? [],
              allergens_notes_snapshot: giftLine.variant.product?.allergens_notes ?? null,
              item_type: 'GIFT',
              promotion_id: giftLine.promotionId as string | null,
            },
          ]
        : []),
    ];

    const { error: itemsError } = await supabaseAdmin.from('order_items').insert(orderItemsPayload);
    if (itemsError) {
      return genericErrorResponse();
    }

    // 11. Evento de pedido creado.
    await supabaseAdmin.from('order_status_history').insert({
      order_id: order.id,
      event_type: 'PEDIDO_CREADO',
      new_status: 'PENDING_PAYMENT',
      metadata: { itemCount: orderItemsPayload.length, promotionApplied: giftLine !== null },
    });

    // 12-13. Payload de Redsys, firmado con la libreria (nunca a mano). El
    // importe cobrado es solo productos reales + envio — el regalo ya es 0.
    const baseUrl = getRequestBaseUrl(request);
    const { url, body: signedBody } = redsys.createRedirectForm({
      DS_MERCHANT_AMOUNT: String(total),
      DS_MERCHANT_ORDER: dsOrder,
      DS_MERCHANT_MERCHANTCODE: process.env.REDSYS_MERCHANT_CODE!,
      DS_MERCHANT_CURRENCY: '978',
      DS_MERCHANT_TRANSACTIONTYPE: '0',
      DS_MERCHANT_TERMINAL: process.env.REDSYS_TERMINAL!,
      DS_MERCHANT_MERCHANTURL: `${baseUrl}/api/pagos/notificacion`,
      DS_MERCHANT_URLOK: `${baseUrl}/pedido/confirmacion?order=${order.order_number}`,
      DS_MERCHANT_URLKO: `${baseUrl}/carrito?pago=fallido`,
      DS_MERCHANT_PRODUCTDESCRIPTION: `Pedido ${order.order_number}`,
      DS_MERCHANT_TITULAR: `${customer.customerName} ${customer.customerLastName}`,
    });

    // 14. Evento de payload generado.
    await supabaseAdmin.from('order_status_history').insert({
      order_id: order.id,
      event_type: 'REDSYS_PAYLOAD_GENERADO',
      metadata: { dsOrder, amount: total },
    });

    // 15. Lo justo para el auto-submit de la Unidad 3.
    const response: CreateSessionSuccess = {
      orderNumber: order.order_number,
      totalAmount: total,
      redsys: {
        actionUrl: url,
        Ds_SignatureVersion: signedBody.Ds_SignatureVersion,
        Ds_MerchantParameters: signedBody.Ds_MerchantParameters,
        Ds_Signature: signedBody.Ds_Signature,
      },
    };

    return NextResponse.json(response);
  } catch {
    return genericErrorResponse();
  }
}
