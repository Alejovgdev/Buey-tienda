import { NextResponse } from 'next/server';
import { FOOD_LABELING_ENABLED } from '@/lib/admin/features';
import { isAdminAuthenticated } from '@/lib/admin-session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { labelProfileFormSchema, buildLabelProfileArrays } from '@/lib/labels/label-profile-form';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Actualiza un perfil de etiquetado existente. Un perfil ya asignado a
// productos con pedidos hechos no se ve afectado retroactivamente: esos
// pedidos ya congelaron su propia copia en order_items.label_profile_snapshot
// (docs/FOOD_LABEL_ADMIN_DESIGN.md, §7) — este endpoint solo cambia el perfil
// "en vivo" para pedidos futuros.
export async function PATCH(request: Request, { params }: RouteParams) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  if (!FOOD_LABELING_ENABLED) {
    return NextResponse.json({ error: 'No encontrado' }, { status: 404 });
  }

  const { id } = await params;
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

  const { error } = await supabaseAdmin
    .from('label_profiles')
    .update({
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
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    const isDuplicateKey = error.code === '23505';
    return NextResponse.json(
      { error: isDuplicateKey ? 'Ya existe un perfil con esa clave' : 'No se pudo actualizar el perfil' },
      { status: isDuplicateKey ? 409 : 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
