import { NextResponse } from 'next/server';
import { FOOD_LABELING_ENABLED } from '@/lib/admin/features';
import { getAdminSession } from '@/lib/admin-session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { generateLabelsSchema } from '@/lib/labels/label-preparation-schema';
import type { Tables } from '@/supabase/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

type OrderItemWithProduct = Pick<Tables<'order_items'>, 'id' | 'order_id' | 'product_variant_id'> & {
  product_variant: Pick<Tables<'product_variants'>, 'product_id'> | null;
};

// Genera etiquetas (una fila de product_labels por envase) para una línea de
// pedido. Un envase físico = una etiqueta (docs/FOOD_LABEL_ADMIN_DESIGN.md, §8).
// Solo permite AÑADIR envases sobre los ya existentes — reducir el número se
// hace anulando etiquetas concretas (POST .../anular), nunca borrando filas,
// para no perder el histórico.
export async function POST(request: Request, { params }: RouteParams) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  if (!FOOD_LABELING_ENABLED) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }

  const { id: orderId } = await params;
  const body = await request.json().catch(() => null);
  const parsed = generateLabelsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos no válidos', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const { orderItemId, desiredCount } = parsed.data;

  const { data: orderItem } = await supabaseAdmin
    .from('order_items')
    .select('id, order_id, product_variant_id, product_variant:product_variants(product_id)')
    .eq('id', orderItemId)
    .eq('order_id', orderId)
    .maybeSingle<OrderItemWithProduct>();

  if (!orderItem) {
    return NextResponse.json({ error: 'Línea de pedido no encontrada' }, { status: 404 });
  }

  const productId = orderItem.product_variant?.product_id;
  if (!productId) {
    return NextResponse.json({ error: 'Esta línea no tiene un producto asociado' }, { status: 400 });
  }

  const { count: existingCount, error: countError } = await supabaseAdmin
    .from('product_labels')
    .select('id', { count: 'exact', head: true })
    .eq('order_item_id', orderItemId)
    .neq('status', 'CANCELLED');

  if (countError) {
    return NextResponse.json({ error: 'No se pudo comprobar las etiquetas existentes' }, { status: 500 });
  }

  const currentCount = existingCount ?? 0;
  if (desiredCount <= currentCount) {
    return NextResponse.json(
      {
        error:
          currentCount === 0
            ? 'El número de envases debe ser mayor que 0'
            : `Ya hay ${currentCount} etiqueta(s) para esta línea. Para reducir el número, anula una etiqueta concreta indicando el motivo — no se puede bajar la cantidad aquí.`,
      },
      { status: 409 }
    );
  }

  const toInsert = Array.from({ length: desiredCount - currentCount }, (_, index) => ({
    order_item_id: orderItemId,
    product_id: productId,
    package_sequence: currentCount + index + 1,
    package_count_for_line: desiredCount,
    created_by: session.workerName,
    updated_by: session.workerName,
  }));

  const { error: insertError } = await supabaseAdmin.from('product_labels').insert(toInsert);
  if (insertError) {
    return NextResponse.json({ error: 'No se pudieron generar las etiquetas' }, { status: 500 });
  }

  if (currentCount > 0) {
    await supabaseAdmin
      .from('product_labels')
      .update({ package_count_for_line: desiredCount })
      .eq('order_item_id', orderItemId)
      .neq('status', 'CANCELLED');
  }

  return NextResponse.json({ ok: true, created: toInsert.length });
}
