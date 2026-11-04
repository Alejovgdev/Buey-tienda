import { randomUUID, timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_DURATION_SECONDS,
  createAdminSessionToken,
} from '@/lib/admin-auth';
import { checkLoginRateLimit, recordFailedLoginAttempt, resetLoginRateLimit } from '@/lib/admin/login-rate-limit';

// H-04: un unico admin, asi que la IP del cliente es clave suficiente para la
// ventana deslizante (no hace falta distinguir por usuario).
function getClientKey(request: Request): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();
  return request.headers.get('x-real-ip') ?? 'unknown';
}

function passwordsMatch(received: string, expected: string): boolean {
  const receivedBuffer = Buffer.from(received);
  const expectedBuffer = Buffer.from(expected);
  // timingSafeEqual exige buffers de igual longitud - si difieren, ya sabemos
  // que no coinciden sin necesidad de comparar en tiempo constante.
  return receivedBuffer.length === expectedBuffer.length && timingSafeEqual(receivedBuffer, expectedBuffer);
}

export async function POST(request: Request) {
  const clientKey = getClientKey(request);
  const rateLimit = checkLoginRateLimit(clientKey);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: 'Demasiados intentos fallidos. Inténtalo de nuevo más tarde.' },
      { status: 429, headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) } }
    );
  }

  const body = await request.json().catch(() => null);
  const password = typeof body?.password === 'string' ? body.password : null;
  const workerName = typeof body?.workerName === 'string' ? body.workerName.trim() : '';

  if (!password) {
    return NextResponse.json({ error: 'Contraseña requerida' }, { status: 400 });
  }

  // El nombre operativo sigue siendo obligatorio aunque el etiquetado esté
  // desactivado. Se conserva en la sesión para identificar al trabajador;
  // no crea una cuenta ni un rol nuevo.
  if (!workerName || workerName.length > 80) {
    return NextResponse.json(
      { error: 'Indica tu nombre de trabajador para iniciar sesión' },
      { status: 400 }
    );
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    console.error('[admin/auth] ADMIN_PASSWORD no configurado en el servidor');
    return NextResponse.json({ error: 'Configuración del servidor incompleta' }, { status: 500 });
  }

  if (!passwordsMatch(password, adminPassword)) {
    recordFailedLoginAttempt(clientKey);
    return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 });
  }

  resetLoginRateLimit(clientKey);

  const token = await createAdminSessionToken({ workerName, sid: randomUUID() });
  const response = NextResponse.json({ ok: true });
  response.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ADMIN_SESSION_DURATION_SECONDS,
  });
  return response;
}
