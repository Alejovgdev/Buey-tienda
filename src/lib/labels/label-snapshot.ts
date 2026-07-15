import type { Tables } from '@/supabase/types';
import { isLabelFieldKey, type LabelFieldKey } from './label-fields';
import type { DateType } from './constants';

// Copia en memoria de las reglas de un label_profiles — misma forma que se
// congela en order_items.label_profile_snapshot (0014) para que un pedido ya
// hecho no cambie de validación si el perfil se edita después (§7 del diseño).
export interface LabelProfileRules {
  id: string;
  key: string;
  name: string;
  visibleFields: LabelFieldKey[];
  requiredFields: LabelFieldKey[];
  blockingFields: LabelFieldKey[];
  preparationFields: LabelFieldKey[];
  fieldOrder: LabelFieldKey[];
  dateType: DateType;
  suggestedShelfLifeDays: number | null;
  defaultStorageText: string | null;
  fixedTexts: Record<string, string> | null;
  requiresWeight: boolean;
  requiresLot: boolean;
  requiresBeefTraceability: boolean;
  requiresHealthMark: boolean;
}

function toFieldKeyArray(values: string[] | null | undefined): LabelFieldKey[] {
  return (values ?? []).filter(isLabelFieldKey);
}

export function toLabelProfileRules(row: Tables<'label_profiles'>): LabelProfileRules {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    visibleFields: toFieldKeyArray(row.visible_fields),
    requiredFields: toFieldKeyArray(row.required_fields),
    blockingFields: toFieldKeyArray(row.blocking_fields),
    preparationFields: toFieldKeyArray(row.preparation_fields),
    fieldOrder: toFieldKeyArray(row.field_order),
    dateType: row.date_type === 'BEST_BEFORE' ? 'BEST_BEFORE' : 'EXPIRY',
    suggestedShelfLifeDays: row.suggested_shelf_life_days,
    defaultStorageText: row.default_storage_text,
    fixedTexts: (row.fixed_texts as Record<string, string> | null) ?? null,
    requiresWeight: row.requires_weight,
    requiresLot: row.requires_lot,
    requiresBeefTraceability: row.requires_beef_traceability,
    requiresHealthMark: row.requires_health_mark,
  };
}

// Reconstruye LabelProfileRules a partir del JSONB congelado en
// order_items.label_profile_snapshot — validado de forma defensiva porque es
// un valor que viene de la base de datos, no del código. Devuelve null si no
// tiene forma reconocible (p. ej. pedidos anteriores a esta migración).
export function parseFrozenLabelProfileRules(value: unknown): LabelProfileRules | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== 'string' || typeof v.key !== 'string' || typeof v.name !== 'string') return null;

  const toArr = (input: unknown): LabelFieldKey[] =>
    Array.isArray(input) ? input.filter((item): item is LabelFieldKey => typeof item === 'string' && isLabelFieldKey(item)) : [];

  return {
    id: v.id,
    key: v.key,
    name: v.name,
    visibleFields: toArr(v.visibleFields),
    requiredFields: toArr(v.requiredFields),
    blockingFields: toArr(v.blockingFields),
    preparationFields: toArr(v.preparationFields),
    fieldOrder: toArr(v.fieldOrder),
    dateType: v.dateType === 'BEST_BEFORE' ? 'BEST_BEFORE' : 'EXPIRY',
    suggestedShelfLifeDays: typeof v.suggestedShelfLifeDays === 'number' ? v.suggestedShelfLifeDays : null,
    defaultStorageText: typeof v.defaultStorageText === 'string' ? v.defaultStorageText : null,
    fixedTexts: (v.fixedTexts as Record<string, string> | null | undefined) ?? null,
    requiresWeight: Boolean(v.requiresWeight),
    requiresLot: Boolean(v.requiresLot),
    requiresBeefTraceability: Boolean(v.requiresBeefTraceability),
    requiresHealthMark: Boolean(v.requiresHealthMark),
  };
}

// Punto único usado tanto en la pantalla de preparación como en impresión:
// prioriza siempre la copia congelada en el pedido sobre el perfil en vivo,
// para que una edición posterior del perfil no altere pedidos ya hechos
// (§7 del diseño). Solo cae al perfil en vivo si no hay snapshot (pedidos
// anteriores a esta función, o etiquetas manuales sin order_item).
export function resolveProfileRulesForOrderItem(
  orderItem: Pick<Tables<'order_items'>, 'label_profile_snapshot'> | null | undefined,
  liveProfile: Tables<'label_profiles'> | null | undefined
): LabelProfileRules | null {
  const frozen = orderItem ? parseFrozenLabelProfileRules(orderItem.label_profile_snapshot) : null;
  if (frozen) return frozen;
  return liveProfile ? toLabelProfileRules(liveProfile) : null;
}

export interface OperatorData {
  legalName: string | null;
  taxId: string | null;
  address: string | null;
  country: string;
  healthRegistryCode: string | null;
  identificationMark: string | null;
}

type ShopSettingsOperatorFields = Pick<
  Tables<'shop_settings'>,
  | 'operator_legal_name'
  | 'operator_tax_id'
  | 'operator_address'
  | 'operator_country'
  | 'operator_health_registry_code'
  | 'operator_identification_mark'
