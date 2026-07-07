import { NextResponse } from 'next/server';
import {
  ADMIN_SESSION_COOKIE,
  ADMIN_SESSION_DURATION_SECONDS,
  createAdminSessionToken,
} from '@/lib/admin-auth';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const password = typeof body?.password === 'string' ? body.password : null;

  if (!password) {
    return NextResponse.json({ error: 'Contraseña requerida' }, { status: 400 });
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    console.error('[admin/auth] ADMIN_PASSWORD no configurado en el servidor');
    return NextResponse.json({ error: 'Configuración del servidor incompleta' }, { status: 500 });
  }

  if (password !== adminPassword) {
    return NextResponse.json({ error: 'Contraseña incorrecta' }, { status: 401 });
  }

  const token = await createAdminSessionToken();
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
