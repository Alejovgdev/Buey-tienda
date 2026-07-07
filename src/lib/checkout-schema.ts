import { z } from 'zod';

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
    .regex(/^[0-9+ ]{9,15}$/, { message: 'Teléfono no válido' }),
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
});

export type CustomerData = z.infer<typeof customerDataSchema>;

// z.string().uuid() exige version/variant RFC4122 (v4) y rechaza los UUIDs
// de seed de Fase 1 (p.ej. "33333333-0000-0000-0000-000000000001", validos
// como UUID de Postgres pero sin esos bits). Se valida solo la forma general.
const uuidLikeRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const cartLineItemSchema = z.object({
  variantId: z.string().regex(uuidLikeRegex, { message: 'Identificador de producto no válido' }),
  quantity: z.number().int().min(1).max(50),
});

export const createSessionRequestSchema = z.object({
  customer: customerDataSchema,
  items: z.array(cartLineItemSchema).min(1).max(50),
});

export type CreateSessionRequest = z.infer<typeof createSessionRequestSchema>;