>;

export function toOperatorData(row: ShopSettingsOperatorFields | null): OperatorData {
  return {
    legalName: row?.operator_legal_name ?? null,
    taxId: row?.operator_tax_id ?? null,
    address: row?.operator_address ?? null,
    country: row?.operator_country ?? 'ES',
    healthRegistryCode: row?.operator_health_registry_code ?? null,
    identificationMark: row?.operator_identification_mark ?? null,
  };
}

// Todos los campos del catálogo, ya resueltos a su valor final para
// renderizar (FoodLabel) o congelar (label_print_events.label_snapshot).
export interface ResolvedLabelValues {
  product_name: string | null;
  variant_name: string | null;
  net_weight_grams: number | null;
  units_in_package: number | null;
  ingredients: string | null;
  allergens: string[] | null;
  allergens_notes: string | null;
  lot: string | null;
  packaging_date: string | null;
  production_date: string | null;
  expiry_date: string | null;
  best_before_date: string | null;
  storage_conditions: string | null;
  usage_instructions: string | null;
  origin: string | null;
  beef_traceability: string | null;
  operator_data: OperatorData | null;
  identification_mark: string | null;
}

function combineUsageInstructions(prep: string | null, cooking: string | null): string | null {
  const parts = [prep, cooking].map((value) => value?.trim()).filter((value): value is string => Boolean(value));
  return parts.length > 0 ? parts.join(' — ') : null;
}

function resolveIdentificationMark(operator: OperatorData): string | null {
  const parts = [
    operator.healthRegistryCode ? `RGSEAA: ${operator.healthRegistryCode}` : null,
    operator.identificationMark,
  ].filter((value): value is string => Boolean(value));
  return parts.length > 0 ? parts.join(' — ') : null;
}

// Etiqueta ya generada: el trigger suggest_product_label_fields() (0015) ya
// copió el snapshot de la línea de pedido a esta fila de product_labels, así
// que todo se lee de aquí — sin volver a tocar order_items ni products.
export function resolveLabelValuesFromProductLabel(
  label: Tables<'product_labels'>,
  operator: OperatorData
): ResolvedLabelValues {
  return {
    product_name: label.product_name || null,
    variant_name: label.variant_name,
    net_weight_grams: label.weight_grams,
    units_in_package: label.units_in_package,
    ingredients: label.ingredients,
    allergens: label.allergens,
    allergens_notes: label.allergens_notes,
    lot: label.lote || null,
    packaging_date: label.packaging_date,
    production_date: label.elaboration_date,
    expiry_date: label.expiry_date,
    best_before_date: label.best_before_date,
    storage_conditions: label.storage_conditions,
    usage_instructions: combineUsageInstructions(label.prep_instructions, label.cooking_method),
    origin: label.country_of_origin,
    beef_traceability: label.beef_traceability_info,
    operator_data: operator,
    identification_mark: resolveIdentificationMark(operator),
  };
}

// Antes de generar la etiqueta (pantalla "Preparar y etiquetar"): solo hay
// snapshot de la línea de pedido, los campos de preparación son null a
// propósito — es el estado esperado antes de generar.
export function resolveLabelValuesFromOrderItem(
  item: Tables<'order_items'>,
  operator: OperatorData
): ResolvedLabelValues {
  return {
    product_name: item.label_display_name_snapshot || item.product_name_snapshot || null,
    variant_name: item.variant_name_snapshot,
    net_weight_grams: null,
    units_in_package: null,
    ingredients: item.ingredients_snapshot,
    allergens: item.allergens_snapshot,
    allergens_notes: item.allergens_notes_snapshot,
    lot: null,
    packaging_date: null,
    production_date: null,
    expiry_date: null,
    best_before_date: null,
    storage_conditions: item.storage_conditions_snapshot,
    usage_instructions: combineUsageInstructions(item.prep_instructions_snapshot, item.cooking_method_snapshot),
    origin: item.country_of_origin_snapshot,
    beef_traceability: null,
    operator_data: operator,
    identification_mark: resolveIdentificationMark(operator),
  };
}

export interface LabelPrintSnapshot {
  generatedAt: string;
  label: {
    id: string;
    orderItemId: string | null;
    productId: string;
    packageSequence: number;
    packageCountForLine: number;
    status: string;
  };
  profile: LabelProfileRules;
  values: ResolvedLabelValues;
}

// Contenido exacto a congelar en label_print_events.label_snapshot en cada
// impresión/reimpresión (§11 del diseño) — incluye la copia de las reglas del
// perfil usadas en ese instante, no solo el id, para que una edición
// posterior del perfil no reescriba silenciosamente el histórico.
export function buildLabelPrintSnapshot(
  label: Tables<'product_labels'>,
  profile: LabelProfileRules,
  operator: OperatorData
): LabelPrintSnapshot {
  return {
    generatedAt: new Date().toISOString(),
    label: {
      id: label.id,
      orderItemId: label.order_item_id,
      productId: label.product_id,
      packageSequence: label.package_sequence,
      packageCountForLine: label.package_count_for_line,
      status: label.status,
    },
    profile,
    values: resolveLabelValuesFromProductLabel(label, operator),
  };
}
