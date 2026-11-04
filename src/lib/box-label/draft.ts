import 'server-only';
import { randomUUID } from 'node:crypto';
import { SignJWT, jwtVerify } from 'jose';
import { z } from 'zod';
import type { AdminSessionClaims } from '@/lib/admin-auth';
import { boxLabelSnapshotSchema, type BoxLabelSnapshot } from './schema';

const AUDIENCE = 'order-box-label-v1';
const draftSchema = z.object({
  sub: z.string().uuid(), jti: z.string().uuid(), sid: z.string().min(1), snapshot: boxLabelSnapshotSchema,
});

function secret() {
  if (!process.env.ADMIN_JWT_SECRET) throw new Error('ADMIN_JWT_SECRET no configurado');
  return new TextEncoder().encode(process.env.ADMIN_JWT_SECRET);
}

export async function signBoxLabelDraft(orderId: string, snapshot: BoxLabelSnapshot, session: AdminSessionClaims) {
  return new SignJWT({ snapshot, sid: session.sid })
    .setProtectedHeader({ alg: 'HS256' }).setAudience(AUDIENCE).setSubject(orderId)
    .setJti(randomUUID()).setIssuedAt().setExpirationTime('8h').sign(secret());
}

export async function verifyBoxLabelDraft(token: string, orderId: string, session: AdminSessionClaims) {
  const { payload } = await jwtVerify(token, secret(), { audience: AUDIENCE, algorithms: ['HS256'] });
  const draft = draftSchema.parse(payload);
  if (draft.sub !== orderId || draft.sid !== session.sid || draft.snapshot.preparedBy !== session.workerName) {
    throw new Error('La vista previa no pertenece a este pedido y sesión');
  }
  return { draftId: draft.jti, snapshot: draft.snapshot };
}
