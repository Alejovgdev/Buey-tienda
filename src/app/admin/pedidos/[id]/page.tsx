import { notFound, redirect } from 'next/navigation';
import { isAdminAuthenticated } from '@/lib/admin-session';
import { FOOD_LABELING_ENABLED } from '@/lib/admin/features';
import { canPrepareBoxLabel } from '@/lib/box-label/schema';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { formatPriceFromCents } from '@/lib/format-price';
import { formatAllergenLabel } from '@/lib/format-allergen';
import { formatDateTime } from '@/lib/admin/format-datetime';
import { classifyIncidentEvent, getMetadataString } from '@/lib/admin/incidents';
import Link from 'next/link';
import AdminHeader from '@/components/Admin/AdminHeader';
import OrderStatusControl from '@/components/Admin/OrderStatusControl';
import OrderNotesForm from '@/components/Admin/OrderNotesForm';
import OrderTimeline, { type TimelineEvent } from '@/components/Admin/OrderTimeline';
import IncidentBanner, { type IncidentEvent } from '@/components/Admin/IncidentBanner';
import type { Json } from '@/supabase/types';

export const dynamic = 'force-dynamic';

interface AdminPedidoDetailPageProps {
  params: Promise<{ id: string }>;
}

type HistoryRow = TimelineEvent & { metadata: Json | null };

type GiftVariantRow = {
  id: string;
  name: string;
  products: { name: string } | null;
};

type OrderDetailRow = {
  id: string;
  order_number: string;
  status: string;
  created_at: string;
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
  admin_notes: string | null;
  labeled_at?: string | null;
  labeled_by?: string | null;
  terms_version: string | null;
  terms_accepted_at: string | null;
  marketing_consent: boolean | null;
  marketing_consent_at: string | null;
  marketing_consent_version: string | null;
};

type OrderItemDetailRow = {
  id: string;
  product_name_snapshot: string;
  variant_name_snapshot: string;
  unit_price_snapshot: number;
  quantity: number;
  line_total: number;
  allergens_snapshot: string[] | null;
  allergens_notes_snapshot: string | null;
  item_type: string;
};

