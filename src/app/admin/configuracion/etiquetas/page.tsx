import { redirect } from 'next/navigation';
import { isAdminAuthenticated } from '@/lib/admin-session';
import { supabaseAdmin } from '@/lib/supabase-admin';
import AdminHeader from '@/components/Admin/AdminHeader';
import OperatorConfigForm from '@/components/Admin/Labels/OperatorConfigForm';
import LabelProfileForm from '@/components/Admin/Labels/LabelProfileForm';
import ProductLabelConfigForm from '@/components/Admin/Labels/ProductLabelConfigForm';
import { toLabelProfileFormInput, type LabelProfileFormInput } from '@/lib/labels/label-profile-form';
import type { Tables } from '@/supabase/types';

export const dynamic = 'force-dynamic';

const EMPTY_PROFILE_FORM: LabelProfileFormInput = {
  key: '',
  name: '',
  isActive: true,
  dateType: 'EXPIRY',
  suggestedShelfLifeDays: null,
  defaultStorageText: null,
  fixedNote: null,
  requiresWeight: true,
  requiresLot: true,
  requiresBeefTraceability: false,
  requiresHealthMark: false,
  matrix: {},
};

type ProductRow = Pick<
  Tables<'products'>,
  | 'id'
  | 'name'
  | 'label_profile_id'
  | 'label_display_name'
  | 'country_of_origin'
  | 'usual_units_per_package'
  | 'suggested_package_count'
  | 'ingredients'
  | 'allergens'
  | 'allergens_notes'
  | 'storage_conditions'
  | 'prep_instructions'
  | 'cooking_method'
>;

export default async function LabelSettingsPage() {
  if (!(await isAdminAuthenticated())) {
    redirect('/admin/login');
  }

  const [{ data: shopSettings }, { data: profileRows }, { data: productRows }] = await Promise.all([
    supabaseAdmin
      .from('shop_settings')
      .select(
        'operator_legal_name, operator_tax_id, operator_address, operator_country, operator_health_registry_code, operator_identification_mark'
      )
      .maybeSingle(),
    supabaseAdmin.from('label_profiles').select('*').order('name').returns<Tables<'label_profiles'>[]>(),
    supabaseAdmin
      .from('products')
      .select(
        'id, name, label_profile_id, label_display_name, country_of_origin, usual_units_per_package, suggested_package_count, ingredients, allergens, allergens_notes, storage_conditions, prep_instructions, cooking_method'
      )
      .order('name')
      .returns<ProductRow[]>(),
  ]);

  const profiles = profileRows ?? [];
  const products = productRows ?? [];
  const profileOptions = profiles.map((profile) => ({ id: profile.id, name: profile.name }));

  return (
    <div>
      <AdminHeader title="Configuración de etiquetas" />

      <div className="mx-auto max-w-5xl space-y-8 px-4 py-6 sm:px-6">
        <section className="rounded-lg border border-gray-300 bg-white p-4">
          <h2 className="mb-1 text-lg font-bold text-gray-900">Datos del operador alimentario</h2>
          <p className="mb-4 text-sm text-gray-500">
            Se muestran en la etiqueta solo cuando el perfil del producto lo requiera.
          </p>
          <OperatorConfigForm
            initial={{
              legalName: shopSettings?.operator_legal_name ?? '',
              taxId: shopSettings?.operator_tax_id ?? '',
              address: shopSettings?.operator_address ?? '',
              country: shopSettings?.operator_country ?? 'ES',
              healthRegistryCode: shopSettings?.operator_health_registry_code ?? '',
              identificationMark: shopSettings?.operator_identification_mark ?? '',
            }}
          />
        </section>

        <section className="rounded-lg border border-gray-300 bg-white p-4">
          <h2 className="mb-1 text-lg font-bold text-gray-900">Perfiles de etiquetado</h2>
          <p className="mb-4 text-sm text-gray-500">
            Determinan qué campos aparecen, cuáles son obligatorios y cuáles bloquean la impresión para cada tipo de
            producto. Los campos legalmente obligatorios definitivos deben validarse con el responsable de seguridad
            alimentaria/APPCC antes de producción.
          </p>

          <details className="mb-3 rounded-md border border-dashed border-gray-300 p-3">
            <summary className="cursor-pointer text-sm font-semibold text-gray-700">+ Nuevo perfil</summary>
            <div className="mt-3">
              <LabelProfileForm mode="create" initial={EMPTY_PROFILE_FORM} />
            </div>
          </details>

          <div className="space-y-2">
            {profiles.map((profile) => (
              <details key={profile.id} className="rounded-md border border-gray-200 p-3">
                <summary className="cursor-pointer text-sm font-semibold text-gray-800">
                  {profile.name}{' '}
                  <span className="font-normal text-gray-400">({profile.key})</span>
                  {!profile.is_active && (
                    <span className="ml-2 rounded bg-gray-200 px-2 py-0.5 text-xs text-gray-600">Inactivo</span>
                  )}
                </summary>
                <div className="mt-3">
                  <LabelProfileForm mode="edit" profileId={profile.id} initial={toLabelProfileFormInput(profile)} />
                </div>
              </details>
            ))}
            {profiles.length === 0 && <p className="text-sm text-gray-500">No hay perfiles todavía.</p>}
          </div>
        </section>

        <section className="rounded-lg border border-gray-300 bg-white p-4">
          <h2 className="mb-1 text-lg font-bold text-gray-900">Configuración por producto</h2>
          <p className="mb-4 text-sm text-gray-500">
            Perfil asignado y datos legales de cada producto. Precio, stock, imágenes y categorías se siguen
            gestionando donde ya se gestionaban.
          </p>

          <div className="space-y-2">
            {products.map((product) => (
              <details key={product.id} className="rounded-md border border-gray-200 p-3">
                <summary className="cursor-pointer text-sm font-semibold text-gray-800">
                  {product.name}
                  {!product.label_profile_id && (
                    <span className="ml-2 rounded bg-orange-100 px-2 py-0.5 text-xs font-medium text-orange-800">
                      Sin perfil asignado
                    </span>
                  )}
                </summary>
                <div className="mt-3">
                  <ProductLabelConfigForm
                    productId={product.id}
                    profiles={profileOptions}
                    initial={{
                      labelProfileId: product.label_profile_id,
                      labelDisplayName: product.label_display_name,
                      countryOfOrigin: product.country_of_origin,
                      usualUnitsPerPackage: product.usual_units_per_package,
                      suggestedPackageCount: product.suggested_package_count,
                      ingredients: product.ingredients,
                      allergens: product.allergens ?? [],
                      allergensNotes: product.allergens_notes,
                      storageConditions: product.storage_conditions,
                      prepInstructions: product.prep_instructions,
                      cookingMethod: product.cooking_method,
                    }}
                  />
                </div>
              </details>
            ))}
            {products.length === 0 && <p className="text-sm text-gray-500">No hay productos todavía.</p>}
          </div>
        </section>
      </div>
    </div>
  );
}
