import 'server-only';
import { cookies } from 'next/headers';
import { ADMIN_SESSION_COOKIE, verifyAdminSessionToken } from '@/lib/admin-auth';

// Fase 7, Unidad 1. Defensa en profundidad: el middleware ya protege las
// páginas /admin/*, pero las API Routes de mutación bajo /api/admin/* no
// están cubiertas por su matcher (a propósito, ver src/middleware.ts) y las
// Server Components de /admin/pedidos vuelven a comprobar la sesión por su
// cuenta en vez de fiarse solo del middleware.
export async function isAdminAuthenticated(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return false;
  return verifyAdminSessionToken(token);
}
