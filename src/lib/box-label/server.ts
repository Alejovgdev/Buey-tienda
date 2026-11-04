import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { supabaseAdmin } from '@/lib/supabase-admin';
import type { AdminSessionClaims } from '@/lib/admin-auth';
import type { Tables } from '@/supabase/types';
import { buildBoxLabelSnapshot, getBoxLabelGifts, type BoxLabelItem, type GiftIncident } from './content';
import { signBoxLabelDraft } from './draft';
import { boxLabelSnapshotSchema, canPrepareBoxLabel, MAX_BOX_LABEL_DRAFT_LENGTH, type BoxLabelPreview } from './schema';

export class BoxLabelError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

let logo: Promise<string> | undefined;
function getLogo() {
  logo ??= readFile(path.join(process.cwd(), 'public/assets/images/logo-buey-thermal.png'))
    .then((bytes) => `data:image/png;base64,${bytes.toString('base64')}`);
  return logo;
}

async function loadBoxLabelItems(orderId: string) {
  const items: BoxLabelItem[] = [];
  // PostgREST limita las filas por respuesta. Paginar evita perder líneas
  // silenciosamente incluso en pedidos mayores que ese límite.
  const pageSize = 500;
  for (let offset = 0; ; offset += pageSize) {
    const { data, error } = await supabaseAdmin.from('order_items')
      .select('id, product_variant_id, product_name_snapshot, variant_name_snapshot, quantity, item_type')
      .eq('order_id', orderId).order('id').range(offset, offset + pageSize - 1).returns<BoxLabelItem[]>();
    if (error || !data) throw new BoxLabelError('No se pudieron cargar las líneas del pedido', 503);
    items.push(...data);
    if (data.length < pageSize) return items;
  }
}

export async function prepareBoxLabel(
  orderId: string, session: AdminSessionClaims, includedGiftIds?: string[]
): Promise<BoxLabelPreview> {
  const { data: order, error: orderError } = await supabaseAdmin.from('orders')
    .select('id, order_number, status').eq('id', orderId)
    .maybeSingle<{ id: string; order_number: string; status: string }>();
  if (orderError) throw new BoxLabelError('No se pudo consultar el pedido', 503);
  if (!order) throw new BoxLabelError('Pedido no encontrado', 404);

  const { data: saved, error: savedError } = await supabaseAdmin.from('order_box_labels')
    .select('snapshot, confirmed_at').eq('order_id', orderId)
    .maybeSingle<Pick<Tables<'order_box_labels'>, 'snapshot' | 'confirmed_at'>>();
  if (savedError) throw new BoxLabelError('No se pudo consultar la etiqueta de caja. Comprueba su migración.', 503);
  if (saved) {
    return { snapshot: boxLabelSnapshotSchema.parse(saved.snapshot), confirmedAt: saved.confirmed_at, draftToken: null, gifts: [] };
  }
  if (!canPrepareBoxLabel(order.status)) throw new BoxLabelError('Este pedido no está disponible para preparación', 409);

  const [items, { data: history, error: historyError }] = await Promise.all([
    loadBoxLabelItems(orderId),
    supabaseAdmin.from('order_status_history').select('event_type, metadata').eq('order_id', orderId)
      .eq('event_type', 'PROMOCION_NO_APLICADA').returns<GiftIncident[]>(),
  ]);
  if (historyError) throw new BoxLabelError('No se pudo cargar el contenido del pedido', 503);
  const gifts = getBoxLabelGifts(items, history ?? []);
  const selection = includedGiftIds ?? gifts.filter((gift) => gift.included).map((gift) => gift.id);
  let snapshot;
  try {
    snapshot = buildBoxLabelSnapshot(order.order_number, session.workerName, await getLogo(), items, selection);
  } catch {
    throw new BoxLabelError('Revisa las líneas y la selección de regalos: no se pudo preparar el contenido', 400);
  }
  const draftToken = await signBoxLabelDraft(orderId, snapshot, session);
  if (draftToken.length > MAX_BOX_LABEL_DRAFT_LENGTH) {
    throw new BoxLabelError('El contenido supera el tamaño admitido para confirmar la impresión. No se ha omitido ninguna línea.', 400);
  }
  return {
    snapshot, draftToken, confirmedAt: null,
    gifts: gifts.map((gift) => ({ ...gift, included: selection.includes(gift.id) })),
  };
}
