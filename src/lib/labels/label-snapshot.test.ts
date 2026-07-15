import { describe, expect, it } from 'vitest';
import {
  resolveLabelValuesFromProductLabel,
  resolveLabelValuesFromOrderItem,
  toOperatorData,
  parseFrozenLabelProfileRules,
  toLabelProfileRules,
} from './label-snapshot';
import type { Tables } from '@/supabase/types';

function makeLabelRow(overrides: Partial<Tables<'product_labels'>> = {}): Tables<'product_labels'> {
  return {
    id: 'label-1',
    order_item_id: 'item-1',
    product_id: 'product-1',
    lote: 'L260715-chuleton',
    product_name: 'Chuletón de Vaca Madurada',
    variant_name: '1 kg',
    ingredients: 'Carne de vacuno (100%)',
    allergens: [],
    allergens_notes: null,
    storage_conditions: 'Conservar entre 0°C y 4°C',
    prep_instructions: 'Sacar de la nevera 30 min antes',
    cooking_method: 'Cocinar a la brasa',
    weight_grams: 987,
    elaboration_date: '2026-07-15',
    expiry_date: '2026-07-20',
    label_profile_id: null,
    package_sequence: 1,
    package_count_for_line: 1,
    units_in_package: 1,
    country_of_origin: 'España',
    packaging_date: '2026-07-15',
    best_before_date: null,
    beef_traceability_info: null,
    status: 'PENDING',
    cancelled_at: null,
    cancelled_reason: null,
    created_by: 'Ana',
    updated_by: 'Ana',
    created_at: '2026-07-15T10:00:00.000Z',
    updated_at: '2026-07-15T10:00:00.000Z',
    ...overrides,
  };
}

const operator = toOperatorData({
  operator_legal_name: 'EL BUEY MADURADO, S.L.',
  operator_tax_id: 'B-24770836',
  operator_address: 'C/ La Reina, 41',
  operator_country: 'ES',
  operator_health_registry_code: '12345/V',
  operator_identification_mark: 'ES 12.345/V CE',
});

describe('resolveLabelValuesFromProductLabel', () => {
  it('combina las instrucciones de uso y el modo de cocinado en un único texto', () => {
    const values = resolveLabelValuesFromProductLabel(makeLabelRow(), operator);
    expect(values.usage_instructions).toBe('Sacar de la nevera 30 min antes — Cocinar a la brasa');
  });

  it('devuelve null en instrucciones de uso si ninguna de las dos está rellena', () => {
    const values = resolveLabelValuesFromProductLabel(
      makeLabelRow({ prep_instructions: null, cooking_method: null }),
      operator
    );
    expect(values.usage_instructions).toBeNull();
  });

  it('combina el RGSEAA y la marca de identificación en la marca resuelta', () => {
    const values = resolveLabelValuesFromProductLabel(makeLabelRow(), operator);
    expect(values.identification_mark).toBe('RGSEAA: 12345/V — ES 12.345/V CE');
  });

  it('la marca de identificación es null si el operador no tiene ninguno de los dos datos', () => {
    const emptyOperator = toOperatorData(null);
    const values = resolveLabelValuesFromProductLabel(makeLabelRow(), emptyOperator);
    expect(values.identification_mark).toBeNull();
  });

  it('el peso real de la etiqueta es el que se muestra (nunca uno estimado en su lugar)', () => {
    const values = resolveLabelValuesFromProductLabel(makeLabelRow({ weight_grams: 950 }), operator);
    expect(values.net_weight_grams).toBe(950);
  });
});

describe('resolveLabelValuesFromOrderItem', () => {
  it('deja los campos de preparación en null antes de generar la etiqueta', () => {
    const item: Tables<'order_items'> = {
      id: 'item-1',
      order_id: 'order-1',
      product_variant_id: 'variant-1',
      product_name_snapshot: 'Chuletón de Vaca Madurada',
      variant_name_snapshot: '1 kg',
      unit_price_snapshot: 4500,
      quantity: 2,
      line_total: 9000,
      allergens_snapshot: [],
      allergens_notes_snapshot: null,
      item_type: 'PRODUCT',
      promotion_id: null,
      ingredients_snapshot: 'Carne de vacuno (100%)',
      storage_conditions_snapshot: 'Conservar entre 0°C y 4°C',
      prep_instructions_snapshot: null,
      cooking_method_snapshot: null,
      country_of_origin_snapshot: 'España',
      label_display_name_snapshot: null,
      usual_units_per_package_snapshot: 1,
      suggested_package_count_snapshot: 1,
      label_profile_id_snapshot: null,
      label_profile_snapshot: null,
    };

    const values = resolveLabelValuesFromOrderItem(item, operator);
    expect(values.lot).toBeNull();
    expect(values.net_weight_grams).toBeNull();
    expect(values.expiry_date).toBeNull();
    expect(values.ingredients).toBe('Carne de vacuno (100%)');
  });
});

describe('parseFrozenLabelProfileRules', () => {
  it('reconstruye las reglas desde un JSONB con forma válida', () => {
    const frozen = toLabelProfileRules({
      id: 'profile-1',
      key: 'carne_vacuno',
      name: 'Carne de vacuno',
      is_active: true,
      visible_fields: ['product_name', 'net_weight'],
      required_fields: ['product_name'],
      blocking_fields: ['product_name'],
      preparation_fields: ['net_weight'],
      field_order: ['product_name', 'net_weight'],
      date_type: 'EXPIRY',
      suggested_shelf_life_days: null,
      default_storage_text: null,
      fixed_texts: null,
      requires_weight: true,
      requires_lot: true,
      requires_beef_traceability: true,
      requires_health_mark: false,
      created_at: '2026-07-15T00:00:00.000Z',
      updated_at: '2026-07-15T00:00:00.000Z',
    });

    const parsed = parseFrozenLabelProfileRules(frozen as unknown);
    expect(parsed).not.toBeNull();
    expect(parsed?.key).toBe('carne_vacuno');
    expect(parsed?.requiresBeefTraceability).toBe(true);
  });

  it('devuelve null para valores que no tienen forma de perfil (pedidos antiguos sin snapshot)', () => {
    expect(parseFrozenLabelProfileRules(null)).toBeNull();
    expect(parseFrozenLabelProfileRules(undefined)).toBeNull();
    expect(parseFrozenLabelProfileRules({})).toBeNull();
    expect(parseFrozenLabelProfileRules({ foo: 'bar' })).toBeNull();
  });

  it('filtra claves de campo desconocidas en vez de fallar', () => {
    const parsed = parseFrozenLabelProfileRules({
      id: 'x',
      key: 'x',
      name: 'x',
      visibleFields: ['product_name', 'campo_inventado'],
    });
    expect(parsed?.visibleFields).toEqual(['product_name']);
  });
});
