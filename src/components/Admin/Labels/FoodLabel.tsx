import { LABEL_WIDTH_MM, LABEL_HEIGHT_MM } from '@/lib/labels/constants';
import type { LabelFieldKey } from '@/lib/labels/label-fields';
import { formatLabelDate } from '@/lib/labels/label-date';
import { formatAllergenLabel } from '@/lib/format-allergen';
import type { LabelProfileRules, ResolvedLabelValues } from '@/lib/labels/label-snapshot';

export interface FoodLabelProps {
  profile: LabelProfileRules;
  values: ResolvedLabelValues;
  packageSequence?: number;
  packageCountForLine?: number;
}

// Plantilla React ÚNICA para todo tipo de producto (docs/FOOD_LABEL_ADMIN_DESIGN.md,
// encargo de implementación) — nunca un componente por tipo de alimento. Lo
// que cambia entre un chuletón, una hamburguesa o unas croquetas es el
// `profile` (qué bloques se muestran, en qué orden), no el componente.
function renderField(field: LabelFieldKey, values: ResolvedLabelValues) {
  switch (field) {
    case 'product_name':
      return values.product_name ? <p className="text-[11pt] font-bold leading-tight">{values.product_name}</p> : null;
    case 'variant_name':
      return values.variant_name ? <p className="text-[8pt] text-gray-700">{values.variant_name}</p> : null;
    case 'net_weight':
      return values.net_weight_grams != null ? (
        <p>
          <strong>Peso neto:</strong> {values.net_weight_grams} g
        </p>
      ) : null;
    case 'units_in_package':
      return values.units_in_package != null ? (
        <p>
          <strong>Unidades:</strong> {values.units_in_package}
        </p>
      ) : null;
    case 'ingredients':
      return values.ingredients ? (
        <p>
          <strong>Ingredientes:</strong> {values.ingredients}
        </p>
      ) : null;
    case 'allergens':
      return values.allergens ? (
        <p>
          <strong>Alérgenos:</strong>{' '}
          {values.allergens.length > 0 ? values.allergens.map(formatAllergenLabel).join(', ') : 'Ninguno declarado'}
          {values.allergens_notes ? ` — ${values.allergens_notes}` : ''}
        </p>
      ) : null;
    case 'lot':
      return values.lot ? (
        <p>
          <strong>Lote:</strong> {values.lot}
        </p>
      ) : null;
    case 'packaging_date':
      return values.packaging_date ? (
        <p>
          <strong>Envasado:</strong> {formatLabelDate(values.packaging_date)}
        </p>
      ) : null;
    case 'production_date':
      return values.production_date ? (
        <p>
          <strong>Elaborado:</strong> {formatLabelDate(values.production_date)}
        </p>
      ) : null;
    case 'expiry_date':
      return values.expiry_date ? (
        <p>
          <strong>Caducidad:</strong> {formatLabelDate(values.expiry_date)}
        </p>
      ) : null;
    case 'best_before_date':
      return values.best_before_date ? (
        <p>
          <strong>Consumo preferente:</strong> {formatLabelDate(values.best_before_date)}
        </p>
      ) : null;
    case 'storage_conditions':
      return values.storage_conditions ? (
        <p>
          <strong>Conservación:</strong> {values.storage_conditions}
        </p>
      ) : null;
    case 'usage_instructions':
      return values.usage_instructions ? (
        <p>
          <strong>Modo de uso:</strong> {values.usage_instructions}
        </p>
      ) : null;
    case 'origin':
      return values.origin ? (
        <p>
          <strong>Origen:</strong> {values.origin}
        </p>
      ) : null;
    case 'beef_traceability':
      return values.beef_traceability ? (
        <p>
          <strong>Trazabilidad:</strong> {values.beef_traceability}
        </p>
      ) : null;
    case 'operator_data':
      return values.operator_data?.legalName ? (
        <p className="text-[7pt] text-gray-600">
          {values.operator_data.legalName}
          {values.operator_data.taxId ? ` — NIF ${values.operator_data.taxId}` : ''}
          {values.operator_data.address ? ` — ${values.operator_data.address}` : ''}
        </p>
      ) : null;
    case 'identification_mark':
      return values.identification_mark ? <p className="text-[7pt] text-gray-600">{values.identification_mark}</p> : null;
    default:
      return null;
  }
}

export default function FoodLabel({ profile, values, packageSequence, packageCountForLine }: FoodLabelProps) {
  const fixedNote = profile.fixedTexts?.note;
  const fieldsToRender = profile.fieldOrder.filter((field) => profile.visibleFields.includes(field));

  return (
    <div
      className="label-page flex flex-col gap-[0.5mm] bg-white text-black"
      style={{
        width: `${LABEL_WIDTH_MM}mm`,
        height: `${LABEL_HEIGHT_MM}mm`,
        padding: '2.5mm',
        fontSize: '8pt',
        lineHeight: 1.1,
        overflow: 'hidden',
      }}
    >
      {packageSequence != null && packageCountForLine != null && packageCountForLine > 1 && (
        <p className="text-[7pt] text-gray-400">
          Envase {packageSequence} de {packageCountForLine}
        </p>
      )}
      {fieldsToRender.map((field) => (
        <div key={field}>{renderField(field, values)}</div>
      ))}
      {fixedNote && <p className="text-[7pt] font-semibold">{fixedNote}</p>}
    </div>
  );
}
