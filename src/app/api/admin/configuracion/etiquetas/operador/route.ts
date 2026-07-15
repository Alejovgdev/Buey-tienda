import { NextResponse } from 'next/server';
import { isAdminAuthenticated } from '@/lib/admin-session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { operatorConfigSchema } from '@/lib/labels/product-label-config-schema';

// Datos del operador alimentario (shop_settings, singleton). Solo se usan
// para completar la etiqueta cuando el perfil del producto lo requiera
// (requires_health_mark) — ver docs/FOOD_LABEL_ADMIN_DESIGN.md, §17.
export async function PATCH(request: Request) {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = operatorConfigSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Datos no válidos', fieldErrors: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const { legalName, taxId, address, country, healthRegistryCode, identificationMark } = parsed.data;

  const { error } = await supabaseAdmin
    .from('shop_settings')
    .update({
      operator_legal_name: legalName,
      operator_tax_id: taxId,
      operator_address: address,
      operator_country: country,
      operator_health_registry_code: healthRegistryCode,
      operator_identification_mark: identificationMark,
      updated_at: new Date().toISOString(),
    })
    .eq('singleton', true);

  if (error) {
    return NextResponse.json({ error: 'No se pudieron guardar los datos del operador' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
