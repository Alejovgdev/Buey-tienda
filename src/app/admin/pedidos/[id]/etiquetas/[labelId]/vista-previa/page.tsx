import { notFound, redirect } from 'next/navigation';
import Link from 'next/link';
import { isAdminAuthenticated } from '@/lib/admin-session';
import { FOOD_LABELING_ENABLED } from '@/lib/admin/features';
import { supabaseAdmin } from '@/lib/supabase-admin';
import AdminHeader from '@/components/Admin/AdminHeader';
import FoodLabel from '@/components/Admin/Labels/FoodLabel';
import {
  resolveProfileRulesForOrderItem,
  resolveLabelValuesFromProductLabel,
  toOperatorData,
} from '@/lib/labels/label-snapshot';
import type { Tables } from '@/supabase/types';

export const dynamic = 'force-dynamic';

interface PreviewPageProps {
  params: Promise<{ id: string; labelId: string }>;
}

// Previsualización a tamaño real con el MISMO componente que la impresión
// (FoodLabel) — lo que se ve aquí es exactamente lo que saldrá por la
// impresora (docs/FOOD_LABEL_ADMIN_DESIGN.md, §5.5).
export default async function LabelPreviewPage({ params }: PreviewPageProps) {
  if (!(await isAdminAuthenticated())) {
    redirect('/admin/login');
  }

  if (!FOOD_LABELING_ENABLED) {
    notFound();
  }

  const { id: orderId, labelId } = await params;

  const { data: label } = await supabaseAdmin
    .from('product_labels')
    .select('*')
    .eq('id', labelId)
    .maybeSingle<Tables<'product_labels'>>();

  if (!label) {
    notFound();
  }

  const [{ data: orderItem }, { data: liveProfile }, { data: shopSettings }] = await Promise.all([
    label.order_item_id
      ? supabaseAdmin.from('order_items').select('*').eq('id', label.order_item_id).maybeSingle<Tables<'order_items'>>()
      : Promise.resolve({ data: null }),
    label.label_profile_id
      ? supabaseAdmin
          .from('label_profiles')
          .select('*')
          .eq('id', label.label_profile_id)
          .maybeSingle<Tables<'label_profiles'>>()
      : Promise.resolve({ data: null }),
    supabaseAdmin
      .from('shop_settings')
      .select(
        'operator_legal_name, operator_tax_id, operator_address, operator_country, operator_health_registry_code, operator_identification_mark'
      )
      .maybeSingle(),
  ]);

  const operatorData = toOperatorData(shopSettings ?? null);
  const profile = resolveProfileRulesForOrderItem(orderItem, liveProfile);

  return (
    <div>
      <AdminHeader title="Vista previa de etiqueta" />
      <div className="mx-auto max-w-2xl space-y-4 px-4 py-6 sm:px-6">
        <Link href={`/admin/pedidos/${orderId}/etiquetar`} className="text-sm text-blue-700 hover:underline">
          ← Volver a Preparar y etiquetar
        </Link>

        {!profile ? (
          <p className="rounded-md bg-orange-50 p-4 text-sm text-orange-800">
            No se puede previsualizar: falta un perfil de etiquetado asignado al producto.
          </p>
        ) : (
          <>
            <div className="inline-block border border-dashed border-gray-400 shadow-sm">
              <FoodLabel
                profile={profile}
                values={resolveLabelValuesFromProductLabel(label, operatorData)}
                packageSequence={label.package_sequence}
                packageCountForLine={label.package_count_for_line}
              />
            </div>
            <Link
              href={`/admin/pedidos/${orderId}/etiquetas/imprimir?ids=${label.id}`}
              className="inline-block rounded-md bg-gray-900 px-4 py-2 text-sm font-semibold text-white hover:bg-gray-800"
            >
              Imprimir esta etiqueta
            </Link>
          </>
        )}
      </div>
    </div>
  );
}
