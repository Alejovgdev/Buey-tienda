import { parsePhoneNumberFromString } from 'libphonenumber-js/min';
import type { CountryCode } from 'libphonenumber-js';

export const PHONE_PREFIX_OPTIONS = [
  { country: 'ES', label: 'España', callingCode: '+34' },
  { country: 'PT', label: 'Portugal', callingCode: '+351' },
  { country: 'FR', label: 'Francia', callingCode: '+33' },
  { country: 'AD', label: 'Andorra', callingCode: '+376' },
  { country: 'GB', label: 'Reino Unido', callingCode: '+44' },
  { country: 'DE', label: 'Alemania', callingCode: '+49' },
  { country: 'IT', label: 'Italia', callingCode: '+39' },
  { country: 'BE', label: 'Bélgica', callingCode: '+32' },
  { country: 'NL', label: 'Países Bajos', callingCode: '+31' },
  { country: 'CH', label: 'Suiza', callingCode: '+41' },
  { country: 'IE', label: 'Irlanda', callingCode: '+353' },
  { country: 'US', label: 'Estados Unidos', callingCode: '+1' },
  { country: 'MA', label: 'Marruecos', callingCode: '+212' },
] as const satisfies ReadonlyArray<{
  country: CountryCode;
  label: string;
  callingCode: `+${string}`;
}>;

export type PhonePrefixCountry = (typeof PHONE_PREFIX_OPTIONS)[number]['country'];

export type PhoneNormalizationResult =
  | { ok: true; value: string }
  | { ok: false; message: string };

export function getPhonePrefixOption(country: PhonePrefixCountry) {
  return PHONE_PREFIX_OPTIONS.find((option) => option.country === country);
}

function normalizePhonePrefix(prefix: string) {
  const trimmed = prefix.trim();
  const withoutInternationalExitCode = trimmed.startsWith('00') ? trimmed.slice(2) : trimmed;
  const digits = withoutInternationalExitCode.replace(/\D/g, '');

  if (digits.length < 1 || digits.length > 4) {
    return null;
  }

  return `+${digits}`;
}

function normalizeFullPhoneInput(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith('00')) {
    return `+${trimmed.replace(/\D/g, '').slice(2)}`;
  }

  return trimmed;
}

export function normalizeInternationalPhone(
  prefix: string,
  phoneNumber: string,
  defaultCountry?: CountryCode
): PhoneNormalizationResult {
  const normalizedPrefix = normalizePhonePrefix(prefix);
  const trimmedPhoneNumber = phoneNumber.trim();

  if (!trimmedPhoneNumber) {
    return { ok: false, message: 'El teléfono es obligatorio' };
  }

  if (!normalizedPrefix) {
    return { ok: false, message: 'Prefijo no válido' };
  }

  const rawPhoneNumber =
    trimmedPhoneNumber.startsWith('+') || trimmedPhoneNumber.startsWith('00')
      ? normalizeFullPhoneInput(trimmedPhoneNumber)
      : `${normalizedPrefix}${trimmedPhoneNumber.replace(/\D/g, '')}`;

  const parsedPhoneNumber = parsePhoneNumberFromString(rawPhoneNumber, {
    defaultCountry,
    extract: false,
  });

  if (!parsedPhoneNumber?.isValid()) {
    return { ok: false, message: 'Teléfono no válido' };
  }

  return { ok: true, value: parsedPhoneNumber.number };
}

export function normalizeStoredPhone(phoneNumber: string) {
  const parsedPhoneNumber = parsePhoneNumberFromString(normalizeFullPhoneInput(phoneNumber), {
    extract: false,
  });

  return parsedPhoneNumber?.isValid() ? parsedPhoneNumber.number : null;
}
