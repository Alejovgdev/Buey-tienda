import { z } from 'zod';
import { LABEL_FIELD_KEYS } from './label-fields';
import { DATE_TYPES } from './constants';

const fieldKeySchema = z.enum(LABEL_FIELD_KEYS);

// Valida la configuración de un label_profile antes de guardarla desde
// /admin/configuracion/etiquetas. El catálogo de campos válidos es
// LABEL_FIELD_KEYS (src/lib/labels/label-fields.ts) — cualquier valor fuera
// de ese catálogo lo rechaza zod antes de tocar la base de datos.
export const labelProfileInputSchema = z
  .object({
    key: z
      .string()
      .trim()
      .min(1, 'La clave es obligatoria')
      .max(60)
      .regex(/^[a-z0-9_]+$/, 'Solo minúsculas, números y guion bajo'),
    name: z.string().trim().min(1, 'El nombre es obligatorio').max(120),
    isActive: z.boolean(),
    visibleFields: z.array(fieldKeySchema),
    requiredFields: z.array(fieldKeySchema),
    blockingFields: z.array(fieldKeySchema),
    preparationFields: z.array(fieldKeySchema),
    fieldOrder: z.array(fieldKeySchema),
    dateType: z.enum(DATE_TYPES),
    suggestedShelfLifeDays: z.number().int().positive().nullable(),
    defaultStorageText: z.string().trim().max(500).nullable(),
    fixedTexts: z.record(z.string(), z.string()).nullable(),
    requiresWeight: z.boolean(),
    requiresLot: z.boolean(),
    requiresBeefTraceability: z.boolean(),
    requiresHealthMark: z.boolean(),
  })
  .superRefine((value, ctx) => {
    const visible = new Set(value.visibleFields);
    for (const field of [...value.requiredFields, ...value.blockingFields]) {
      if (!visible.has(field)) {
        ctx.addIssue({
          code: 'custom',
          message: `"${field}" es obligatorio/bloqueante pero no está en los campos visibles`,
          path: ['visibleFields'],
        });
      }
    }
    const required = new Set(value.requiredFields);
    for (const field of value.blockingFields) {
      if (!required.has(field)) {
        ctx.addIssue({
          code: 'custom',
          message: `"${field}" bloquea la impresión pero no está marcado como obligatorio`,
          path: ['blockingFields'],
        });
      }
    }
  });

export type LabelProfileInput = z.infer<typeof labelProfileInputSchema>;
