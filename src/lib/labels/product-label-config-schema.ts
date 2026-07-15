import { z } from 'zod';

// Configuración de etiquetado de un producto concreto, editable desde
// /admin/configuracion/etiquetas sin pasar por Supabase Studio. Reutiliza los
// campos ya existentes en products (ingredients, allergens, storage_conditions,
// prep_instructions, cooking_method) — no se duplican en ninguna tabla nueva.
export const productLabelConfigSchema = z.object({
  labelProfileId: z.string().uuid().nullable(),
  labelDisplayName: z.string().trim().max(200).nullable(),
  countryOfOrigin: z.string().trim().max(200).nullable(),
  usualUnitsPerPackage: z.number().int().min(1).max(9999),
  suggestedPackageCount: z.number().int().min(1).max(9999),
  ingredients: z.string().trim().max(2000).nullable(),
  allergens: z.array(z.string().trim().min(1)).max(30),
  allergensNotes: z.string().trim().max(500).nullable(),
  storageConditions: z.string().trim().max(500).nullable(),
  prepInstructions: z.string().trim().max(1000).nullable(),
  cookingMethod: z.string().trim().max(1000).nullable(),
});

export type ProductLabelConfigInput = z.infer<typeof productLabelConfigSchema>;

// Datos globales del operador alimentario (shop_settings), editables desde
// la misma pantalla de configuración. operator_health_registry_code y
// operator_identification_mark son opcionales por diseño (ver §17 de
// docs/FOOD_LABEL_ADMIN_DESIGN.md) — no se validan como obligatorios aquí.
export const operatorConfigSchema = z.object({
  legalName: z.string().trim().max(200).nullable(),
  taxId: z.string().trim().max(50).nullable(),
  address: z.string().trim().max(300).nullable(),
  country: z.string().trim().min(2).max(2),
  healthRegistryCode: z.string().trim().max(100).nullable(),
  identificationMark: z.string().trim().max(200).nullable(),
});

export type OperatorConfigInput = z.infer<typeof operatorConfigSchema>;
