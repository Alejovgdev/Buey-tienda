import { NextResponse } from 'next/server';
import { FOOD_LABELING_ENABLED } from '@/lib/admin/features';
import { getAdminSession } from '@/lib/admin-session';
import { supabaseAdmin } from '@/lib/supabase-admin';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Marca el pedido como etiquetado/preparado: solo se permite cuando todos los
// envases de todas las líneas están impresos, reimpresos o anulados con
// motivo (docs/FOOD_LABEL_ADMIN_DESIGN.md, encargo de implementación). No
// toca orders.status (máquina de estados de pago/envío, sin relación con
// esto) — registra labeled_at/labeled_by y un evento en order_status_history.
export async function POST(_request: Request, { params }: RouteParams) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  if (!FOOD_LABELING_ENABLED) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }

  const { id: orderId } = await params;

  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('id, order_number')
    .eq('id', orderId)
    .maybeSingle<{ id: string; order_number: string }>();

  if (!order) {
    return NextResponse.json({ error: 'Pedido no encontrado' }, { status: 404 });
  }

  const { data: orderItems } = await supabaseAdmin
    .from('order_items')
    .select('id, product_name_snapshot')
    .eq('order_id', orderId)
    .returns<{ id: string; product_name_snapshot: string }[]>();

  if (!orderItems || orderItems.length === 0) {
    return NextResponse.json({ error: 'El pedido no tiene líneas' }, { status: 409 });
  }

  const { data: labels } = await supabaseAdmin
    .from('product_labels')
    .select('order_item_id, status')
    .in(
      'order_item_id',
      orderItems.map((item) => item.id)
    )
    .returns<{ order_item_id: string | null; status: string }[]>();

  const labelsByOrderItem = new Map<string, { order_item_id: string | null; status: string }[]>();
  for (const label of labels ?? []) {
    if (!label.order_item_id) continue;
    const list = labelsByOrderItem.get(label.order_item_id) ?? [];
    list.push(label);
    labelsByOrderItem.set(label.order_item_id, list);
  }

  const pendingLines: string[] = [];
  for (const item of orderItems) {
    const itemLabels = labelsByOrderItem.get(item.id) ?? [];
    const hasUnfinished = itemLabels.length === 0 || itemLabels.some((l) => l.status === 'PENDING' || l.status === 'READY');
    if (hasUnfinished) {
      pendingLines.push(item.product_name_snapshot);
    }
  }

  if (pendingLines.length > 0) {
    return NextResponse.json(
      {
        error: 'Quedan líneas sin etiquetas impresas, reimpresas o anuladas',
        pendingLines,
      },
      { status: 409 }
    );
  }

  const nowIso = new Date().toISOString();
  const { error: updateError } = await supabaseAdmin
    .from('orders')
    .update({ labeled_at: nowIso, labeled_by: session.workerName, updated_at: nowIso })
    .eq('id', orderId);

  if (updateError) {
    return NextResponse.json({ error: 'No se pudo marcar el pedido como preparado' }, { status: 500 });
  }

  await supabaseAdmin.from('order_status_history').insert({
    order_id: orderId,
    event_type: 'PEDIDO_ETIQUETADO',
    metadata: { label_count: labels?.length ?? 0, labeled_by: session.workerName },
  });

  return NextResponse.json({ ok: true });
}
