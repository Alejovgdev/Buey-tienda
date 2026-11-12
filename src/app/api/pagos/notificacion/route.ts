import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { redsys } from '@/lib/redsys';
import { safeErrorCode } from '@/lib/safe-error-code';
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

// Region fijada en codigo ademas de en vercel.json: aqui se leen los datos del
// pedido (nombre, email, telefono y direccion) para los emails de confirmacion.
// La Politica de Privacidad afirma que Vercel los trata dentro del EEE.
// cdg1 = Paris.
export const preferredRegion = 'cdg1';

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
  terms_version: string | null;
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
  review_required?: boolean;
  paid_at?: string;
  variant_id?: string;
  requested?: number;
  available?: number;
};

type HistoryEvent = {
  order_id: string;
  event_type: string;
  previous_status?: string;
  new_status?: string;
  metadata?: Json;
};

export async function POST(request: Request) {
  const rawBody = await request.text();
  const params = new URLSearchParams(rawBody);

  const notification = {
    Ds_SignatureVersion: params.get('Ds_SignatureVersion') ?? '',
    Ds_MerchantParameters: params.get('Ds_MerchantParameters') ?? '',
    Ds_Signature: params.get('Ds_Signature') ?? '',
  };

  // 1. No acceder a la BD sin verificar antes la firma.
  let result: ReturnType<typeof redsys.processRestNotification>;
  try {
    result = redsys.processRestNotification(notification);
  } catch {
    return new NextResponse('Firma inválida', { status: 400 });
  }

  try {
    return await processVerifiedNotification(result);
  } catch (err) {
    // Incluye rechazos de promesas/transporte, no solo errores devueltos por
    // PostgREST. La RPC puede haber confirmado antes de perder la conexion:
    // recuperar siempre por la misma RPC idempotente, nunca con otro cobro.
    console.error('[pagos/notificacion] Notificacion no procesada: excepcion', {
      stage: 'unexpected', dsOrder: result.Ds_Order, dsResponse: result.Ds_Response,
      dsAmount: result.Ds_Amount, dsAuthorisationCode: result.Ds_AuthorisationCode ?? null, errorCode: safeErrorCode(err),
    });
    return new NextResponse('Error interno', { status: 500 });
  }
}

