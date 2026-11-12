import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { createSessionRequestSchema } from '@/lib/checkout-schema';
import { getCheckoutAvailability, type CheckoutVariant as VariantRow } from '@/lib/checkout-availability';
import { generateOrderNumber } from '@/lib/order-number';
import { redsys } from '@/lib/redsys';
import { TERMS_VERSION } from '@/lib/legal';
import { buildMarketingConsentEvidence } from '@/lib/marketing-consent';
import { createOrderStatusAccess, orderStatusCookieName, ORDER_STATUS_ACCESS_SECONDS } from '@/lib/order-status-access';
import { toLabelProfileRules } from '@/lib/labels/label-snapshot';
import { splitVatIncluded, sumVat, type OrderVatTotals, type VatBreakdown } from '@/lib/vat';
import type { Json, Tables } from '@/supabase/types';
import type { CreateSessionSuccess } from '@/types/checkout';

// Fase 4, Unidad 2. Nucleo del checkout: nada de lo que llega del frontend es
// fiable. Precios, stock y disponibilidad de la promocion se recalculan aqui
// desde BD; si el body trae un total o un precio, se ignora por completo.
export const dynamic = 'force-dynamic';

// Region fijada en codigo ademas de en vercel.json: esta ruta trata datos
// personales (nombre, email, telefono y direccion de entrega) y la Politica de
// Privacidad afirma que Vercel los trata dentro del EEE. Si alguien cambia la
// region en el panel, esto la sigue fijando aqui. cdg1 = Paris.
export const preferredRegion = 'cdg1';

type PromotionCandidate = {
  id: string;
  min_subtotal: number | null;
  max_redemptions: number | null;
  current_redemptions: number;
  gift_variant_id: string;
};

type RedsysProductDescriptionItem = {
  product_name_snapshot: string;
  variant_name_snapshot: string;
  quantity: number;
  item_type: string;
};

const REDSYS_PRODUCT_DESCRIPTION_MAX_LENGTH = 125;

function genericErrorResponse() {
  return NextResponse.json(
    { error: 'ERROR_INTERNO', message: 'No se pudo procesar el pedido. Inténtalo de nuevo.' },
    { status: 500 }
  );
}

function getRequestBaseUrl(request: Request) {
  return new URL(request.url).origin;
}

function toRedsysSafeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^0-9A-Za-z .,:;_\-+/()]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function truncateRedsysText(value: string, maxLength: number) {
  const safeValue = toRedsysSafeText(value);
  if (safeValue.length <= maxLength) {
    return safeValue;
  }

  if (maxLength <= 3) {
    return safeValue.slice(0, maxLength);
  }

  return `${safeValue.slice(0, maxLength - 3).trimEnd()}...`;
}

function formatRedsysProductLabel(item: RedsysProductDescriptionItem) {
  const variantName =
    item.variant_name_snapshot &&
    item.variant_name_snapshot.toLowerCase() !== item.product_name_snapshot.toLowerCase()
      ? ` ${item.variant_name_snapshot}`
      : '';
  const quantityPrefix = item.quantity > 1 ? `${item.quantity}x ` : '';

  return toRedsysSafeText(`${quantityPrefix}${item.product_name_snapshot}${variantName}`);
}

