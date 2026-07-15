import 'server-only';
import { cookies } from 'next/headers';
import {
  ADMIN_SESSION_COOKIE,
  verifyAdminSessionToken,
  getAdminSessionClaims,
  type AdminSessionClaims,
} from '@/lib/admin-auth';

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

// Sistema de etiquetado alimentario: el nombre del trabajador se obtiene
// SIEMPRE de aquí (la cookie de sesión), nunca del body de la petición — ver
// docs/FOOD_LABEL_ADMIN_DESIGN.md, §13 y §17. Devuelve null tanto si no hay
// sesión como si la sesión es anterior a esta función (sin workerName/sid),
// para que los endpoints de etiquetado exijan volver a iniciar sesión antes
// de registrar ninguna acción sin nombre asociado.
export async function getAdminSession(): Promise<AdminSessionClaims | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;
  if (!token) return null;
  return getAdminSessionClaims(token);
}
