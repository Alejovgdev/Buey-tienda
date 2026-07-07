import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { redsys } from '@/lib/redsys';
import {
  sendCustomerConfirmationEmail,
  sendInternalOrderNotification,
  type OrderEmailData,
} from '@/lib/email/send-order-notifications';
import type { Json } from '@/supabase/types';

// Fase 5, Unidad 2. Ya no es el stub de Fase 4: aqui se decide de verdad si
// un pago se confirma o se rechaza. Regla de la casa: ALLOWLIST, no blocklist.
// Solo el rango 0000-0099, con el formato exacto de 4 digitos que exige
// Redsys, autoriza tocar stock/promocion/status. Cualquier otro valor -
// incluido uno que no reconozcamos, tipo un codigo inventado - va por la
// rama de rechazo. Nunca al reves.
export const dynamic = 'force-dynamic';

// "26000001" -> true. "0596", "9999", "abcd", "123" (3 digitos) -> false.
// Se exige el formato de 4 digitos ademas del rango numerico: un Ds_Response
// mal formado no es "raro pero probablemente ok", es directamente rechazo.
function isAuthorizedDsResponse(dsResponse: string): boolean {
  if (!/^\d{4}$/.test(dsResponse)) return false;
  const code = Number(dsResponse);
  return code >= 0 && code <= 99;
}

type OrderRow = {
  id: string;
  status: string;
  order_number: string;
  customer_name: string;
  customer_last_name: string;
  customer_email: string;
  customer_phone: string;
  shipping_street: string;
  shipping_city: string;
  shipping_province: string;
  shipping_postal_code: string;
  shipping_country: string;
  shipping_notes: string | null;
  subtotal: number;
  shipping_cost: number;
  total: number;
};

type OrderItemRow = {
  product_variant_id: string | null;
  product_name_snapshot: string;
  variant_name_snapshot: string;
  unit_price_snapshot: number;
  quantity: number;
  line_total: number;
  allergens_snapshot: string[] | null;
  allergens_notes_snapshot: string | null;
  item_type: string;
  promotion_id: string | null;
};

type StockRpcResult = {
  ok: boolean;
  already_processed?: boolean;
  promotion_consumed?: boolean;
  gift_skipped_no_stock?: boolean;
  error?: string;
  variant_id?: string;
  requested?: number;
  available?: number;
};

