import { describe, expect, it } from 'vitest';
import { getLabelValidationIssues } from './label-validation';
import type { LabelProfileRules, ResolvedLabelValues } from './label-snapshot';

function makeProfile(overrides: Partial<LabelProfileRules> = {}): LabelProfileRules {
  return {
    id: 'profile-1',
    key: 'test_profile',
    name: 'Perfil de prueba',
    visibleFields: ['product_name', 'ingredients', 'allergens', 'lot', 'expiry_date', 'net_weight'],
    requiredFields: ['product_name', 'ingredients', 'allergens', 'lot', 'expiry_date', 'net_weight'],
    blockingFields: ['product_name', 'ingredients', 'allergens', 'lot', 'expiry_date', 'net_weight'],
    preparationFields: ['lot', 'expiry_date', 'net_weight'],
    fieldOrder: ['product_name', 'ingredients', 'allergens', 'lot', 'expiry_date', 'net_weight'],
    dateType: 'EXPIRY',
    suggestedShelfLifeDays: null,
    defaultStorageText: null,
    fixedTexts: null,
    requiresWeight: true,
    requiresLot: true,
    requiresBeefTraceability: false,
    requiresHealthMark: false,
    ...overrides,
  };
}

function makeValues(overrides: Partial<ResolvedLabelValues> = {}): ResolvedLabelValues {
  return {
    product_name: 'Chuletón de Vaca Madurada',
    variant_name: '1 kg',
    net_weight_grams: 1000,
    units_in_package: 1,
    ingredients: 'Carne de vacuno (100%)',
    allergens: [],
    allergens_notes: null,
    lot: 'L260715-chuleton',
    packaging_date: null,
    production_date: null,
    expiry_date: '2026-07-20',
    best_before_date: null,
    storage_conditions: 'Conservar entre 0°C y 4°C',
    usage_instructions: null,
    origin: null,
    beef_traceability: null,
    operator_data: { legalName: 'EL BUEY MADURADO, S.L.', taxId: 'B-24770836', address: 'C/ La Reina, 41', country: 'ES', healthRegistryCode: null, identificationMark: null },
    identification_mark: null,
    ...overrides,
  };
}

describe('getLabelValidationIssues', () => {
  it('no reporta incidencias cuando todos los campos obligatorios están completos', () => {
    const issues = getLabelValidationIssues(makeValues(), makeProfile());
    expect(issues).toHaveLength(0);
  });

  it('trata un array de alérgenos vacío como una respuesta válida, no como un dato ausente', () => {
    const issues = getLabelValidationIssues(makeValues({ allergens: [] }), makeProfile());
    expect(issues.some((issue) => issue.field === 'allergens')).toBe(false);
  });

  it('marca los alérgenos como ausentes cuando nunca se han configurado (null)', () => {
    const issues = getLabelValidationIssues(makeValues({ allergens: null }), makeProfile());
    const issue = issues.find((i) => i.field === 'allergens');
    expect(issue).toBeDefined();
    expect(issue?.source).toBe('product_config');
    expect(issue?.blocksPrinting).toBe(true);
  });

  it('clasifica el peso/lote/fecha faltantes como incidencias de preparación', () => {
    const issues = getLabelValidationIssues(
      makeValues({ net_weight_grams: null, lot: '', expiry_date: null }),
      makeProfile()
    );
    const fields = issues.map((issue) => issue.field);
    expect(fields).toEqual(expect.arrayContaining(['net_weight', 'lot', 'expiry_date']));
    for (const issue of issues) {
      if (['net_weight', 'lot', 'expiry_date'].includes(issue.field)) {
        expect(issue.source).toBe('preparation');
      }
    }
  });

  it('clasifica los ingredientes/nombre de producto faltantes como incidencias de configuración de producto', () => {
    const issues = getLabelValidationIssues(makeValues({ ingredients: null, product_name: null }), makeProfile());
    const productConfigIssues = issues.filter((issue) => issue.source === 'product_config');
    expect(productConfigIssues.map((issue) => issue.field)).toEqual(expect.arrayContaining(['ingredients', 'product_name']));
  });

  it('solo revisa los orígenes de dato indicados en `stages`', () => {
    const values = makeValues({ net_weight_grams: null, ingredients: null });
    const onlyProductConfig = getLabelValidationIssues(values, makeProfile(), ['product_config']);
    expect(onlyProductConfig.some((issue) => issue.field === 'net_weight')).toBe(false);
    expect(onlyProductConfig.some((issue) => issue.field === 'ingredients')).toBe(true);
  });

  it('un campo obligatorio pero no bloqueante no marca blocksPrinting', () => {
    const profile = makeProfile({ blockingFields: ['product_name', 'lot'] });
    const issues = getLabelValidationIssues(makeValues({ ingredients: null }), profile);
    const issue = issues.find((i) => i.field === 'ingredients');
    expect(issue).toBeDefined();
    expect(issue?.blocksPrinting).toBe(false);
  });

  it('exige los datos del operador solo cuando el perfil los marca como obligatorios', () => {
    const profileWithoutOperator = makeProfile();
    const values = makeValues({ operator_data: { legalName: null, taxId: null, address: null, country: 'ES', healthRegistryCode: null, identificationMark: null } });
    expect(getLabelValidationIssues(values, profileWithoutOperator).some((i) => i.field === 'operator_data')).toBe(false);

    const profileWithOperator = makeProfile({
      requiredFields: [...profileWithoutOperator.requiredFields, 'operator_data'],
      blockingFields: [...profileWithoutOperator.blockingFields, 'operator_data'],
    });
    const issues = getLabelValidationIssues(values, profileWithOperator);
    const issue = issues.find((i) => i.field === 'operator_data');
    expect(issue).toBeDefined();
    expect(issue?.source).toBe('operator_config');
  });
});
