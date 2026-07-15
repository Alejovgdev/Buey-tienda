import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { isAdminAuthenticated } from '@/lib/admin-session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { formatDateTime } from '@/lib/admin/format-datetime';
import AdminHeader from '@/components/Admin/AdminHeader';
import LabelLineCard from '@/components/Admin/Labels/LabelLineCard';
import MarkOrderLabeledButton from '@/components/Admin/Labels/MarkOrderLabeledButton';
import {
  parseFrozenLabelProfileRules,
  resolveLabelValuesFromOrderItem,
  toOperatorData,
} from '@/lib/labels/label-snapshot';
import { suggestPackageCount } from '@/lib/labels/label-package-suggestion';
import type { Tables } from '@/supabase/types';

export const dynamic = 'force-dynamic';

interface EtiquetarPageProps {
  params: Promise<{ id: string }>;
}

type OrderRow = Pick<Tables<'orders'>, 'id' | 'order_number' | 'status' | 'created_at' | 'labeled_at' | 'labeled_by'>;

export default async function EtiquetarPedidoPage({ params }: EtiquetarPageProps) {
  if (!(await isAdminAuthenticated())) {
    redirect('/admin/login');
  }

  const { id: orderId } = await params;

  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('id, order_number, status, created_at, labeled_at, labeled_by')
    .eq('id', orderId)
    .maybeSingle<OrderRow>();

  if (!order) {
    notFound();
  }

  const [{ data: orderItems }, { data: shopSettings }] = await Promise.all([
    supabaseAdmin
      .from('order_items')
      .select('*')
      .eq('order_id', orderId)
      .returns<Tables<'order_items'>[]>(),
    supabaseAdmin
      .from('shop_settings')
      .select(
        'operator_legal_name, operator_tax_id, operator_address, operator_country, operator_health_registry_code, operator_identification_mark'
      )
      .maybeSingle(),
  ]);

  const items = orderItems ?? [];
  const operatorData = toOperatorData(shopSettings ?? null);

  const { data: labels } = await supabaseAdmin
    .from('product_labels')
    .select('*')
    .in('order_item_id', items.length > 0 ? items.map((item) => item.id) : [''])
    .order('package_sequence', { ascending: true })
    .returns<Tables<'product_labels'>[]>();

  const labelsByOrderItem = new Map<string, Tables<'product_labels'>[]>();
  for (const label of labels ?? []) {
    if (!label.order_item_id) continue;
    const list = labelsByOrderItem.get(label.order_item_id) ?? [];
    list.push(label);
    labelsByOrderItem.set(label.order_item_id, list);
  }

  const pendingOrReadyIds = (labels ?? [])
    .filter((label) => label.status === 'PENDING' || label.status === 'READY')
    .map((label) => label.id);

  const linesWithoutFinishedLabels = items.filter((item) => {
    const itemLabels = labelsByOrderItem.get(item.id) ?? [];
    return itemLabels.length === 0 || itemLabels.some((label) => label.status === 'PENDING' || label.status === 'READY');
  });

  return (
    <div>
      <AdminHeader title={`Preparar y etiquetar — ${order.order_number}`} />

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-300 bg-white p-4">
          <div>
            <Link href={`/admin/pedidos/${order.id}`} className="text-sm text-blue-700 hover:underline">
              ← Volver al pedido {order.order_number}
            </Link>
            <p className="text-sm text-gray-500">{formatDateTime(order.created_at)}</p>
            {order.labeled_at && (
              <p className="mt-1 text-sm font-medium text-green-700">
                Marcado como preparado el {formatDateTime(order.labeled_at)} por {order.labeled_by}
              </p>
            )}
          </div>
          {pendingOrReadyIds.length > 0 && (
            <Link
              href={`/admin/pedidos/${order.id}/etiquetas/imprimir?ids=${pendingOrReadyIds.join(',')}`}
              className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
            >
              Imprimir todas las pendientes ({pendingOrReadyIds.length})
            </Link>
          )}
        </div>

        <div className="space-y-4">
          {items.map((item) => {
            const profile = parseFrozenLabelProfileRules(item.label_profile_snapshot);
            const values = resolveLabelValuesFromOrderItem(item, operatorData);
            const suggestedCount = suggestPackageCount(item.quantity, item.suggested_package_count_snapshot ?? 1);

            return (
              <LabelLineCard
                key={item.id}
                orderId={order.id}
                orderItemId={item.id}
                productName={item.product_name_snapshot}
                variantName={item.variant_name_snapshot}
                quantity={item.quantity}
                isGift={item.item_type === 'GIFT'}
                profile={profile}
                operatorData={operatorData}
                lineValues={values}
                suggestedCount={suggestedCount}
                labels={labelsByOrderItem.get(item.id) ?? []}
              />
            );
          })}
          {items.length === 0 && <p className="text-sm text-gray-500">Este pedido no tiene líneas.</p>}
        </div>

        <div className="rounded-lg border border-gray-300 bg-white p-4">
          <MarkOrderLabeledButton
            orderId={order.id}
            disabled={Boolean(order.labeled_at) || linesWithoutFinishedLabels.length > 0}
            disabledReason={
              order.labeled_at
                ? undefined
                : linesWithoutFinishedLabels.length > 0
                  ? 'Quedan líneas con etiquetas pendientes de imprimir o sin generar.'
                  : undefined
            }
          />
        </div>
      </div>
    </div>
  );
}