async function processVerifiedNotification(result: ReturnType<typeof redsys.processRestNotification>) {
  const dsOrder = result.Ds_Order;
  const dsResponse = result.Ds_Response;
  const dsAmount = result.Ds_Amount;
  const dsAuthorisationCode = result.Ds_AuthorisationCode ?? null;
  const paymentContext = { dsOrder, dsResponse, dsAmount, dsAuthorisationCode };
  const processingFailure = (stage: string, err: unknown, orderId?: string) => {
    console.error('[pagos/notificacion] Notificacion no procesada; requiere recuperacion manual', {
      ...paymentContext, stage, orderId, errorCode: safeErrorCode(err),
    });
    return new NextResponse('Error interno', { status: 500 });
  };
  const recordHistory = async (events: HistoryEvent | HistoryEvent[]) => {
    try {
      const { error } = await supabaseAdmin.from('order_status_history').insert(events);
      if (error) throw error;
      return true;
    } catch (err) {
      console.error('[pagos/notificacion] Fallo al guardar historico', {
        ...paymentContext, stage: 'history_insert', errorCode: safeErrorCode(err),
      });
      return false;
    }
  };

  // 2. Un fallo de consulta NO demuestra que el pedido no exista.
  // El 500 expresa fallo de procesamiento; no presupone reintentos de Redsys.
  // Ver docs/T2_RECUPERACION_REDSYS.md para documentacion y recuperacion manual.
  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .select(
      'id, status, order_number, customer_name, customer_last_name, customer_email, customer_phone, shipping_street, shipping_city, shipping_province, shipping_postal_code, shipping_country, shipping_notes, terms_version, subtotal, shipping_cost, total'
    )
    .eq('redsys_ds_order', dsOrder)
    .maybeSingle<OrderRow>();

  if (orderError) return processingFailure('order_lookup', orderError);
  if (!order) {
    console.error('[pagos/notificacion] Pedido no encontrado para Ds_Order', {
      ...paymentContext, stage: 'order_missing',
    });
    return NextResponse.json({ ok: false, review_required: true });
  }

  // 3. Allowlist de Ds_Response.
  if (!isAuthorizedDsResponse(dsResponse)) {
    // Solo se marca PAYMENT_FAILED si el pedido sigue pendiente. Si ya esta
    // en cualquier otro estado (PAID, PREPARING, ya rechazado antes...) una
    // notificacion de rechazo tardia o duplicada no debe pisar ese estado.
    const previousStatus = order.status;
    if (previousStatus === 'PENDING_PAYMENT') {
      const { data: updatedOrder, error: updateError } = await supabaseAdmin
        .from('orders')
        .update({ status: 'PAYMENT_FAILED', updated_at: new Date().toISOString() })
        .eq('id', order.id)
        .eq('status', 'PENDING_PAYMENT')
        .select('id')
        .maybeSingle<{ id: string }>();
      if (updateError) return processingFailure('rejection_update', updateError, order.id);
      // Otra notificacion o el operador avanzo el estado: no inventar una
      // transicion a PAYMENT_FAILED en el historico ni sobrescribirlo.
      if (!updatedOrder) return NextResponse.json({ ok: true });
    }

    const historySaved = await recordHistory({
      order_id: order.id,
      event_type: 'PAGO_FALLIDO',
      previous_status: previousStatus,
      new_status: previousStatus === 'PENDING_PAYMENT' ? 'PAYMENT_FAILED' : previousStatus,
      metadata: { ds_response: dsResponse, ds_order: dsOrder, ds_amount: dsAmount },
    });
    if (!historySaved) return new NextResponse('Error interno', { status: 500 });

    return NextResponse.json({ ok: true });
  }

  // Importe, duplicados y estado operativo se comprueban bajo el bloqueo
  // de orders en la RPC; ninguna escritura depende de esta lectura previa.

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
    return processingFailure('items_lookup', itemsError ?? new Error('Pedido sin lineas'), order.id);
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
      p_redsys_ds_order: dsOrder,
      p_redsys_ds_response: dsResponse,
      p_redsys_authorization: dsAuthorisationCode,
      p_amount: Number(dsAmount),
      p_line_items: lineItems,
      p_promotion_id: promotionId ?? undefined,
    });
    if (error || !data) throw error ?? new Error('RPC sin datos');
    rpcResult = data as StockRpcResult;
  } catch (err) {
    return processingFailure('payment_rpc', err, order.id);
  }

  // No aceptar una respuesta vacia/mal formada como confirmacion persistida.
  if (typeof rpcResult.ok !== 'boolean' ||
      (rpcResult.already_processed !== undefined && typeof rpcResult.already_processed !== 'boolean') ||
      (rpcResult.already_processed && !rpcResult.ok)) {
    return processingFailure('payment_rpc_result', rpcResult, order.id);
  }

  // Duplicado confirmado en BD, con independencia del estado operativo.
  // No repetir stock, regalos, historico ni intentos de email.
  if (rpcResult.already_processed) {
    return NextResponse.json({ ok: true });
  }

  if (!rpcResult.ok) {
    if (!rpcResult.review_required && !rpcResult.paid_at) {
      return processingFailure('payment_rpc_result', rpcResult, order.id);
    }
    // La RPC ya ha resuelto el fallo de stock dentro de la transaccion.
    // Las inconsistencias historicas se dejan intactas para conciliacion.
    console.error('[pagos/notificacion] Pago pendiente de revision', {
      ...paymentContext, stage: 'payment_review', orderId: order.id, rpcResult,
    });
    return NextResponse.json({ ok: false, review_required: true });
  }

  // La fecha procede de la misma transaccion que payments y orders.paid_at.
  if (!rpcResult.paid_at) {
    return processingFailure('payment_rpc_result', new Error('RPC sin fecha de pago'), order.id);
  }
  const paidAt = rpcResult.paid_at;

  const historyEvents: HistoryEvent[] = [
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

  // El pago ya esta guardado atomicamente. Un fallo de este historico auxiliar
  // se registra para revision manual y no se presenta como fallo del cobro.
  await recordHistory(historyEvents);

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
    paidAt,
    termsVersion: order.terms_version,
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
    await recordHistory({
      order_id: order.id,
      event_type: 'EMAIL_CLIENTE_ENVIADO',
    });
  } catch (err) {
    console.error('[pagos/notificacion] Error enviando email al cliente', { orderId: order.id, errorCode: safeErrorCode(err) });
    await recordHistory({
      order_id: order.id,
      event_type: 'EMAIL_CLIENTE_ERROR',
      metadata: { error: 'No se pudo enviar el correo al cliente' },
    });
  }

  try {
    await sendInternalOrderNotification(emailData);
    await recordHistory({
      order_id: order.id,
      event_type: 'EMAIL_INTERNO_ENVIADO',
    });
  } catch (err) {
    console.error('[pagos/notificacion] Error enviando email interno', { orderId: order.id, errorCode: safeErrorCode(err) });
    await recordHistory({
      order_id: order.id,
      event_type: 'EMAIL_INTERNO_ERROR',
      metadata: { error: 'No se pudo enviar el correo interno' },
    });
  }

  return NextResponse.json({ ok: true });
}
