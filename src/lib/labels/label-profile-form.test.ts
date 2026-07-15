import { describe, expect, it } from 'vitest';
import { buildLabelProfileArrays, MATRIX_FIELD_KEYS, toLabelProfileFormInput, type LabelProfileFormInput } from './label-profile-form';
import { LABEL_FIELD_SOURCE } from './label-fields';
import type { Tables } from '@/supabase/types';

function emptyMatrix(): LabelProfileFormInput['matrix'] {
  const matrix: LabelProfileFormInput['matrix'] = {};
  for (const key of MATRIX_FIELD_KEYS) {
    matrix[key] = { visible: false, required: false, blocking: false };
  }
  return matrix;
}

function baseForm(overrides: Partial<LabelProfileFormInput> = {}): LabelProfileFormInput {
  return {
    key: 'perfil_prueba',
    name: 'Perfil de prueba',
    isActive: true,
    dateType: 'EXPIRY',
    suggestedShelfLifeDays: null,
    defaultStorageText: null,
    fixedNote: null,
    requiresWeight: false,
    requiresLot: false,
    requiresBeefTraceability: false,
    requiresHealthMark: false,
    matrix: emptyMatrix(),
    ...overrides,
  };
}

describe('buildLabelProfileArrays', () => {
  it('incluye en visible/required/blocking solo lo marcado en la matriz', () => {
    const form = baseForm();
    form.matrix.ingredients = { visible: true, required: true, blocking: true };
    form.matrix.allergens = { visible: true, required: false, blocking: false };

    const result = buildLabelProfileArrays(form);

    expect(result.visibleFields).toEqual(expect.arrayContaining(['ingredients', 'allergens']));
    expect(result.requiredFields).toContain('ingredients');
    expect(result.requiredFields).not.toContain('allergens');
    expect(result.blockingFields).toContain('ingredients');
  });

  it('ignora "bloquea impresión" si el campo no está marcado como obligatorio', () => {
    const form = baseForm();
    form.matrix.origin = { visible: true, required: false, blocking: true };

    const result = buildLabelProfileArrays(form);

    expect(result.requiredFields).not.toContain('origin');
    expect(result.blockingFields).not.toContain('origin');
  });

  it('excluye best_before_date cuando dateType es EXPIRY, y viceversa', () => {
    const formExpiry = baseForm({ dateType: 'EXPIRY' });
    formExpiry.matrix.expiry_date = { visible: true, required: true, blocking: true };
    formExpiry.matrix.best_before_date = { visible: true, required: true, blocking: true };
    const resultExpiry = buildLabelProfileArrays(formExpiry);
    expect(resultExpiry.visibleFields).toContain('expiry_date');
    expect(resultExpiry.visibleFields).not.toContain('best_before_date');

    const formBestBefore = baseForm({ dateType: 'BEST_BEFORE' });
    formBestBefore.matrix.expiry_date = { visible: true, required: true, blocking: true };
    formBestBefore.matrix.best_before_date = { visible: true, required: true, blocking: true };
    const resultBestBefore = buildLabelProfileArrays(formBestBefore);
    expect(resultBestBefore.visibleFields).toContain('best_before_date');
    expect(resultBestBefore.visibleFields).not.toContain('expiry_date');
  });

  it('los interruptores requiresWeight/requiresLot/requiresBeefTraceability/requiresHealthMark gobiernan sus campos sin pasar por la matriz', () => {
    const form = baseForm({ requiresWeight: true, requiresLot: true, requiresBeefTraceability: true, requiresHealthMark: true });
    const result = buildLabelProfileArrays(form);

    for (const field of ['net_weight', 'lot', 'beef_traceability', 'identification_mark'] as const) {
      expect(result.visibleFields).toContain(field);
      expect(result.requiredFields).toContain(field);
      expect(result.blockingFields).toContain(field);
    }
  });

  it('preparation_fields se deriva automáticamente del origen de cada campo visible', () => {
    const form = baseForm({ requiresLot: true });
    form.matrix.packaging_date = { visible: true, required: true, blocking: true };
    form.matrix.ingredients = { visible: true, required: true, blocking: true };

    const result = buildLabelProfileArrays(form);

    expect(result.preparationFields).toEqual(
      expect.arrayContaining(result.visibleFields.filter((field) => LABEL_FIELD_SOURCE[field] === 'preparation'))
    );
    expect(result.preparationFields).toContain('lot');
    expect(result.preparationFields).toContain('packaging_date');
    expect(result.preparationFields).not.toContain('ingredients');
  });

  it('field_order sigue el orden canónico del catálogo, no el orden de inserción en la matriz', () => {
    const form = baseForm();
    form.matrix.origin = { visible: true, required: false, blocking: false };
    form.matrix.product_name = { visible: true, required: false, blocking: false };
    form.matrix.ingredients = { visible: true, required: false, blocking: false };

    const result = buildLabelProfileArrays(form);
    const positions = result.fieldOrder.map((field) => result.fieldOrder.indexOf(field));
    expect(result.fieldOrder.indexOf('product_name')).toBeLessThan(result.fieldOrder.indexOf('ingredients'));
    expect(result.fieldOrder.indexOf('ingredients')).toBeLessThan(result.fieldOrder.indexOf('origin'));
    expect(positions.length).toBe(result.fieldOrder.length);
  });
});

describe('toLabelProfileFormInput (round-trip con buildLabelProfileArrays)', () => {
  it('reconstruye un formulario que, al expandirse de nuevo, produce los mismos arrays', () => {
    const row: Tables<'label_profiles'> = {
      id: 'profile-1',
      key: 'preparado_carnico',
      name: 'Preparado cárnico',
      is_active: true,
      visible_fields: ['product_name', 'variant_name', 'ingredients', 'allergens', 'lot', 'expiry_date'],
      required_fields: ['product_name', 'ingredients', 'allergens', 'lot', 'expiry_date'],
      blocking_fields: ['product_name', 'ingredients', 'allergens', 'lot', 'expiry_date'],
      preparation_fields: ['lot', 'expiry_date'],
      field_order: ['product_name', 'variant_name', 'ingredients', 'allergens', 'lot', 'expiry_date'],
      date_type: 'EXPIRY',
      suggested_shelf_life_days: null,
      default_storage_text: 'Conservar entre 0°C y 4°C',
      fixed_texts: null,
      requires_weight: false,
      requires_lot: true,
      requires_beef_traceability: false,
      requires_health_mark: false,
      created_at: '2026-07-15T00:00:00.000Z',
      updated_at: '2026-07-15T00:00:00.000Z',
    };

    const formInput = toLabelProfileFormInput(row);
    const rebuilt = buildLabelProfileArrays(formInput);

    expect(new Set(rebuilt.visibleFields)).toEqual(new Set(row.visible_fields));
    expect(new Set(rebuilt.requiredFields)).toEqual(new Set(row.required_fields));
    expect(new Set(rebuilt.blockingFields)).toEqual(new Set(row.blocking_fields));
  });
});
