import Link from 'next/link';
import { redirect } from 'next/navigation';
import { isAdminAuthenticated } from '@/lib/admin-session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { formatPriceFromCents } from '@/lib/format-price';
import { formatDateTime } from '@/lib/admin/format-datetime';
import { ORDER_STATUSES, ORDER_STATUS_LABELS, isValidOrderStatus } from '@/lib/admin/order-status';
import { classifyIncidentEvent, highestSeverity, INCIDENT_EVENT_TYPES, type IncidentSeverity } from '@/lib/admin/incidents';
import AdminHeader from '@/components/Admin/AdminHeader';
import OrderStatusBadge from '@/components/Admin/OrderStatusBadge';
import IncidentIndicator from '@/components/Admin/IncidentIndicator';
import type { Json } from '@/supabase/types';

export const dynamic = 'force-dynamic';

interface AdminPedidosPageProps {
  searchParams: Promise<{ estado?: string }>;
}

type OrderListRow = {
  id: string;
  order_number: string;
  created_at: string;
  customer_name: string;
  customer_last_name: string;
  total: number;
  status: string;
};

type IncidentHistoryRow = {
  order_id: string;
  event_type: string;
  metadata: Json | null;
};

export default async function AdminPedidosPage({ searchParams }: AdminPedidosPageProps) {
  if (!(await isAdminAuthenticated())) {
    redirect('/admin/login');
  }

  const { estado } = await searchParams;
  const statusFilter = estado && isValidOrderStatus(estado) ? estado : null;

  let query = supabaseAdmin
    .from('orders')
    .select('id, order_number, created_at, customer_name, customer_last_name, total, status')
    .order('created_at', { ascending: false });

  if (statusFilter) {
    query = query.eq('status', statusFilter);
  }

  const { data: orders, error } = await query.returns<OrderListRow[]>();

  if (error) {
    throw new Error('No se pudieron cargar los pedidos');
  }

  const orderRows = orders ?? [];
  const incidentsByOrder = new Map<string, IncidentSeverity>();

  if (orderRows.length > 0) {
    const { data: historyRows } = await supabaseAdmin
      .from('order_status_history')
      .select('order_id, event_type, metadata')
      .in(
        'order_id',
        orderRows.map((order) => order.id)
      )
      .in('event_type', INCIDENT_EVENT_TYPES as readonly string[])
      .returns<IncidentHistoryRow[]>();

    for (const row of historyRows ?? []) {
      const severity = classifyIncidentEvent(row.event_type, row.metadata);
      if (!severity) continue;
      const existing = incidentsByOrder.get(row.order_id);
      const combined = highestSeverity(existing ? [existing, severity] : [severity]);
      if (combined) incidentsByOrder.set(row.order_id, combined);
    }
  }

  return (
    <div>
      <AdminHeader title="Pedidos" />

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <form method="get" className="mb-4 flex flex-wrap items-center gap-2">
          <label htmlFor="estado" className="text-sm font-medium text-gray-700">
            Estado
          </label>
          <select
            id="estado"
            name="estado"
            defaultValue={statusFilter ?? ''}
            className="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm text-gray-900"
          >
            <option value="">Todos</option>
            {ORDER_STATUSES.map((status) => (
              <option key={status} value={status}>
                {ORDER_STATUS_LABELS[status]}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800"
          >
            Filtrar
          </button>
          {statusFilter && (
            <Link href="/admin/pedidos" className="text-sm text-gray-500 underline hover:text-gray-700">
              Quitar filtro
            </Link>
          )}
        </form>

        <div className="overflow-x-auto rounded-lg border border-gray-300 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-semibold text-gray-600">Pedido</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-600">Fecha</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-600">Cliente</th>
                <th className="px-4 py-2 text-right font-semibold text-gray-600">Total</th>
                <th className="px-4 py-2 text-left font-semibold text-gray-600">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {orderRows.map((order) => {
                const incident = incidentsByOrder.get(order.id) ?? null;
                return (
                  <tr key={order.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/admin/pedidos/${order.id}`}
                          className="font-medium text-blue-700 hover:underline"
                        >
                          {order.order_number}
                        </Link>
                        {incident && <IncidentIndicator severity={incident} />}
                      </div>
                    </td>
                    <td className="px-4 py-2 whitespace-nowrap text-gray-700">{formatDateTime(order.created_at)}</td>
                    <td className="px-4 py-2 text-gray-700">
                      {order.customer_name} {order.customer_last_name}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-900">{formatPriceFromCents(order.total)}</td>
                    <td className="px-4 py-2">
                      <OrderStatusBadge status={order.status} />
                    </td>
                  </tr>
                );
              })}
              {orderRows.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                    No hay pedidos{statusFilter ? ' con ese estado' : ''}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
