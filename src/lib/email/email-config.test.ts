import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RESEND_TEST_FROM, resolveEmailFrom, resolveReplyTo } from './email-config';

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => vi.restoreAllMocks());

describe('resolveEmailFrom', () => {
  it('usa EMAIL_FROM cuando está configurado', () => {
    const from = 'El Buey Madurado <pedidos@restauranteelbueymadurado.com>';
    expect(resolveEmailFrom({ EMAIL_FROM: from, VERCEL_ENV: 'production' })).toBe(from);
  });

  it('en local y en previews usa el remitente de pruebas de Resend', () => {
    expect(resolveEmailFrom({})).toBe(RESEND_TEST_FROM);
    expect(resolveEmailFrom({ VERCEL_ENV: 'preview' })).toBe(RESEND_TEST_FROM);
    expect(resolveEmailFrom({ EMAIL_FROM: '  ' })).toBe(RESEND_TEST_FROM);
    expect(console.error).not.toHaveBeenCalled();
  });

  it('en producción sin EMAIL_FROM falla con un error claro en los logs', () => {
    expect(() => resolveEmailFrom({ VERCEL_ENV: 'production' })).toThrow(/EMAIL_FROM no está configurado en producción/);
    expect(() => resolveEmailFrom({ VERCEL_ENV: 'production', EMAIL_FROM: ' ' })).toThrow();
    expect(console.error).toHaveBeenCalledWith(expect.stringContaining('EMAIL_FROM no está configurado en producción'));
  });
});

describe('resolveReplyTo', () => {
  it('usa EMAIL_REPLY_TO cuando está configurado', () => {
    expect(resolveReplyTo({ EMAIL_REPLY_TO: 'elbueymaduradoxativa@gmail.com', VERCEL_ENV: 'production' }))
      .toBe('elbueymaduradoxativa@gmail.com');
  });

  it('sin EMAIL_REPLY_TO no hay respuesta; en producción avisa sin bloquear', () => {
    expect(resolveReplyTo({})).toBeUndefined();
    expect(console.warn).not.toHaveBeenCalled();
    expect(resolveReplyTo({ VERCEL_ENV: 'production' })).toBeUndefined();
    expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('EMAIL_REPLY_TO no está configurado en producción'));
  });
});
