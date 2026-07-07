import { NextResponse, type NextRequest } from 'next/server';
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from '@/lib/admin-auth';

// Fase 7, Unidad 1. Matcher restringido a /admin/:path* — no debe tocar
// ninguna ruta pública del sitio (tienda, carta, reservas, checkout...).
// Las rutas de mutación bajo /api/admin/* NO están cubiertas por este
// matcher a propósito: cada una verifica la sesión en su propio handler
// (ver src/app/api/admin/**), así no dependen únicamente del middleware.
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === '/admin/login') {
    return NextResponse.next();
  }

  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  const isValid = token ? await verifyAdminSessionToken(token) : false;

  if (!isValid) {
    const loginUrl = new URL('/admin/login', request.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
