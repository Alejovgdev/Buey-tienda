import { describe, expect, it } from 'vitest';
import { customerDataSchema } from '@/lib/checkout-schema';

const validCustomer = {
  customerName: 'Ana',
  customerLastName: 'García',
  customerEmail: 'ana@example.com',
  customerPhone: '+34670775786',
  shippingStreet: 'Calle Mayor, 1',
  shippingCity: 'Xàtiva',
  shippingProvince: 'València',
  shippingPostalCode: '46800',
  shippingCountry: 'ES' as const,
  acceptTerms: true as const,
};

describe('customerDataSchema: consentimiento comercial', () => {
  it('lo deja en false cuando un cliente no envía el campo', () => {
    const result = customerDataSchema.parse(validCustomer);

    expect(result.marketingConsent).toBe(false);
  });

  it('acepta una elección afirmativa', () => {
    const result = customerDataSchema.parse({
      ...validCustomer,
      marketingConsent: true,
    });

    expect(result.marketingConsent).toBe(true);
  });

  it('acepta una elección negativa sin bloquear la compra', () => {
    const result = customerDataSchema.parse({
      ...validCustomer,
      marketingConsent: false,
    });

    expect(result.marketingConsent).toBe(false);
  });

  it('rechaza valores que no sean booleanos', () => {
    const result = customerDataSchema.safeParse({
      ...validCustomer,
      marketingConsent: 'true',
    });

    expect(result.success).toBe(false);
  });

  it('sigue exigiendo por separado la aceptación de las condiciones', () => {
    const result = customerDataSchema.safeParse({
      ...validCustomer,
      acceptTerms: false,
      marketingConsent: true,
    });

    expect(result.success).toBe(false);
  });
});
