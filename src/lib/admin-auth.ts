import { SignJWT, jwtVerify } from 'jose';

// Fase 7, Unidad 1. jose (no jsonwebtoken) porque este módulo se importa
// tanto desde src/middleware.ts (Edge runtime) como desde API Routes/Server
// Components (Node runtime) — jsonwebtoken depende de la API de Node crypto
// y no funciona en Edge.
export const ADMIN_SESSION_COOKIE = 'admin_session';
export const ADMIN_SESSION_DURATION_SECONDS = 8 * 60 * 60; // 8h, según el documento

// Sistema de etiquetado alimentario: sigue existiendo un único perfil de
// administrador (misma ADMIN_PASSWORD compartida) — esto NO crea cuentas ni
// roles nuevos. Al iniciar sesión se pide además un nombre operativo de
// texto libre, que viaja dentro de esta misma cookie/JWT como un dato más de
// la sesión, junto a un identificador de sesión (sid) generado en el login.
// El nombre se mantiene obligatorio aunque el etiquetado esté desactivado.
// Permite identificar al trabajador y anotar la auditoría de etiquetas cuando
// esté habilitada. No autentica una identidad real: cualquiera que conozca la
// contraseña compartida puede escribir cualquier nombre. Ver §17 del diseño.
export interface AdminSessionClaims {
  workerName: string;
  sid: string;
}

function getSecretKey(): Uint8Array {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) {
    throw new Error('ADMIN_JWT_SECRET no configurado');
  }
  return new TextEncoder().encode(secret);
}

export async function createAdminSessionToken(claims: AdminSessionClaims): Promise<string> {
  return new SignJWT({ role: 'admin', workerName: claims.workerName, sid: claims.sid })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${ADMIN_SESSION_DURATION_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifyAdminSessionToken(token: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    return payload.role === 'admin';
  } catch {
    return false;
  }
}

// Usado por los flujos de etiquetado, que sí necesitan saber quién actuó.
// Una sesión creada antes de esta función (sin workerName/sid) devuelve
// null aquí a propósito — obliga a volver a iniciar sesión para que quede
// registrado un nombre, en vez de dejar huecos en la auditoría.
export async function getAdminSessionClaims(token: string): Promise<AdminSessionClaims | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (payload.role !== 'admin') return null;
    const workerName = typeof payload.workerName === 'string' ? payload.workerName : null;
    const sid = typeof payload.sid === 'string' ? payload.sid : null;
    if (!workerName || !sid) return null;
    return { workerName, sid };
  } catch {
    return null;
  }
}
