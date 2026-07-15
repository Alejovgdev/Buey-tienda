import { describe, expect, it } from 'vitest';
import { LABEL_FIELD_KEYS, LABEL_FIELD_LABELS, LABEL_FIELD_SOURCE, isLabelFieldKey } from './label-fields';

describe('catálogo de campos de etiquetado', () => {
  it('isLabelFieldKey reconoce solo las claves del catálogo', () => {
    for (const key of LABEL_FIELD_KEYS) {
      expect(isLabelFieldKey(key)).toBe(true);
    }
    expect(isLabelFieldKey('campo_inventado')).toBe(false);
    expect(isLabelFieldKey('')).toBe(false);
  });

  it('toda clave del catálogo tiene una etiqueta humana y un origen de dato asignados', () => {
    for (const key of LABEL_FIELD_KEYS) {
      expect(LABEL_FIELD_LABELS[key], `falta LABEL_FIELD_LABELS para "${key}"`).toBeTruthy();
      expect(LABEL_FIELD_SOURCE[key], `falta LABEL_FIELD_SOURCE para "${key}"`).toBeTruthy();
    }
  });

  it('no hay claves duplicadas en el catálogo', () => {
    expect(new Set(LABEL_FIELD_KEYS).size).toBe(LABEL_FIELD_KEYS.length);
  });
});
