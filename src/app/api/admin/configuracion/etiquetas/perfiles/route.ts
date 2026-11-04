import { NextResponse } from 'next/server';
import { FOOD_LABELING_ENABLED } from '@/lib/admin/features';
import { isAdminAuthenticated } from '@/lib/admin-session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { labelProfileFormSchema, buildLabelProfileArrays } from '@/lib/labels/label-profile-form';

// Crea un nuevo perfil de etiquetado desde /admin/configuracion/etiquetas —
// permite dar de alta un tipo de producto nuevo sin tocar código ni Supabase
// Studio (docs/FOOD_LABEL_ADMIN_DESIGN.md, §9).
export async function POST(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  if (!FOOD_LABELING_ENABLED) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const parsedForm = labelProfileFormSchema.safeParse(body);
  if (!parsedForm.success) {
    return NextResponse.json(
      { error: 'Datos no válidos', fieldErrors: parsedForm.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  let profileRow;
  try {
    profileRow = buildLabelProfileArrays(parsedForm.data);
  } catch {
    return NextResponse.json({ error: 'Configuración de campos no válida' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('label_profiles')
    .insert({
      key: profileRow.key,
      name: profileRow.name,
      is_active: profileRow.isActive,
      visible_fields: profileRow.visibleFields,
      required_fields: profileRow.requiredFields,
      blocking_fields: profileRow.blockingFields,
      preparation_fields: profileRow.preparationFields,
      field_order: profileRow.fieldOrder,
      date_type: profileRow.dateType,
      suggested_shelf_life_days: profileRow.suggestedShelfLifeDays,
      default_storage_text: profileRow.defaultStorageText,
      fixed_texts: profileRow.fixedTexts,
      requires_weight: profileRow.requiresWeight,
      requires_lot: profileRow.requiresLot,
      requires_beef_traceability: profileRow.requiresBeefTraceability,
      requires_health_mark: profileRow.requiresHealthMark,
    })
    .select('id')
    .single();

  if (error || !data) {
    const isDuplicateKey = error?.code === '23505';
    return NextResponse.json(
      { error: isDuplicateKey ? 'Ya existe un perfil con esa clave' : 'No se pudo crear el perfil' },
      { status: isDuplicateKey ? 409 : 500 }
    );
  }

  return NextResponse.json({ ok: true, id: data.id });
}
