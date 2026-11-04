import { NextResponse } from 'next/server';
import { FOOD_LABELING_ENABLED } from '@/lib/admin/features';
import { getAdminSession } from '@/lib/admin-session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { updateLabelSchema } from '@/lib/labels/label-preparation-schema';
import type { TablesUpdate } from '@/supabase/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Edita los datos variables de preparación de UNA etiqueta (un envase físico).
// Nunca toca products/product_variants/order_items — solo product_labels
// (docs/FOOD_LABEL_ADMIN_DESIGN.md, §13). Si la etiqueta ya estaba impresa,
// pasa a "READY" (lista para reimprimir con los datos nuevos): el contenido
// ya impreso en papel no cambia solo porque se edite el borrador.
export async function PATCH(request: Request, { params }: RouteParams) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  if (!FOOD_LABELING_ENABLED) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateLabelSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos no válidos', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { data: label } = await supabaseAdmin
    .from('product_labels')
    .select('id, status')
    .eq('id', id)
    .maybeSingle<{ id: string; status: string }>();

  if (!label) {
    return NextResponse.json({ error: 'Etiqueta no encontrada' }, { status: 404 });
  }
  if (label.status === 'CANCELLED') {
    return NextResponse.json({ error: 'Esta etiqueta está anulada y no se puede editar' }, { status: 409 });
  }

  const v = parsed.data;
  const update: TablesUpdate<'product_labels'> = {
    updated_by: session.workerName,
    updated_at: new Date().toISOString(),
  };
  if (v.weightGrams !== undefined) update.weight_grams = v.weightGrams;
  if (v.lote !== undefined) update.lote = v.lote;
  if (v.elaborationDate !== undefined) update.elaboration_date = v.elaborationDate;
  if (v.packagingDate !== undefined) update.packaging_date = v.packagingDate;
  if (v.expiryDate !== undefined) update.expiry_date = v.expiryDate;
  if (v.bestBeforeDate !== undefined) update.best_before_date = v.bestBeforeDate;
  if (v.unitsInPackage !== undefined) update.units_in_package = v.unitsInPackage;
  if (v.beefTraceabilityInfo !== undefined) update.beef_traceability_info = v.beefTraceabilityInfo;
  if (v.countryOfOrigin !== undefined) update.country_of_origin = v.countryOfOrigin;

  if (label.status === 'PRINTED' || label.status === 'REPRINTED') {
    update.status = 'READY';
  }

  const { error } = await supabaseAdmin.from('product_labels').update(update).eq('id', id);
  if (error) {
    return NextResponse.json({ error: 'No se pudo guardar la etiqueta' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
