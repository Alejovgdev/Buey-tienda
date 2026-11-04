import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Json } from '@/supabase/types';

const mocks = vi.hoisted(() => ({ session: vi.fn(), from: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/admin-session', () => ({ getAdminSession: mocks.session }));
vi.mock('@/lib/supabase-admin', () => ({ supabaseAdmin: { from: mocks.from } }));
vi.mock('next/navigation', () => ({
  redirect: (url: string) => { throw new Error(`redirect:${url}`); },
  notFound: () => { throw new Error('notFound'); },
}));

import { prepareBoxLabel, BoxLabelError } from './server';
import { signBoxLabelDraft, verifyBoxLabelDraft } from './draft';
import { POST as prepare } from '@/app/api/admin/pedidos/[id]/etiqueta-caja/route';
import { POST as confirm } from '@/app/api/admin/pedidos/[id]/etiqueta-caja/confirmar/route';
import BoxLabelPage from '@/app/admin/pedidos/[id]/etiqueta-caja/page';

const orderId = '11111111-1111-4111-8111-111111111111';
const sessionA = { workerName: 'Ana', sid: 'sesion-A' };
const sessionB = { workerName: 'Bruno', sid: 'sesion-B' };
const context = { params: Promise.resolve({ id: orderId }) };
const request = (body: unknown) => new Request('http://localhost/api/admin/test', {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

let status: string;
let productName: string;
let failureTable: string | null;
let insertFailure: boolean;
let itemCount: number;
let saved: { order_id: string; draft_id: string; snapshot: Json; confirmed_session_id: string; confirmed_at: string } | null;
const inserts: object[] = [];

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('ADMIN_JWT_SECRET', 'firma-local-solo-para-las-pruebas-de-caja');
  mocks.session.mockResolvedValue(sessionA);
  status = 'PAID'; productName = 'Nombre histórico'; saved = null; failureTable = null; insertFailure = false; itemCount = 1;
  inserts.length = 0;
  mocks.from.mockImplementation((table: string) => {
    let pendingInsert: NonNullable<typeof saved> | null = null;
    let start = 0, end = 499;
    const query = {
      select: () => query, eq: () => query, order: () => query,
      range: (first: number, last: number) => { start = first; end = last; return query; },
      maybeSingle: async () => ({
        data: table === 'orders' ? { id: orderId, order_number: 'BM-2026-123', status } : saved,
        error: table === failureTable ? { message: 'Fallo simulado' } : null,
      }),
      returns: async () => ({
        data: table === 'order_items' ? Array.from({ length: itemCount }, (_, index) => ({
          id: `${String(index).padStart(8, '0')}-1111-4111-8111-111111111111`, product_variant_id: 'variant-1',
          product_name_snapshot: productName, variant_name_snapshot: 'Pack de 4', quantity: 2, item_type: 'PRODUCT',
        })).slice(start, end + 1) : [],
        error: table === failureTable ? { message: 'Fallo simulado' } : null,
      }),
      insert: (values: NonNullable<typeof saved>) => { pendingInsert = values; inserts.push(values); return query; },
      single: async () => {
        // Simula la decisión atómica de la PK, incluyendo dos peticiones
        // que llegan antes de resolverse ninguna de las dos respuestas.
        await Promise.resolve();
        if (insertFailure) return { data: null, error: { code: 'XX000' } };
        if (saved) return { data: null, error: { code: '23505' } };
        saved = { ...pendingInsert!, confirmed_at: '2026-11-04T10:00:00Z' };
        return { data: saved, error: null };
      },
    };
    return query;
  });
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllEnvs(); });

describe('vista previa y confirmación de etiqueta de caja', () => {
  it('abrir la página y preparar una copia firmada no escribe datos', async () => {
    const page = await BoxLabelPage(context);
    expect(page).toBeTruthy();
    const response = await prepare(request({ includedGiftIds: [] }), context);
    expect(response.status).toBe(200);
    const preview = await response.json();
    expect(preview.snapshot.preparedBy).toBe('Ana');
    expect(preview.draftToken).toBeTruthy();
    expect(preview.snapshot.logoDataUrl).toMatch(/^data:image\/png;base64,/);
    expect(inserts).toHaveLength(0);
    expect(saved).toBeNull();
    expect(mocks.from.mock.calls.map(([table]) => table)).not.toContain('products');
  });

  it('confirma exactamente el contenido preparado, sin reconstruirlo con líneas o datos actuales', async () => {
    const preview = await prepareBoxLabel(orderId, sessionA);
    productName = 'Datos modificados después de imprimir'; status = 'PREPARING';
    mocks.from.mockClear();
    const response = await confirm(request({ draftToken: preview.draftToken }), context);
    expect(response.status).toBe(200);
    expect(saved!.snapshot).toEqual(preview.snapshot);
    expect(saved!.confirmed_session_id).toBe('sesion-A');
    expect(mocks.from).toHaveBeenCalledExactlyOnceWith('order_box_labels');
    expect(inserts).toHaveLength(1);
  });

  it('carga todas las líneas incluso cuando el pedido supera el límite por respuesta de PostgREST', async () => {
    itemCount = 1001;
    const preview = await prepareBoxLabel(orderId, sessionA);
    expect(preview.snapshot.lines).toHaveLength(1001);
    expect(mocks.from.mock.calls.filter(([table]) => table === 'order_items')).toHaveLength(3);
    expect(inserts).toHaveLength(0);
  });

  it('reimprime desde otra sesión usando la copia y el trabajador originales, sin releer líneas ni incidencias', async () => {
    const preview = await prepareBoxLabel(orderId, sessionA);
    await confirm(request({ draftToken: preview.draftToken }), context);
    productName = 'Catálogo/líneas cambiados'; status = 'CANCELLED';
    mocks.from.mockClear();
    const reprint = await prepareBoxLabel(orderId, sessionB);
    expect(reprint.snapshot).toEqual(preview.snapshot);
    expect(reprint.snapshot.preparedBy).toBe('Ana');
    expect(reprint.draftToken).toBeNull();
    expect(reprint.confirmedAt).toBeTruthy();
    expect(mocks.from.mock.calls.map(([table]) => table)).toEqual(['orders', 'order_box_labels']);
    expect(inserts).toHaveLength(1);
  });

  it('hace idempotentes las confirmaciones duplicadas de una misma copia', async () => {
    const preview = await prepareBoxLabel(orderId, sessionA);
    const [first, second] = await Promise.all([
      confirm(request({ draftToken: preview.draftToken }), context),
      confirm(request({ draftToken: preview.draftToken }), context),
    ]);
    expect(first.status).toBe(200); expect(second.status).toBe(200);
    expect(saved!.snapshot).toEqual(preview.snapshot);
  });

  it('dos copias concurrentes distintas no se sobrescriben: una gana y la otra recibe 409', async () => {
    const first = await prepareBoxLabel(orderId, sessionA);
    const secondSnapshot = { ...first.snapshot, preparedBy: 'Bruno' };
    const secondToken = await signBoxLabelDraft(orderId, secondSnapshot, sessionB);
    mocks.session.mockResolvedValueOnce(sessionA).mockResolvedValueOnce(sessionB);
    const responses = await Promise.all([
      confirm(request({ draftToken: first.draftToken }), context), confirm(request({ draftToken: secondToken }), context),
    ]);
    expect(responses.map((response) => response.status).sort()).toEqual([200, 409]);
    expect(saved!.snapshot).toEqual(first.snapshot);
    expect(saved!.confirmed_session_id).toBe(sessionA.sid);
  });

  it('permite reintentar la confirmación tras un fallo sin cambiar la copia ya impresa', async () => {
    const preview = await prepareBoxLabel(orderId, sessionA);
    insertFailure = true;
    expect((await confirm(request({ draftToken: preview.draftToken }), context)).status).toBe(503);
    expect(saved).toBeNull();
    insertFailure = false; productName = 'Otro nombre';
    expect((await confirm(request({ draftToken: preview.draftToken }), context)).status).toBe(200);
    expect(saved!.snapshot).toEqual(preview.snapshot);
  });

  it('bloquea página y endpoints sin sesión antes de consultar datos', async () => {
    mocks.session.mockResolvedValue(null);
    await expect(BoxLabelPage(context)).rejects.toThrow('redirect:/admin/login');
    expect((await prepare(request({ includedGiftIds: [] }), context)).status).toBe(401);
    expect((await confirm(request({ draftToken: 'invalid' }), context)).status).toBe(401);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('rechaza un trabajador enviado por el cliente y una confirmación desde otra sesión', async () => {
    expect((await prepare(request({ includedGiftIds: [], workerName: 'Suplantado' }), context)).status).toBe(400);
    const preview = await prepareBoxLabel(orderId, sessionA);
    mocks.from.mockClear(); mocks.session.mockResolvedValue(sessionB);
    expect((await confirm(request({ draftToken: preview.draftToken }), context)).status).toBe(403);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('rechaza la modificación de contenido del token, otro pedido y la caducidad', async () => {
    const preview = await prepareBoxLabel(orderId, sessionA);
    const token = preview.draftToken!;
    const [header, payload, signature] = token.split('.');
    const changed = JSON.parse(Buffer.from(payload, 'base64url').toString());
    changed.snapshot.lines[0].quantity = 99;
    mocks.from.mockClear();
    expect((await confirm(request({ draftToken: `${header}.${Buffer.from(JSON.stringify(changed)).toString('base64url')}.${signature}` }), context)).status).toBe(403);
    await expect(verifyBoxLabelDraft(token, '22222222-2222-4222-8222-222222222222', sessionA)).rejects.toThrow();
    vi.useFakeTimers(); vi.setSystemTime(Date.now() + 8 * 60 * 60 * 1000 + 1000);
    expect((await confirm(request({ draftToken: token }), context)).status).toBe(403);
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('no permite nuevas copias en estados ajenos a preparación ni ignora errores de lectura', async () => {
    status = 'PENDING_PAYMENT';
    await expect(prepareBoxLabel(orderId, sessionA)).rejects.toMatchObject({ status: 409 });
    status = 'PAID'; failureTable = 'order_box_labels';
    await expect(prepareBoxLabel(orderId, sessionA)).rejects.toBeInstanceOf(BoxLabelError);
    failureTable = 'order_status_history';
    await expect(prepareBoxLabel(orderId, sessionA)).rejects.toMatchObject({ status: 503 });
    expect(inserts).toHaveLength(0);
  });
});
