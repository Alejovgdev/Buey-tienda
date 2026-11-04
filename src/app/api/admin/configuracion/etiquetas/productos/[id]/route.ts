import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { productLabelConfigSchema, sharedProductConfigSchema } from '@/lib/labels/product-label-config-schema';
import { FOOD_LABELING_ENABLED } from '@/lib/admin/features';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// Configuración de etiquetado de UN producto (perfil asignado, denominación
// de etiqueta, ingredientes/alérgenos/conservación/instrucciones ya
// existentes, envasado habitual). No es un CRUD de catálogo: precio, stock,
// imágenes y categorías siguen fuera de este endpoint y de esta pantalla
// (docs/FOOD_LABEL_ADMIN_DESIGN.md, §5 y encargo de implementación).
export async function PATCH(request: Request, { params }: RouteParams) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const labelConfig = FOOD_LABELING_ENABLED ? productLabelConfigSchema.safeParse(body) : null;
  const parsed = labelConfig ?? sharedProductConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos no válidos', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { data: product } = await supabaseAdmin.from('products').select('id').eq('id', id).maybeSingle<{ id: string }>();
  if (!product) {
    return NextResponse.json({ error: 'Producto no encontrado' }, { status: 404 });
  }

  const v = parsed.data;
  // No enviar columnas internas cuando el módulo está desactivado: se
  // conservan sus valores en la base, aunque el cliente intente cambiarlos.
  const labelUpdate = labelConfig?.success ? {
    label_profile_id: labelConfig.data.labelProfileId,
    label_display_name: labelConfig.data.labelDisplayName,
    usual_units_per_package: labelConfig.data.usualUnitsPerPackage,
    suggested_package_count: labelConfig.data.suggestedPackageCount,
  } : {};
  const { error } = await supabaseAdmin
    .from('products')
    .update({
      ...labelUpdate,
      country_of_origin: v.countryOfOrigin,
      ingredients: v.ingredients,
      allergens: v.allergens,
      allergens_notes: v.allergensNotes,
      storage_conditions: v.storageConditions,
      prep_instructions: v.prepInstructions,
      cooking_method: v.cookingMethod,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    return NextResponse.json({ error: 'No se pudo guardar la configuración del producto' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
