import { NextResponse } from 'next/server';
import { FOOD_LABELING_ENABLED } from '@/lib/admin/features';
import { getAdminSession } from '@/lib/admin-session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { printLabelsSchema } from '@/lib/labels/label-preparation-schema';
import {
  buildLabelPrintSnapshot,
  resolveProfileRulesForOrderItem,
  resolveLabelValuesFromProductLabel,
  toOperatorData,
} from '@/lib/labels/label-snapshot';
import { getLabelValidationIssues } from '@/lib/labels/label-validation';
import type { Json, Tables, TablesInsert } from '@/supabase/types';

interface PrintResult {
  id: string;
  ok: boolean;
  isReprint?: boolean;
  error?: string;
}

// Registra la impresión/reimpresión de un lote de etiquetas — se llama DESPUÉS
// de que el trabajador confirma que la impresión física salió bien (nunca
// antes de window.print(), ver §5.6/§12 del diseño). Sirve tanto para "una
// etiqueta" como para "todas las pendientes": mismo endpoint, ids=[uno] o
// ids=[varios].
export async function POST(request: Request) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  if (!FOOD_LABELING_ENABLED) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsed = printLabelsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos no válidos', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const { ids, reprintReason } = parsed.data;

  const { data: labels, error: labelsError } = await supabaseAdmin
    .from('product_labels')
    .select('*')
    .in('id', ids)
    .returns<Tables<'product_labels'>[]>();

  if (labelsError) {
    return NextResponse.json({ error: 'No se pudieron leer las etiquetas' }, { status: 500 });
  }

  const labelsById = new Map(labels?.map((label) => [label.id, label]) ?? []);

  const orderItemIds = [...new Set((labels ?? []).map((l) => l.order_item_id).filter((v): v is string => Boolean(v)))];
  const liveProfileIds = [...new Set((labels ?? []).map((l) => l.label_profile_id).filter((v): v is string => Boolean(v)))];

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
  const operator = toOperatorData(shopSettings ?? null);

  const results: PrintResult[] = [];
  const printEventsToInsert: TablesInsert<'label_print_events'>[] = [];
  const labelStatusUpdates: { id: string; status: string }[] = [];

  for (const id of ids) {
    const label = labelsById.get(id);
    if (!label) {
      results.push({ id, ok: false, error: 'Etiqueta no encontrada' });
      continue;
    }
    if (label.status === 'CANCELLED') {
      results.push({ id, ok: false, error: 'Esta etiqueta está anulada' });
      continue;
    }

    const orderItem = label.order_item_id ? orderItemsById.get(label.order_item_id) : null;
    const liveProfile = label.label_profile_id ? liveProfilesById.get(label.label_profile_id) : null;
    const profile = resolveProfileRulesForOrderItem(orderItem, liveProfile);

    if (!profile) {
      results.push({ id, ok: false, error: 'Sin perfil de etiquetado asignado — configúralo antes de imprimir' });
      continue;
    }

    const values = resolveLabelValuesFromProductLabel(label, operator);
    const issues = getLabelValidationIssues(values, profile);
    const blockingIssues = issues.filter((issue) => issue.blocksPrinting);
    if (blockingIssues.length > 0) {
      results.push({ id, ok: false, error: blockingIssues.map((issue) => issue.message).join(' / ') });
      continue;
    }

    const isReprint = label.status === 'PRINTED' || label.status === 'REPRINTED';
    const snapshot = buildLabelPrintSnapshot(label, profile, operator);

    printEventsToInsert.push({
      product_label_id: label.id,
      is_reprint: isReprint,
      reprint_reason: isReprint ? (reprintReason ?? null) : null,
      printed_by: session.workerName,
      session_id: session.sid,
      label_snapshot: snapshot as unknown as Json,
    });
    labelStatusUpdates.push({ id: label.id, status: isReprint ? 'REPRINTED' : 'PRINTED' });
    results.push({ id, ok: true, isReprint });
  }

  if (printEventsToInsert.length > 0) {
    const { error: insertError } = await supabaseAdmin.from('label_print_events').insert(printEventsToInsert);
    if (insertError) {
      return NextResponse.json({ error: 'No se pudo registrar la impresión' }, { status: 500 });
    }

    await Promise.all(
      labelStatusUpdates.map(({ id, status }) =>
        supabaseAdmin
          .from('product_labels')
          .update({ status, updated_by: session.workerName, updated_at: new Date().toISOString() })
          .eq('id', id)
      )
    );
  }

  return NextResponse.json({ ok: true, results });
}
