import { SignJWT, jwtVerify } from 'jose';

// Fase 7, Unidad 1. jose (no jsonwebtoken) porque este módulo se importa
// tanto desde src/middleware.ts (Edge runtime) como desde API Routes/Server
// Components (Node runtime) — jsonwebtoken depende de la API de Node crypto
// y no funciona en Edge.
export const ADMIN_SESSION_COOKIE = 'admin_session';
export const ADMIN_SESSION_DURATION_SECONDS = 8 * 60 * 60; // 8h, según el documento

function getSecretKey(): Uint8Array {
  const secret = process.env.ADMIN_JWT_SECRET;
  if (!secret) {
    throw new Error('ADMIN_JWT_SECRET no configurado');
  }
  return new TextEncoder().encode(secret);
}

export async function createAdminSessionToken(): Promise<string> {
  return new SignJWT({ role: 'admin' })
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
