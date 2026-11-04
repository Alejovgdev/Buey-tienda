import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ token: undefined as string | undefined }));
vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ cookies: async () => ({ get: () => mocks.token ? { value: mocks.token } : undefined }) }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import LoginPage from '@/app/admin/login/page';
import { POST as login } from '@/app/api/admin/auth/route';
import { ADMIN_SESSION_COOKIE, ADMIN_SESSION_DURATION_SECONDS, getAdminSessionClaims, verifyAdminSessionToken } from '@/lib/admin-auth';
import { getAdminSession, isAdminAuthenticated } from '@/lib/admin-session';
import { middleware } from '@/middleware';

let ip = 0;
function loginRequest(body: unknown, clientIp = `test-client-${++ip}`) {
  return new Request('http://localhost/api/admin/auth', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'x-real-ip': clientIp }, body: JSON.stringify(body),
  });
}

beforeEach(() => {
  mocks.token = undefined;
  vi.stubEnv('ADMIN_PASSWORD', 'contraseña-solo-para-pruebas');
  vi.stubEnv('ADMIN_JWT_SECRET', 'secreto-de-pruebas-para-firmar-sesiones-admin');
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

describe('login con nombre obligatorio aunque el etiquetado esté desactivado', () => {
  it('mantiene visible el nombre y deshabilita Entrar mientras está vacío', () => {
    const html = renderToStaticMarkup(createElement(LoginPage));
    expect(html).toContain('Tu nombre');
    expect(html).toContain('id="workerName"');
    expect(html).toContain('disabled=""');
    expect(html).not.toContain('cada etiqueta');
  });

  for (const workerName of [undefined, '', '   ', 'a'.repeat(81)]) {
    it(`rechaza un nombre inválido (${String(workerName).length} caracteres) sin emitir cookie`, async () => {
      const response = await login(loginRequest({ password: process.env.ADMIN_PASSWORD, workerName }));
      expect(response.status).toBe(400);
      expect(response.cookies.get(ADMIN_SESSION_COOKIE)).toBeUndefined();
    });
  }

  it('conserva nombre, sid y protecciones de cookie en una sesión válida', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    const response = await login(loginRequest({ password: process.env.ADMIN_PASSWORD, workerName: '  Ana García  ' }));
    expect(response.status).toBe(200);
    const cookie = response.cookies.get(ADMIN_SESSION_COOKIE)!;
    expect(cookie).toMatchObject({ httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: ADMIN_SESSION_DURATION_SECONDS });
    mocks.token = cookie.value;
    expect(await isAdminAuthenticated()).toBe(true);
    expect(await getAdminSession()).toEqual({ workerName: 'Ana García', sid: expect.any(String) });
    expect((await getAdminSession())?.sid).toMatch(/^[0-9a-f-]{36}$/);

    const authenticatedRequest = new NextRequest('http://localhost/admin/pedidos', {
      headers: { cookie: `${ADMIN_SESSION_COOKIE}=${cookie.value}` },
    });
    expect((await middleware(authenticatedRequest)).headers.get('x-middleware-next')).toBe('1');
  });

  it('rechaza la contraseña incorrecta y conserva el límite de intentos', async () => {
    const clientIp = `rate-limit-test-${++ip}`;
    for (let attempt = 0; attempt < 5; attempt++) {
      const response = await login(loginRequest({ password: 'incorrecta', workerName: 'Ana' }, clientIp));
      expect(response.status).toBe(401);
      expect(response.cookies.get(ADMIN_SESSION_COOKIE)).toBeUndefined();
    }
    const blocked = await login(loginRequest({ password: process.env.ADMIN_PASSWORD, workerName: 'Ana' }, clientIp));
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers.get('Retry-After'))).toBeGreaterThan(0);
  });

  it('rechaza sesiones manipuladas y caducadas y protege el panel sin sesión', async () => {
    const response = await login(loginRequest({ password: process.env.ADMIN_PASSWORD, workerName: 'Ana' }));
    const token = response.cookies.get(ADMIN_SESSION_COOKIE)!.value;
    const [header, payload] = token.split('.');
    expect(await verifyAdminSessionToken(`${header}.${payload}.firma-invalida`)).toBe(false);
    expect(await getAdminSessionClaims(`${header}.${payload}.firma-invalida`)).toBeNull();
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + (ADMIN_SESSION_DURATION_SECONDS + 1) * 1000);
    expect(await verifyAdminSessionToken(token)).toBe(false);
    expect(await getAdminSessionClaims(token)).toBeNull();
    const unauthenticated = await middleware(new NextRequest('http://localhost/admin/pedidos'));
    expect(unauthenticated.headers.get('location')).toBe('http://localhost/admin/login');
  });
});
