import { z } from 'zod';

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha no válida');

export const generateLabelsSchema = z.object({
  orderItemId: z.string().uuid(),
  desiredCount: z.number().int().min(1).max(999),
});

export type GenerateLabelsInput = z.infer<typeof generateLabelsSchema>;

// Todos los campos son opcionales: el trabajador puede guardar cambios
// parciales según va completando la etiqueta (docs/FOOD_LABEL_ADMIN_DESIGN.md, §5.4).
export const updateLabelSchema = z.object({
  weightGrams: z.number().positive().nullable().optional(),
  lote: z.string().trim().min(1).max(120).optional(),
  elaborationDate: isoDate.nullable().optional(),
  packagingDate: isoDate.nullable().optional(),
  expiryDate: isoDate.nullable().optional(),
  bestBeforeDate: isoDate.nullable().optional(),
  unitsInPackage: z.number().int().min(1).max(9999).optional(),
  beefTraceabilityInfo: z.string().trim().max(500).nullable().optional(),
  countryOfOrigin: z.string().trim().max(200).nullable().optional(),
});

export type UpdateLabelInput = z.infer<typeof updateLabelSchema>;

export const cancelLabelSchema = z.object({
  reason: z.string().trim().min(1, 'Indica el motivo de la anulación').max(300),
});

export const printLabelsSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(200),
  reprintReason: z.string().trim().max(300).nullable().optional(),
});

export type PrintLabelsInput = z.infer<typeof printLabelsSchema>;
