import 'server-only';
import { SignJWT, jwtVerify } from 'jose';

const AUDIENCE = 'order-status-v1';
export const ORDER_STATUS_ACCESS_SECONDS = 8 * 60 * 60;

export function orderStatusCookieName(orderNumber: string): string {
  return `order_status_${orderNumber}`;
}

function secret(): Uint8Array {
  const value = process.env.ADMIN_JWT_SECRET;
  if (!value) throw new Error('ADMIN_JWT_SECRET no configurado');
  return new TextEncoder().encode(value);
}

// Capacidad limitada al estado de un pedido. No contiene datos personales ni
// claims de administrador; el audience impide reutilizar otros JWT de la app.
export async function createOrderStatusAccess(orderNumber: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setAudience(AUDIENCE)
    .setSubject(orderNumber)
    .setIssuedAt()
    .setExpirationTime(`${ORDER_STATUS_ACCESS_SECONDS}s`)
    .sign(secret());
}

export async function verifyOrderStatusAccess(token: string, orderNumber: string): Promise<boolean> {
  try {
    const { payload } = await jwtVerify(token, secret(), {
      audience: AUDIENCE, subject: orderNumber, algorithms: ['HS256'], requiredClaims: ['exp'],
    });
    return payload.sub === orderNumber;
  } catch {
    return false;
  }
}
