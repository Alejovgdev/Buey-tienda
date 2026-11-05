import { z } from 'zod';
import { normalizeStoredPhone } from '@/lib/phone';

const spanishPostalCodeRegex = /^\d{5}$/;
const nonPeninsularPostalCodePrefixes = ['07', '35', '38', '51', '52'];

function isPeninsularPostalCode(postalCode: string) {
  return !nonPeninsularPostalCodePrefixes.some((prefix) => postalCode.startsWith(prefix));
}

// Fase 4, Unidad 1. Mismo esquema en cliente (UX) y servidor (verdad real, ver
// create-session/route.ts). Nombres de campo mapeados 1:1 a las columnas de
// `orders` (customer_name, shipping_street, ...) para que el INSERT del backend
// no necesite remapear nada.
export const customerDataSchema = z.object({
  customerName: z.string().trim().min(1, { message: 'El nombre es obligatorio' }).max(100),
  customerLastName: z
    .string()
    .trim()
    .min(1, { message: 'Los apellidos son obligatorios' })
    .max(100),
  customerEmail: z.string().trim().toLowerCase().email({ message: 'Email no válido' }).max(200),
  customerPhone: z
    .string()
    .trim()
    .transform((value, context) => {
      const normalizedPhone = normalizeStoredPhone(value);

      if (!normalizedPhone) {
        context.addIssue({ code: 'custom', message: 'Teléfono no válido' });
        return z.NEVER;
      }

      return normalizedPhone;
    }),
  shippingStreet: z
    .string()
    .trim()
    .min(1, { message: 'La dirección es obligatoria' })
    .max(200),
  shippingCity: z.string().trim().min(1, { message: 'La ciudad es obligatoria' }).max(100),
  shippingProvince: z
    .string()
    .trim()
    .min(1, { message: 'La provincia es obligatoria' })
    .max(100),
  shippingPostalCode: z
    .string()
    .trim()
    .regex(spanishPostalCodeRegex, { message: 'Código postal no válido' })
    .refine(isPeninsularPostalCode, {
      message: 'Solo realizamos envíos a España peninsular',
    }),
  shippingCountry: z.literal('ES').default('ES'),
  shippingNotes: z.string().trim().max(500).optional(),
  acceptTerms: z.literal(true, { message: 'Debes aceptar las condiciones' }),
  // Es un consentimiento independiente y opcional. Si un cliente antiguo de
  // la API no envía el campo, se interpreta como que NO ha consentido.
  marketingConsent: z.boolean().default(false),
});

export type CustomerData = z.infer<typeof customerDataSchema>;

// z.string().uuid() exige version/variant RFC4122 (v4) y rechaza los UUIDs
// de seed de Fase 1 (p.ej. "33333333-0000-0000-0000-000000000001", validos
// como UUID de Postgres pero sin esos bits). Se valida solo la forma general.
const uuidLikeRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const cartLineItemSchema = z.object({
  variantId: z.string().regex(uuidLikeRegex, { message: 'Identificador de producto no válido' }),
  productSlug: z.string().min(1).max(200),
  quantity: z.number().int().min(1).max(50),
  // Solo sirve para detectar un cambio respecto a lo que vio el cliente.
  // Nunca se usa como precio de venta ni para calcular el cobro.
  expectedUnitPrice: z.number().int().nonnegative().safe(),
});

export const cartReviewRequestSchema = z.object({
  items: z.array(cartLineItemSchema).min(1).max(50),
});

export const createSessionRequestSchema = z.object({
  customer: customerDataSchema,
  items: z.array(cartLineItemSchema).min(1).max(50),
  expectedTotal: z.number().int().nonnegative().safe(),
});

export type CheckoutLine = z.infer<typeof cartLineItemSchema>;
export type CreateSessionRequest = z.infer<typeof createSessionRequestSchema>;
