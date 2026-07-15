// Catálogo controlado de campos reconocidos por el código para el sistema de
// etiquetado alimentario (docs/FOOD_LABEL_ADMIN_DESIGN.md). Los arrays
// visible_fields/required_fields/blocking_fields/preparation_fields/field_order
// de label_profiles se validan contra este catálogo — ampliarlo es un cambio
// de código explícito, no una configuración libre desde el panel.
export const LABEL_FIELD_KEYS = [
  'product_name',
  'variant_name',
  'net_weight',
  'units_in_package',
  'ingredients',
  'allergens',
  'lot',
  'packaging_date',
  'production_date',
  'expiry_date',
  'best_before_date',
  'storage_conditions',
  'usage_instructions',
  'origin',
  'beef_traceability',
  'operator_data',
  'identification_mark',
] as const;

export type LabelFieldKey = (typeof LABEL_FIELD_KEYS)[number];

export function isLabelFieldKey(value: string): value is LabelFieldKey {
  return (LABEL_FIELD_KEYS as readonly string[]).includes(value);
}

export const LABEL_FIELD_LABELS: Record<LabelFieldKey, string> = {
  product_name: 'Denominación del alimento',
  variant_name: 'Formato/variante',
  net_weight: 'Peso neto real',
  units_in_package: 'Unidades dentro del envase',
  ingredients: 'Ingredientes',
  allergens: 'Alérgenos',
  lot: 'Lote',
  packaging_date: 'Fecha de envasado',
  production_date: 'Fecha de elaboración',
  expiry_date: 'Fecha de caducidad',
  best_before_date: 'Consumo preferente',
  storage_conditions: 'Condiciones de conservación',
  usage_instructions: 'Instrucciones de uso/preparación',
  origin: 'País/lugar de origen',
  beef_traceability: 'Trazabilidad de vacuno',
  operator_data: 'Datos del operador',
  identification_mark: 'Marca de identificación / registro sanitario',
};

// De dónde sale el valor de cada campo — determina qué pantalla debe
// corregirlo si falta (ver src/lib/labels/label-validation.ts):
// - product_config: se congela en order_items al crear el pedido; se corrige
//   en /admin/configuracion/etiquetas → Configuración por producto.
// - preparation: lo introduce el trabajador al preparar el pedido (product_labels).
// - operator_config: dato global de shop_settings, se corrige en
//   /admin/configuracion/etiquetas → Datos del operador.
export type LabelFieldSource = 'product_config' | 'preparation' | 'operator_config';

export const LABEL_FIELD_SOURCE: Record<LabelFieldKey, LabelFieldSource> = {
  product_name: 'product_config',
  variant_name: 'product_config',
  net_weight: 'preparation',
  units_in_package: 'preparation',
  ingredients: 'product_config',
  allergens: 'product_config',
  lot: 'preparation',
  packaging_date: 'preparation',
  production_date: 'preparation',
  expiry_date: 'preparation',
  best_before_date: 'preparation',
  storage_conditions: 'product_config',
  usage_instructions: 'product_config',
  origin: 'product_config',
  beef_traceability: 'preparation',
  operator_data: 'operator_config',
  identification_mark: 'operator_config',
};