function buildRedsysProductDescription(
  items: RedsysProductDescriptionItem[],
  orderNumber: string
) {
  const orderSuffix = toRedsysSafeText(`Pedido ${orderNumber}`);
  const suffix = ` - ${orderSuffix}`;
  const productLabels = items
    .filter((item) => item.item_type === 'PRODUCT')
    .map(formatRedsysProductLabel)
    .filter(Boolean);

  if (productLabels.length === 0) {
    return truncateRedsysText(orderSuffix, REDSYS_PRODUCT_DESCRIPTION_MAX_LENGTH);
  }

  let description = '';
  let omittedItems = 0;

  for (let index = 0; index < productLabels.length; index += 1) {
    const label = productLabels[index];
    const candidate = description ? `${description}, ${label}` : label;

    if ((candidate + suffix).length <= REDSYS_PRODUCT_DESCRIPTION_MAX_LENGTH) {
      description = candidate;
      continue;
    }

    omittedItems = productLabels.length - index;
    break;
  }

  if (!description) {
    const maxProductLength = REDSYS_PRODUCT_DESCRIPTION_MAX_LENGTH - suffix.length;
    if (maxProductLength > 10) {
      return `${truncateRedsysText(productLabels[0], maxProductLength)}${suffix}`;
    }

    return truncateRedsysText(productLabels[0], REDSYS_PRODUCT_DESCRIPTION_MAX_LENGTH);
  }

  if (omittedItems > 0) {
    const moreText = toRedsysSafeText(` + ${omittedItems} mas`);
    const candidate = `${description}${moreText}${suffix}`;

    if (candidate.length <= REDSYS_PRODUCT_DESCRIPTION_MAX_LENGTH) {
      return candidate;
    }
  }

  return `${description}${suffix}`;
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
  const { customer, items, expectedTotal } = parsed.data;

  // Releer siempre, aunque el cliente acabe de revisar el checkout. La revisión
  // no reserva stock ni autoriza un cobro con precios que hayan cambiado.
  const availability = await getCheckoutAvailability(items);
  if (!availability.ok) {
    return NextResponse.json(availability.error, { status: availability.status });
  }
  const { variantMap, requestedQuantityByVariant, review } = availability;
  if (review.pricesChanged || expectedTotal !== review.total) {
    return NextResponse.json({
      error: 'PRECIOS_ACTUALIZADOS',
      message: 'Los precios han cambiado. Revisa el nuevo total y vuelve a pulsar «Pagar con tarjeta» si quieres continuar.',
      review,
    }, { status: 409 });
  }
  const { subtotal, shippingCost, total } = review;

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
  let giftUnavailable = false;

  if (promoCandidate) {
    const redemptionsOk =
      promoCandidate.max_redemptions === null ||
      promoCandidate.current_redemptions < promoCandidate.max_redemptions;
    const subtotalOk =
      promoCandidate.min_subtotal === null || subtotal >= promoCandidate.min_subtotal;

    if (redemptionsOk && subtotalOk) {
      const { data: giftVariantRow, error: giftError } = await supabaseAdmin
        .from('product_variants')
        .select(
      'id, name, price, stock, is_active, product:products(name, allergens, allergens_notes, ingredients, storage_conditions, prep_instructions, cooking_method, country_of_origin, label_display_name, label_profile_id, usual_units_per_package, suggested_package_count, vat_rate)'
    )
        .eq('id', promoCandidate.gift_variant_id)
        .maybeSingle();

      if (giftError) {
        return genericErrorResponse();
      }

      const giftVariant = giftVariantRow as unknown as VariantRow | null;

      if (!giftVariant || !giftVariant.is_active || giftVariant.stock < 1) {
        // Regla fundamental (seccion 13 del MVP doc): si el regalo no se
        // puede aplicar por cualquier motivo, el pedido continua sin el
        // regalo. Nunca se bloquea el checkout por falta de stock del regalo.
        giftUnavailable = true;
      } else {
        giftLine = { variant: giftVariant, promotionId: promoCandidate.id };
      }
    }
  }

  // 7bis. IVA (paso 3). Los importes son IVA incluido y no cambian: solo se
  // desglosan en base + cuota por linea (src/lib/vat.ts). Tipo del producto
  // (products.vat_rate) y del envio (shop_settings.shipping_vat_rate), leidos
  // de BD en cada pedido. Regalo y envio gratis: tipo null, base 0, cuota 0.
  const { data: vatSettings, error: vatSettingsError } = await supabaseAdmin
    .from('shop_settings')
    .select('shipping_vat_rate')
    .maybeSingle();
  if (vatSettingsError || !vatSettings) {
    return genericErrorResponse();
  }

  let productLinesVat: Map<string, VatBreakdown>;
  let shippingVat: VatBreakdown;
  let orderVatTotals: OrderVatTotals;
  try {
    productLinesVat = new Map(
      [...requestedQuantityByVariant].map(([variantId, quantity]) => {
        const variant = variantMap.get(variantId)!;
        return [variantId, splitVatIncluded(variant.price * quantity, Number(variant.product?.vat_rate))];
      })
    );
    shippingVat = splitVatIncluded(shippingCost, Number(vatSettings.shipping_vat_rate));
    orderVatTotals = sumVat([...productLinesVat.values(), shippingVat]);
  } catch {
    return genericErrorResponse();
  }
  if (orderVatTotals.taxBaseTotal + orderVatTotals.vatTotal !== total) {
    return genericErrorResponse();
  }

  try {
    // 8. order_number y redsys_ds_order, generados atomicamente en BD.
    const [orderNumber, { data: dsOrder, error: dsOrderError }] = await Promise.all([
      generateOrderNumber(),
      supabaseAdmin.rpc('generate_redsys_ds_order'),
    ]);

    if (dsOrderError || !dsOrder) {
      return genericErrorResponse();
    }
    const statusAccess = await createOrderStatusAccess(orderNumber);

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
        shipping_vat_rate: shippingVat.vatRate,
        shipping_tax_base: shippingVat.taxBase,
        shipping_vat_amount: shippingVat.vatAmount,
        tax_base_total: orderVatTotals.taxBaseTotal,
        vat_total: orderVatTotals.vatTotal,
        redsys_ds_order: dsOrder,
        // Paso 5. Prueba de que este cliente acepto el contrato y de QUE texto
        // acepto. La version sale de la constante del servidor, nunca del body:
        // `customer` ya paso por el schema y solo trae acceptTerms: true, que es
        // el booleano que exige el checkbox — que version se registra no es
        // decision del cliente.
        terms_version: TERMS_VERSION,
        terms_accepted_at: new Date().toISOString(),
        // Paso 7. La elección comercial es independiente del contrato. Para
        // pedidos nuevos se guarda siempre true/false; la fecha y la versión
        // solo existen si hubo consentimiento afirmativo. La versión procede
        // del servidor y nunca del body.
        ...buildMarketingConsentEvidence(customer.marketingConsent),
      })
      .select('id, order_number')
      .single();

    if (orderError || !order) {
      return genericErrorResponse();
    }

    // 9bis. Sistema de etiquetado alimentario (docs/FOOD_LABEL_ADMIN_DESIGN.md,
    // §6.4 y §7): perfiles de etiquetado referenciados por las variantes de
    // esta compra, congelados junto al resto del snapshot legal para que una
    // edición posterior del perfil no altere las etiquetas de un pedido ya
    // hecho.
    const labelProfileIds = [
      ...new Set(
        [...variantMap.values(), ...(giftLine ? [giftLine.variant] : [])]
          .map((variant) => variant.product?.label_profile_id)
          .filter((id): id is string => Boolean(id))
      ),
    ];

    const labelProfileRulesById = new Map<string, ReturnType<typeof toLabelProfileRules>>();
    if (labelProfileIds.length > 0) {
      const { data: labelProfileRows } = await supabaseAdmin
        .from('label_profiles')
        .select('*')
        .in('id', labelProfileIds)
        .returns<Tables<'label_profiles'>[]>();

      for (const row of labelProfileRows ?? []) {
        labelProfileRulesById.set(row.id, toLabelProfileRules(row));
      }
    }

    function buildLabelSnapshotFields(variant: VariantRow) {
      const product = variant.product;
      const labelProfileId = product?.label_profile_id ?? null;
      const labelProfileRules = labelProfileId ? (labelProfileRulesById.get(labelProfileId) ?? null) : null;
      return {
        ingredients_snapshot: product?.ingredients ?? null,
        storage_conditions_snapshot: product?.storage_conditions ?? null,
        prep_instructions_snapshot: product?.prep_instructions ?? null,
        cooking_method_snapshot: product?.cooking_method ?? null,
        country_of_origin_snapshot: product?.country_of_origin ?? null,
        label_display_name_snapshot: product?.label_display_name ?? null,
        usual_units_per_package_snapshot: product?.usual_units_per_package ?? null,
        suggested_package_count_snapshot: product?.suggested_package_count ?? null,
        label_profile_id_snapshot: labelProfileId,
        label_profile_snapshot: (labelProfileRules as unknown as Json) ?? null,
      };
    }

    // 10. INSERT order_items: una linea PRODUCT por variante + GIFT si aplica.
    const orderItemsPayload = [
      ...[...requestedQuantityByVariant].map(([variantId, quantity]) => {
        const variant = variantMap.get(variantId)!;
        const lineVat = productLinesVat.get(variantId)!;
        return {
          order_id: order.id,
          product_variant_id: variant.id,
          product_name_snapshot: variant.product?.name ?? '',
          variant_name_snapshot: variant.name,
          unit_price_snapshot: variant.price,
          quantity,
          line_total: variant.price * quantity,
          vat_rate: lineVat.vatRate,
          tax_base: lineVat.taxBase,
          vat_amount: lineVat.vatAmount,
          allergens_snapshot: variant.product?.allergens ?? [],
          allergens_notes_snapshot: variant.product?.allergens_notes ?? null,
          item_type: 'PRODUCT',
          promotion_id: null as string | null,
          ...buildLabelSnapshotFields(variant),
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
              // Regalo: linea a 0 € sin IVA propio.
              vat_rate: null as number | null,
              tax_base: 0,
              vat_amount: 0,
              allergens_snapshot: giftLine.variant.product?.allergens ?? [],
              allergens_notes_snapshot: giftLine.variant.product?.allergens_notes ?? null,
              item_type: 'GIFT',
              promotion_id: giftLine.promotionId as string | null,
              ...buildLabelSnapshotFields(giftLine.variant),
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

    // El pedido se creo sin el regalo porque no habia stock (o estaba
    // inactivo) en el momento del checkout - se deja rastro para el panel
    // admin, igual que hace la RPC de confirmacion (migracion 0011) cuando el
    // regalo se agota justo antes de confirmar el pago.
    if (giftUnavailable && promoCandidate) {
      await supabaseAdmin.from('order_status_history').insert({
        order_id: order.id,
        event_type: 'PROMOCION_NO_APLICADA',
        metadata: { promotion_id: promoCandidate.id, reason: 'SIN_STOCK_REGALO_EN_CHECKOUT' },
      });
    }

    // 12-13. Payload de Redsys, firmado con la libreria (nunca a mano). El
    // importe cobrado es solo productos reales + envio — el regalo ya es 0.
    const baseUrl = getRequestBaseUrl(request);
    const redsysProductDescription = buildRedsysProductDescription(
      orderItemsPayload,
      order.order_number
    );
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
      DS_MERCHANT_PRODUCTDESCRIPTION: redsysProductDescription,
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

    const result = NextResponse.json(response, { headers: { 'Cache-Control': 'no-store' } });
    result.cookies.set(orderStatusCookieName(order.order_number), statusAccess, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/api/pedidos/estado',
      maxAge: ORDER_STATUS_ACCESS_SECONDS,
    });
    return result;
  } catch {
    return genericErrorResponse();
  }
}