export async function POST(request: Request) {
  const rawBody = await request.text();
  const params = new URLSearchParams(rawBody);

  const notification = {
    Ds_SignatureVersion: params.get('Ds_SignatureVersion') ?? '',
    Ds_MerchantParameters: params.get('Ds_MerchantParameters') ?? '',
    Ds_Signature: params.get('Ds_Signature') ?? '',
  };

  // 1. Firma invalida = alguien suplantando a Redsys. Unico caso que no
  // responde el acuse de recibo esperado.
  let result: ReturnType<typeof redsys.processRestNotification>;
  try {
    result = redsys.processRestNotification(notification);
  } catch {
    return new NextResponse('Firma inválida', { status: 400 });
  }

  const dsOrder = result.Ds_Order;
  const dsResponse = result.Ds_Response;
  const dsAmount = result.Ds_Amount;
  const dsAuthorisationCode = result.Ds_AuthorisationCode ?? null;

  // 2. Pedido no encontrado: no hay nada que Redsys pueda reintentar que
  // vaya a arreglar esto, asi que se responde el acuse igual (evita
  // reintentos infinitos de Redsys), pero se deja constancia en los logs del
  // servidor porque es una anomalia real (dsOrder que no existe en BD).
  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select(
      'id, status, order_number, customer_name, customer_last_name, customer_email, customer_phone, shipping_street, shipping_city, shipping_province, shipping_postal_code, shipping_country, shipping_notes, subtotal, shipping_cost, total'
    )
    .eq('redsys_ds_order', dsOrder)
    .maybeSingle<OrderRow>();

  if (orderError || !order) {
    console.error('[pagos/notificacion] Pedido no encontrado para Ds_Order', {
      dsOrder,
      dsResponse,
      supabaseError: orderError?.message,
    });
    return NextResponse.json({ ok: true });
  }

  // 3. Allowlist de Ds_Response.
  if (!isAuthorizedDsResponse(dsResponse)) {
    // Solo se marca PAYMENT_FAILED si el pedido sigue pendiente. Si ya esta
    // en cualquier otro estado (PAID, PREPARING, ya rechazado antes...) una
    // notificacion de rechazo tardia o duplicada no debe pisar ese estado.
    const previousStatus = order.status;
    if (previousStatus === 'PENDING_PAYMENT') {
      await supabaseAdmin
        .from('orders')
        .update({ status: 'PAYMENT_FAILED', updated_at: new Date().toISOString() })
        .eq('id', order.id);
    }

    await supabaseAdmin.from('order_status_history').insert({
      order_id: order.id,
      event_type: 'PAGO_FALLIDO',
      previous_status: previousStatus,
      new_status: previousStatus === 'PENDING_PAYMENT' ? 'PAYMENT_FAILED' : previousStatus,
      metadata: { ds_response: dsResponse, ds_order: dsOrder, ds_amount: dsAmount },
    });

    return NextResponse.json({ ok: true });
  }

  // 3bis. Coherencia de importe (auditoria Fase 5 "final boss", hallazgo
  // 5bis): la firma HMAC-SHA256 solo prueba que el mensaje lo firmo quien
  // conoce la clave del comercio, no que el importe tenga relacion con lo que
  // el pedido vale. Si el pedido ya esta PAID, la idempotencia de la RPC de
  // mas abajo ya sale sin tocar nada (already_processed:true) - no hace falta
  // ni conviene comparar aqui, para no bloquear ese camino ya seguro.
  if (order.status !== 'PAID' && Number(dsAmount) !== order.total) {
    await supabaseAdmin
      .from('orders')
      .update({ status: 'NEEDS_REVIEW', updated_at: new Date().toISOString() })
      .eq('id', order.id);

    await supabaseAdmin.from('order_status_history').insert({
      order_id: order.id,
      event_type: 'IMPORTE_INCOHERENTE',
      previous_status: order.status,
      new_status: 'NEEDS_REVIEW',
      metadata: { ds_amount: dsAmount, order_total: order.total, ds_order: dsOrder },
    });

    return NextResponse.json({ ok: true });
  }

  // 4. Camino de exito: leer las lineas del pedido (todas, PRODUCT y GIFT -
  // el regalo tambien descuenta stock real, salvo que se agote justo antes de
  // confirmar, ver mas abajo) y delegar la idempotencia, el descuento de
  // stock y el consumo de promocion a la RPC de la Unidad 1.
  const { data: itemRows, error: itemsError } = await supabaseAdmin
    .from('order_items')
    .select(
      'product_variant_id, product_name_snapshot, variant_name_snapshot, unit_price_snapshot, quantity, line_total, allergens_snapshot, allergens_notes_snapshot, item_type, promotion_id'
    )
    .eq('order_id', order.id)
    .returns<OrderItemRow[]>();

  if (itemsError || !itemRows || itemRows.length === 0) {
    console.error('[pagos/notificacion] No se pudieron leer las lineas del pedido', {
      orderId: order.id,
      dsOrder,
      supabaseError: itemsError?.message,
    });
    return new NextResponse('Error interno', { status: 500 });
  }

  // item_type viaja a la RPC (migracion 0011) para que pueda distinguir la
  // linea de regalo de un producto real y, si el regalo se queda sin stock
  // justo antes de confirmar, omitirla sin bloquear el resto del pedido.
  const lineItems = itemRows
    .filter((item): item is OrderItemRow & { product_variant_id: string } => item.product_variant_id !== null)
    .map((item) => ({
      variant_id: item.product_variant_id,
      quantity: item.quantity,
      item_type: item.item_type === 'GIFT' ? 'GIFT' : 'PRODUCT',
    }));

  const giftItem = itemRows.find((item) => item.item_type === 'GIFT');
  const promotionId = giftItem?.promotion_id ?? null;

  let rpcResult: StockRpcResult | null = null;
  try {
    const { data, error } = await supabaseAdmin.rpc('decrement_stock_and_confirm_order', {
      p_order_id: order.id,
      p_line_items: lineItems,
      p_promotion_id: promotionId ?? undefined,
    });
    if (error || !data) throw error ?? new Error('RPC sin datos');
    rpcResult = data as StockRpcResult;
  } catch (err) {
    console.error('[pagos/notificacion] Error inesperado llamando a la RPC de stock', {
      orderId: order.id,
      dsOrder,
      err,
    });
    return new NextResponse('Error interno', { status: 500 });
  }

  // Notificacion duplicada: la primera llamada ya dejo el pedido en PAID
  // (payments, historico y emails ya se hicieron entonces). Nada que repetir.
  if (rpcResult.already_processed) {
    return NextResponse.json({ ok: true });
  }

  if (!rpcResult.ok) {
    // Pago ya cobrado por Redsys pero sin stock suficiente en el momento de
    // confirmar. No se automatiza el reembolso - resolucion manual.
    await supabaseAdmin
      .from('orders')
      .update({ status: 'STOCK_ERROR', updated_at: new Date().toISOString() })
      .eq('id', order.id);

    await supabaseAdmin.from('order_status_history').insert({
      order_id: order.id,
      event_type: 'STOCK_ERROR',
      previous_status: order.status,
      new_status: 'STOCK_ERROR',
      metadata: {
        rpc_error: rpcResult.error,
        variant_id: rpcResult.variant_id,
        requested: rpcResult.requested,
        available: rpcResult.available,
      },
    });

    return NextResponse.json({ ok: true });
  }

  // Pago confirmado, stock descontado, promocion resuelta (si aplicaba) -
  // todo dentro de la misma transaccion de la RPC.
  await supabaseAdmin.from('payments').insert({
    order_id: order.id,
    redsys_ds_order: dsOrder,
    redsys_ds_response: dsResponse,
    redsys_authorization: dsAuthorisationCode,
    amount: Number(dsAmount),
    status: 'succeeded',
    paid_at: new Date().toISOString(),
  });

  const historyEvents: Array<{
    order_id: string;
    event_type: string;
    previous_status?: string;
    new_status?: string;
    metadata?: Json;
  }> = [
    {
      order_id: order.id,
      event_type: 'PAGO_CONFIRMADO',
      previous_status: order.status,
      new_status: 'PAID',
      metadata: { ds_response: dsResponse, ds_authorization: dsAuthorisationCode },
    },
    { order_id: order.id, event_type: 'STOCK_DESCONTADO' },
  ];

  // gift_skipped_no_stock (migracion 0011): el regalo se prometio en el
  // checkout pero se agoto justo antes de confirmar el pago. El pedido se
  // cobra y confirma igual (los productos reales si tenian stock), pero sin
  // el regalo - ni se descuenta su stock ni cuenta como canje de la promocion.
  const giftSkippedNoStock = Boolean(rpcResult.gift_skipped_no_stock);

  if (promotionId) {
    if (rpcResult.promotion_consumed) {
      historyEvents.push({ order_id: order.id, event_type: 'PROMOCION_APLICADA', metadata: { promotion_id: promotionId } });
    } else if (giftSkippedNoStock) {
      historyEvents.push({
        order_id: order.id,
        event_type: 'PROMOCION_NO_APLICADA',
        metadata: {
          promotion_id: promotionId,
          reason: 'SIN_STOCK_REGALO_EN_CONFIRMACION',
          gift_variant_id: giftItem?.product_variant_id ?? null,
          motivo_legible:
            'ACCIÓN REQUERIDA: el email de confirmación ya le promete el regalo a este cliente con normalidad (no se le oculta ni se le avisa de nada), pero no había stock al confirmar el pago. El cliente espera recibirlo - el restaurante debe hacérselo llegar sí o sí (contactar al cliente o reponer una unidad para su envío).',
        },
      });
    } else {
      historyEvents.push({
        order_id: order.id,
        event_type: 'PROMOCION_NO_APLICADA',
        metadata: { promotion_id: promotionId, reason: 'AGOTADA' },
      });

      // Hallazgo 2 de la auditoria "final boss" (docs/auditoria-fase-5-final-boss.md):
      // aceptado como riesgo, no corregido - la RPC ya descontó el stock del
      // regalo para este pedido (no esta en la rama gift_skipped_no_stock),
      // pero el cupo de la promocion se lo llevo otro pedido de la misma
      // rafaga antes de que este confirmara. El cliente recibe el regalo
      // igualmente; esto es solo una marca informativa para que el futuro
      // panel admin pueda ver cuando ha ocurrido el desajuste.
      historyEvents.push({
        order_id: order.id,
        event_type: 'REGALO_ENTREGADO_SIN_CANJE_CONTADO',
        metadata: {
          promotion_id: promotionId,
          gift_variant_id: giftItem?.product_variant_id ?? null,
          motivo_legible:
            'El cliente recibió el regalo pero no contó como canje oficial de la promoción — la promoción ya estaba agotada cuando se confirmó este pago',
        },
      });
    }
  }

  await supabaseAdmin.from('order_status_history').insert(historyEvents);

  // 5. Emails: nunca deben romper el acuse a Redsys. Cada uno en su propio
  // try/catch - si el del cliente falla se intenta igual el interno.
  // Decision de negocio (revisada): el cliente ya vio el regalo prometido en
  // el checkout, asi que su email de confirmacion lo incluye SIEMPRE con
  // total normalidad, identico a un pedido con el regalo en stock - no se le
  // oculta nada ni se le da ninguna explicacion. El compromiso de hacerselo
  // llegar de verdad pasa a ser una obligacion operativa del restaurante,
  // reforzada en el aviso destacado del email interno (giftSkippedNoStock).
  const emailData: OrderEmailData = {
    orderId: order.id,
    orderNumber: order.order_number,
    customerName: order.customer_name,
    customerLastName: order.customer_last_name,
    customerEmail: order.customer_email,
    customerPhone: order.customer_phone,
    shippingStreet: order.shipping_street,
    shippingCity: order.shipping_city,
    shippingProvince: order.shipping_province,
    shippingPostalCode: order.shipping_postal_code,
    shippingCountry: order.shipping_country,
    shippingNotes: order.shipping_notes,
    subtotal: order.subtotal,
    shippingCost: order.shipping_cost,
    total: order.total,
    giftSkippedNoStock,
    items: itemRows.map((item) => ({
      productName: item.product_name_snapshot,
      variantName: item.variant_name_snapshot,
      unitPrice: item.unit_price_snapshot,
      quantity: item.quantity,
      lineTotal: item.line_total,
      allergens: item.allergens_snapshot,
      allergensNotes: item.allergens_notes_snapshot,
      itemType: item.item_type === 'GIFT' ? 'GIFT' : 'PRODUCT',
    })),
  };

  try {
    await sendCustomerConfirmationEmail(emailData);
    await supabaseAdmin.from('order_status_history').insert({
      order_id: order.id,
      event_type: 'EMAIL_CLIENTE_ENVIADO',
    });
  } catch (err) {
    console.error('[pagos/notificacion] Error enviando email al cliente', { orderId: order.id, err });
    await supabaseAdmin.from('order_status_history').insert({
      order_id: order.id,
      event_type: 'EMAIL_CLIENTE_ERROR',
      metadata: { error: err instanceof Error ? err.message : String(err) },
    });
  }

  try {
    await sendInternalOrderNotification(emailData);
    await supabaseAdmin.from('order_status_history').insert({
      order_id: order.id,
      event_type: 'EMAIL_INTERNO_ENVIADO',
    });
  } catch (err) {
    console.error('[pagos/notificacion] Error enviando email interno', { orderId: order.id, err });
    await supabaseAdmin.from('order_status_history').insert({
      order_id: order.id,
      event_type: 'EMAIL_INTERNO_ERROR',
      metadata: { error: err instanceof Error ? err.message : String(err) },
    });
  }

  return NextResponse.json({ ok: true });
}
