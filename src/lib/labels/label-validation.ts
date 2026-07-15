import { LABEL_FIELD_LABELS, LABEL_FIELD_SOURCE, type LabelFieldKey, type LabelFieldSource } from './label-fields';
import type { LabelProfileRules, ResolvedLabelValues } from './label-snapshot';

export interface LabelValidationIssue {
  field: LabelFieldKey;
  source: LabelFieldSource;
  message: string;
  blocksPrinting: boolean;
}

function isFieldEmpty(field: LabelFieldKey, values: ResolvedLabelValues): boolean {
  switch (field) {
    case 'product_name':
      return !values.product_name?.trim();
    case 'variant_name':
      return !values.variant_name?.trim();
    case 'net_weight':
      return values.net_weight_grams == null || values.net_weight_grams <= 0;
    case 'units_in_package':
      return values.units_in_package == null || values.units_in_package < 1;
    case 'ingredients':
      return !values.ingredients?.trim();
    case 'allergens':
      // null = alérgenos nunca configurados (dato ausente). [] = "sin
      // alérgenos declarados", una respuesta válida, no un dato que falte.
      return values.allergens === null;
    case 'lot':
      return !values.lot?.trim();
    case 'packaging_date':
      return !values.packaging_date;
    case 'production_date':
      return !values.production_date;
    case 'expiry_date':
      return !values.expiry_date;
    case 'best_before_date':
      return !values.best_before_date;
    case 'storage_conditions':
      return !values.storage_conditions?.trim();
    case 'usage_instructions':
      return !values.usage_instructions?.trim();
    case 'origin':
      return !values.origin?.trim();
    case 'beef_traceability':
      return !values.beef_traceability?.trim();
    case 'operator_data':
      return !values.operator_data?.legalName || !values.operator_data?.taxId || !values.operator_data?.address;
    case 'identification_mark':
      return !values.identification_mark?.trim();
    default:
      return false;
  }
}

function messageFor(field: LabelFieldKey, source: LabelFieldSource): string {
  const label = LABEL_FIELD_LABELS[field];
  if (source === 'product_config') {
    return `Falta "${label}" en la configuración del producto — corrígelo en Configuración de etiquetas antes de imprimir.`;
  }
  if (source === 'operator_config') {
    return `Falta "${label}" en los datos del operador — configúralo en Configuración de etiquetas → Datos del operador.`;
  }
  return `Falta completar "${label}" en esta etiqueta.`;
}

// Devuelve solo las incidencias de los campos configurados como obligatorios
// u obligatorios-bloqueantes en el perfil (§10 del diseño). `stages` limita
// la comprobación a qué origen de dato tiene sentido revisar en cada
// pantalla: antes de generar una etiqueta solo hay snapshot de producto
// ('product_config'); antes de imprimir se revisan los tres orígenes.
export function getLabelValidationIssues(
  values: ResolvedLabelValues,
  profile: LabelProfileRules,
  stages: LabelFieldSource[] = ['product_config', 'preparation', 'operator_config']
): LabelValidationIssue[] {
  const issues: LabelValidationIssue[] = [];
  const fieldsToCheck = new Set<LabelFieldKey>([...profile.requiredFields, ...profile.blockingFields]);

  for (const field of fieldsToCheck) {
    const source = LABEL_FIELD_SOURCE[field];
    if (!stages.includes(source)) continue;
    if (!isFieldEmpty(field, values)) continue;

    issues.push({
      field,
      source,
      message: messageFor(field, source),
      blocksPrinting: profile.blockingFields.includes(field),
    });
  }

  return issues;
}
