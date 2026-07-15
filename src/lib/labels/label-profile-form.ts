import { z } from 'zod';
import type { Tables } from '@/supabase/types';
import { LABEL_FIELD_KEYS, LABEL_FIELD_SOURCE, type LabelFieldKey } from './label-fields';
import { DATE_TYPES } from './constants';
import { labelProfileInputSchema, type LabelProfileInput } from './label-profile-schema';
import { toLabelProfileRules } from './label-snapshot';

// Claves del catálogo que se gestionan con un checkbox propio en la matriz
// del formulario de perfil (/admin/configuracion/etiquetas). net_weight, lot,
// beef_traceability e identification_mark quedan FUERA de la matriz: los
// gobiernan directamente los interruptores requiresWeight/requiresLot/
// requiresBeefTraceability/requiresHealthMark, para no pedir el mismo dato
// dos veces en el formulario.
const SPECIAL_FIELD_BY_REQUIRES_FLAG = {
  requiresWeight: 'net_weight',
  requiresLot: 'lot',
  requiresBeefTraceability: 'beef_traceability',
  requiresHealthMark: 'identification_mark',
} as const satisfies Record<string, LabelFieldKey>;

type RequiresFlag = keyof typeof SPECIAL_FIELD_BY_REQUIRES_FLAG;

const SPECIAL_FIELDS = new Set<LabelFieldKey>(Object.values(SPECIAL_FIELD_BY_REQUIRES_FLAG));

export const MATRIX_FIELD_KEYS = LABEL_FIELD_KEYS.filter((key) => !SPECIAL_FIELDS.has(key));

const matrixCellSchema = z.object({
  visible: z.boolean(),
  required: z.boolean(),
  blocking: z.boolean(),
});

export const labelProfileFormSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1, 'La clave es obligatoria')
    .max(60)
    .regex(/^[a-z0-9_]+$/, 'Solo minúsculas, números y guion bajo'),
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(120),
  isActive: z.boolean(),
  dateType: z.enum(DATE_TYPES),
  suggestedShelfLifeDays: z.number().int().positive().nullable(),
  defaultStorageText: z.string().trim().max(500).nullable(),
  fixedNote: z.string().trim().max(500).nullable(),
  requiresWeight: z.boolean(),
  requiresLot: z.boolean(),
  requiresBeefTraceability: z.boolean(),
  requiresHealthMark: z.boolean(),
  matrix: z.record(z.string(), matrixCellSchema),
});

export type LabelProfileFormInput = z.infer<typeof labelProfileFormSchema>;

// Expande el formulario compacto (una fila por campo del catálogo, casillas
// Visible/Obligatorio/Bloqueante) a los arrays completos que espera la BD.
// field_order y preparation_fields NO se piden en el formulario: se derivan
// automáticamente (orden del catálogo; origen "preparation" del campo) — ver
// el informe de implementación para la justificación de esta simplificación.
export function buildLabelProfileArrays(form: LabelProfileFormInput): LabelProfileInput {
  const visible = new Set<LabelFieldKey>();
  const required = new Set<LabelFieldKey>();
  const blocking = new Set<LabelFieldKey>();

  for (const key of MATRIX_FIELD_KEYS) {
    if (key === 'expiry_date' && form.dateType !== 'EXPIRY') continue;
    if (key === 'best_before_date' && form.dateType !== 'BEST_BEFORE') continue;

    const cell = form.matrix[key];
    if (!cell?.visible) continue;
    visible.add(key);
    if (cell.required) {
      required.add(key);
      if (cell.blocking) blocking.add(key);
    }
  }

  for (const flag of Object.keys(SPECIAL_FIELD_BY_REQUIRES_FLAG) as RequiresFlag[]) {
    if (!form[flag]) continue;
    const field = SPECIAL_FIELD_BY_REQUIRES_FLAG[flag];
    visible.add(field);
    required.add(field);
    blocking.add(field);
  }

  const visibleFields = LABEL_FIELD_KEYS.filter((key) => visible.has(key));
  const requiredFields = LABEL_FIELD_KEYS.filter((key) => required.has(key));
  const blockingFields = LABEL_FIELD_KEYS.filter((key) => blocking.has(key));
  const preparationFields = visibleFields.filter((key) => LABEL_FIELD_SOURCE[key] === 'preparation');

  return labelProfileInputSchema.parse({
    key: form.key,
    name: form.name,
    isActive: form.isActive,
    visibleFields,
    requiredFields,
    blockingFields,
    preparationFields,
    fieldOrder: visibleFields,
    dateType: form.dateType,
    suggestedShelfLifeDays: form.suggestedShelfLifeDays,
    defaultStorageText: form.defaultStorageText,
    fixedTexts: form.fixedNote ? { note: form.fixedNote } : null,
    requiresWeight: form.requiresWeight,
    requiresLot: form.requiresLot,
    requiresBeefTraceability: form.requiresBeefTraceability,
    requiresHealthMark: form.requiresHealthMark,
  });
}

// Dirección inversa: precarga el formulario compacto a partir de una fila de
// label_profiles ya guardada (pantalla de edición).
export function toLabelProfileFormInput(row: Tables<'label_profiles'>): LabelProfileFormInput {
  const rules = toLabelProfileRules(row);
  const visible = new Set(rules.visibleFields);
  const required = new Set(rules.requiredFields);
  const blocking = new Set(rules.blockingFields);

  const matrix: LabelProfileFormInput['matrix'] = {};
  for (const key of MATRIX_FIELD_KEYS) {
    matrix[key] = { visible: visible.has(key), required: required.has(key), blocking: blocking.has(key) };
  }

  return {
    key: rules.key,
    name: rules.name,
    isActive: row.is_active,
    dateType: rules.dateType,
    suggestedShelfLifeDays: rules.suggestedShelfLifeDays,
    defaultStorageText: rules.defaultStorageText,
    fixedNote: rules.fixedTexts?.note ?? null,
    requiresWeight: rules.requiresWeight,
    requiresLot: rules.requiresLot,
    requiresBeefTraceability: rules.requiresBeefTraceability,
    requiresHealthMark: rules.requiresHealthMark,
    matrix,
  };
}
