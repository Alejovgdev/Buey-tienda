import { notFound, redirect } from 'next/navigation';
import { isAdminAuthenticated } from '@/lib/admin-session';
import { FOOD_LABELING_ENABLED } from '@/lib/admin/features';
import { supabaseAdmin } from '@/lib/supabase-admin';
import FoodLabel from '@/components/Admin/Labels/FoodLabel';
import PrintLabelsClient from '@/components/Admin/Labels/PrintLabelsClient';
import {
  resolveProfileRulesForOrderItem,
  resolveLabelValuesFromProductLabel,
  toOperatorData,
  type LabelProfileRules,
  type ResolvedLabelValues,
} from '@/lib/labels/label-snapshot';
import type { Tables } from '@/supabase/types';

export const dynamic = 'force-dynamic';

interface PrintPageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ ids?: string }>;
}

interface PrintableLabel {
  id: string;
  profile: LabelProfileRules | null;
  values: ResolvedLabelValues | null;
  packageSequence: number;
  packageCountForLine: number;
}

// Ruta de SOLO impresión — sin AdminHeader ni navegación (docs/FOOD_LABEL_ADMIN_DESIGN.md,
// §12). El overlay a pantalla completa (fixed inset-0) cubre visualmente el
// resto del sitio en pantalla; el CSS @media print se encarga de que solo se
// impriman las páginas de etiqueta, nunca el resto del panel.
export default async function ImprimirEtiquetasPage({ params, searchParams }: PrintPageProps) {
  if (!(await isAdminAuthenticated())) {
    redirect('/admin/login');
  }

  if (!FOOD_LABELING_ENABLED) {
    notFound();
  }

  const { id: orderId } = await params;
  const { ids: idsParam } = await searchParams;
  const requestedIds = (idsParam ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean);

  if (requestedIds.length === 0) {
    redirect(`/admin/pedidos/${orderId}/etiquetar`);
  }

  const { data: labelRows } = await supabaseAdmin
    .from('product_labels')
    .select('*')
    .in('id', requestedIds)
    .returns<Tables<'product_labels'>[]>();

  const labelsById = new Map((labelRows ?? []).map((label) => [label.id, label]));
  const orderItemIds = [...new Set((labelRows ?? []).map((label) => label.order_item_id).filter((v): v is string => Boolean(v)))];
  const liveProfileIds = [
    ...new Set((labelRows ?? []).map((label) => label.label_profile_id).filter((v): v is string => Boolean(v))),
  ];

  const [{ data: orderItems }, { data: liveProfiles }, { data: shopSettings }] = await Promise.all([
    orderItemIds.length > 0
      ? supabaseAdmin.from('order_items').select('*').in('id', orderItemIds).returns<Tables<'order_items'>[]>()
      : Promise.resolve({ data: [] as Tables<'order_items'>[] }),
    liveProfileIds.length > 0
      ? supabaseAdmin.from('label_profiles').select('*').in('id', liveProfileIds).returns<Tables<'label_profiles'>[]>()
      : Promise.resolve({ data: [] as Tables<'label_profiles'>[] }),
    supabaseAdmin
      .from('shop_settings')
      .select(
        'operator_legal_name, operator_tax_id, operator_address, operator_country, operator_health_registry_code, operator_identification_mark'
      )
      .maybeSingle(),
  ]);

  const orderItemsById = new Map((orderItems ?? []).map((item) => [item.id, item]));
  const liveProfilesById = new Map((liveProfiles ?? []).map((profile) => [profile.id, profile]));
  const operatorData = toOperatorData(shopSettings ?? null);

  const printable: PrintableLabel[] = requestedIds.map((id) => {
    const label = labelsById.get(id);
    if (!label) {
      return { id, profile: null, values: null, packageSequence: 0, packageCountForLine: 0 };
    }
    const orderItem = label.order_item_id ? orderItemsById.get(label.order_item_id) : null;
    const liveProfile = label.label_profile_id ? liveProfilesById.get(label.label_profile_id) : null;
    const profile = resolveProfileRulesForOrderItem(orderItem, liveProfile);
    const values = profile ? resolveLabelValuesFromProductLabel(label, operatorData) : null;
    return {
      id,
      profile,
      values,
      packageSequence: label.package_sequence,
      packageCountForLine: label.package_count_for_line,
    };
  });

  const printableIds = printable.filter((item) => item.profile && item.values).map((item) => item.id);

  return (
    <div className="label-print-root fixed inset-0 z-[9999] overflow-y-auto bg-white text-black">
      <style>{`
        @page { size: 100mm 70mm; margin: 0; }
        @media print {
          body { margin: 0; }
          .no-print { display: none !important; }
          /* En impresión, "position: fixed" queda anclado al tamaño de cada
             página (100mm x 70mm por el @page de arriba), así que este
             contenedor deja de poder mostrar los 5+ mm de etiquetas apiladas
             y el navegador renderiza una barra de scroll dentro del propio
             PDF/preview. En pantalla sí debe quedarse "fixed" + scrollable
             (para previsualizar antes de imprimir), pero en impresión debe
             fluir como contenido normal para que "page-break-after" pagine
             cada etiqueta correctamente. */
          .label-print-root {
            position: static !important;
            inset: auto !important;
            overflow: visible !important;
            height: auto !important;
          }
          .label-page { page-break-after: always; break-after: page; }
          .label-page:last-child { page-break-after: auto; }
        }
      `}</style>

      <PrintLabelsClient orderId={orderId} labelIds={printableIds}>
        {printable.map((item) =>
          item.profile && item.values ? (
            <FoodLabel
              key={item.id}
              profile={item.profile}
              values={item.values}
              packageSequence={item.packageSequence}
              packageCountForLine={item.packageCountForLine}
            />
          ) : (
            <div
              key={item.id}
              className="label-page flex items-center justify-center bg-white p-4 text-center text-sm text-red-700"
              style={{ width: '100mm', height: '70mm' }}
            >
              No se puede imprimir: falta un perfil de etiquetado asignado al producto.
            </div>
          )
        )}
      </PrintLabelsClient>
    </div>
  );
}