export default async function AdminPedidoDetailPage({ params }: AdminPedidoDetailPageProps) {
  if (!(await isAdminAuthenticated())) {
    redirect('/admin/login');
  }

  const { id } = await params;

  const { data: order } = await supabaseAdmin
    .from('orders')
    .select(
      'id, order_number, status, created_at, customer_name, customer_last_name, customer_email, customer_phone, shipping_street, shipping_city, shipping_province, shipping_postal_code, shipping_country, shipping_notes, subtotal, shipping_cost, total, admin_notes, terms_version, terms_accepted_at, marketing_consent, marketing_consent_at, marketing_consent_version' +
        (FOOD_LABELING_ENABLED ? ', labeled_at, labeled_by' : '')
    )
    .eq('id', id)
    .maybeSingle<OrderDetailRow>();

  if (!order) {
    notFound();
  }

  const { data: items } = await supabaseAdmin
    .from('order_items')
    .select('id, product_name_snapshot, variant_name_snapshot, unit_price_snapshot, quantity, line_total, allergens_snapshot, allergens_notes_snapshot, item_type')
    .eq('order_id', order.id)
    .returns<OrderItemDetailRow[]>();

  const orderItemIds = (items ?? []).map((item) => item.id);
  const { data: labelStats } = FOOD_LABELING_ENABLED
    ? await supabaseAdmin
        .from('product_labels')
        .select('status')
        .in('order_item_id', orderItemIds.length > 0 ? orderItemIds : [''])
        .returns<{ status: string }[]>()
    : { data: null };

  const totalLabels = labelStats?.length ?? 0;
  const finishedLabels = (labelStats ?? []).filter((label) => label.status !== 'PENDING' && label.status !== 'READY').length;
  const canLabel = order.status === 'PAID' || order.status === 'PREPARING';

  const { data: history } = await supabaseAdmin
    .from('order_status_history')
    .select('id, event_type, previous_status, new_status, notes, metadata, created_at')
    .eq('order_id', order.id)
    .order('created_at', { ascending: true })
    .returns<HistoryRow[]>();

  const incidents: IncidentEvent[] = (history ?? []).flatMap((event) => {
    const severity = classifyIncidentEvent(event.event_type, event.metadata);
    if (!severity) return [];
    return [{ id: event.id, eventType: event.event_type, severity, metadata: event.metadata, createdAt: event.created_at }];
  });

  const giftVariantIds = Array.from(
    new Set(
      incidents
        .map((incident) => getMetadataString(incident.metadata, 'gift_variant_id'))
        .filter((value): value is string => value !== null)
    )
  );

  const giftNames = new Map<string, string>();
  if (giftVariantIds.length > 0) {
    const { data: giftVariants } = await supabaseAdmin
      .from('product_variants')
      .select('id, name, products(name)')
      .in('id', giftVariantIds)
      .returns<GiftVariantRow[]>();

    for (const variant of giftVariants ?? []) {
      giftNames.set(variant.id, `${variant.products?.name ?? 'Producto'} — ${variant.name}`);
    }
  }

  return (
    <div>
      <AdminHeader title={`Pedido ${order.order_number}`} />

      <div className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-300 bg-white p-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">{order.order_number}</h2>
            <p className="text-sm text-gray-500">{formatDateTime(order.created_at)}</p>
          </div>
          <OrderStatusControl orderId={order.id} status={order.status} />
        </div>

        {canPrepareBoxLabel(order.status) && (
          <Link href={`/admin/pedidos/${order.id}/etiqueta-caja`}
            className="inline-block rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800">
            Etiqueta de caja
          </Link>
        )}

        {FOOD_LABELING_ENABLED && (canLabel || order.labeled_at) && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-300 bg-white p-4">
            <div>
              <p className="text-sm font-semibold text-gray-900">Preparar y etiquetar</p>
              <p className="text-sm text-gray-500">
                {finishedLabels} de {totalLabels} envase(s) impresos/anulados
                {order.labeled_at && (
                  <span className="ml-2 font-medium text-green-700">
                    · Etiquetado el {formatDateTime(order.labeled_at)} por {order.labeled_by}
                  </span>
                )}
              </p>
            </div>
            {canLabel && (
              <Link
                href={`/admin/pedidos/${order.id}/etiquetar`}
                className="rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
              >
                Preparar y etiquetar
              </Link>
            )}
          </div>
        )}

        <IncidentBanner incidents={incidents} giftNames={giftNames} />

        <section className="rounded-lg border border-gray-300 bg-white p-4">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">Productos a preparar</h3>
          <ul className="divide-y divide-gray-100">
            {(items ?? []).map((item) => {
              const isGift = item.item_type === 'GIFT';
              return (
                <li key={item.id} className="flex items-start justify-between gap-4 py-3">
                  <div>
                    <p className={isGift ? 'text-base font-bold text-amber-700' : 'text-base font-semibold text-gray-900'}>
                      {isGift && <span className="mr-1" aria-hidden="true">🎁</span>}
                      {item.product_name_snapshot} — {item.variant_name_snapshot} × {item.quantity}
                      {isGift && (
                        <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                          REGALO PROMO
                        </span>
                      )}
                    </p>
                    {item.allergens_snapshot && item.allergens_snapshot.length > 0 ? (
                      <p className="text-sm text-gray-600">
                        Alérgenos: {item.allergens_snapshot.map(formatAllergenLabel).join(', ')}
                      </p>
                    ) : (
                      <p className="text-sm text-gray-400">Alérgenos: —</p>
                    )}
                    {item.allergens_notes_snapshot && (
                      <p className="text-sm italic text-gray-500">{item.allergens_notes_snapshot}</p>
                    )}
                  </div>
                  <p className="whitespace-nowrap font-semibold text-gray-900">{formatPriceFromCents(item.line_total)}</p>
                </li>
              );
            })}
            {(items ?? []).length === 0 && <li className="py-3 text-sm text-gray-500">Sin productos.</li>}
          </ul>
        </section>

        <section className="rounded-lg border border-gray-300 bg-white p-4">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">Totales</h3>
          <div className="space-y-1 text-sm text-gray-700">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{formatPriceFromCents(order.subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Gastos de envío</span>
              <span>{formatPriceFromCents(order.shipping_cost)}</span>
            </div>
            <div className="flex justify-between border-t border-gray-200 pt-1 text-base font-bold text-gray-900">
              <span>Total cobrado</span>
              <span>{formatPriceFromCents(order.total)}</span>
            </div>
          </div>
        </section>

        <section className="rounded-lg border border-gray-300 bg-white p-4">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">Datos del cliente</h3>
          <p className="font-medium text-gray-900">
            {order.customer_name} {order.customer_last_name}
          </p>
          <p className="text-sm text-gray-600">
            {order.customer_email} · {order.customer_phone}
          </p>
        </section>

        <section className="rounded-lg border border-gray-300 bg-white p-4">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">Dirección de envío</h3>
          <p className="text-gray-900">{order.shipping_street}</p>
          <p className="text-gray-900">
            {order.shipping_postal_code} {order.shipping_city} ({order.shipping_province}) · {order.shipping_country}
          </p>
        </section>

        <section className="rounded-lg border border-gray-300 bg-white p-4">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">
            Condiciones aceptadas
          </h3>
          {order.terms_version ? (
            <>
              <p className="font-medium text-gray-900">Versión {order.terms_version}</p>
              <p className="text-sm text-gray-600">
                {order.terms_accepted_at
                  ? `Aceptadas el ${formatDateTime(order.terms_accepted_at)}`
                  : 'Fecha no registrada'}
              </p>
            </>
          ) : (
            <p className="text-gray-700">No registrado.</p>
          )}
        </section>

        <section className="rounded-lg border border-gray-300 bg-white p-4">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">
            Comunicaciones comerciales
          </h3>
          {order.marketing_consent === null ? (
            <p className="text-gray-700">No registrado (pedido anterior a este sistema).</p>
          ) : order.marketing_consent ? (
            <>
              <p className="font-medium text-green-700">
                Consentimiento otorgado al realizar el pedido
              </p>
              <p className="text-sm text-gray-600">
                {order.marketing_consent_at
                  ? `Registrado el ${formatDateTime(order.marketing_consent_at)}`
                  : 'Fecha no registrada'}
                {order.marketing_consent_version
                  ? ` · Texto v${order.marketing_consent_version}`
                  : ''}
              </p>
            </>
          ) : (
            <p className="font-medium text-gray-900">No otorgado durante la compra</p>
          )}
        </section>

        <section className="rounded-lg border border-gray-300 bg-white p-4">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">Observaciones del cliente</h3>
          <p className="text-gray-700">{order.shipping_notes || 'Sin observaciones.'}</p>
        </section>

        <section className="rounded-lg border border-gray-300 bg-white p-4">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">Notas internas</h3>
          <OrderNotesForm orderId={order.id} initialNotes={order.admin_notes} />
        </section>

        <section className="rounded-lg border border-gray-300 bg-white p-4">
          <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-gray-500">Histórico del pedido</h3>
          <OrderTimeline events={history ?? []} />
        </section>
      </div>
    </div>
  );
}
