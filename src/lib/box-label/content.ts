import { getMetadataString } from '@/lib/admin/incidents';
import type { Json } from '@/supabase/types';
import { boxLabelSnapshotSchema, type BoxLabelGift, type BoxLabelSnapshot } from './schema';

export interface BoxLabelItem {
  id: string;
  product_variant_id: string | null;
  product_name_snapshot: string;
  variant_name_snapshot: string;
  quantity: number;
  item_type: string;
}

export interface GiftIncident { event_type: string; metadata: Json | null }

// No consulta el catálogo ni decide que una promesa de regalo equivale a
// contenido embalado. El caso SIN_STOCK ya existente requiere selección
// explícita del trabajador; los demás regalos se incluyen por defecto.
export function getBoxLabelGifts(items: BoxLabelItem[], history: GiftIncident[]): BoxLabelGift[] {
  return items.filter((item) => item.item_type === 'GIFT').map((item) => {
    const pendingStock = history.some((event) =>
      event.event_type === 'PROMOCION_NO_APLICADA' &&
      getMetadataString(event.metadata, 'reason') === 'SIN_STOCK_REGALO_EN_CONFIRMACION' &&
      (!getMetadataString(event.metadata, 'gift_variant_id') ||
        getMetadataString(event.metadata, 'gift_variant_id') === item.product_variant_id)
    );
    return {
      id: item.id, productName: item.product_name_snapshot, variantName: item.variant_name_snapshot,
      quantity: item.quantity, isGift: true, pendingStock, included: !pendingStock,
    };
  });
}

export function buildBoxLabelSnapshot(
  orderNumber: string, workerName: string, logoDataUrl: string,
  items: BoxLabelItem[], includedGiftIds: string[]
): BoxLabelSnapshot {
  const gifts = new Set(items.filter((item) => item.item_type === 'GIFT').map((item) => item.id));
  if (new Set(includedGiftIds).size !== includedGiftIds.length || includedGiftIds.some((id) => !gifts.has(id))) {
    throw new Error('La selección de regalos no corresponde al pedido');
  }
  if (items.some((item) => item.item_type !== 'PRODUCT' && item.item_type !== 'GIFT')) {
    throw new Error('El pedido contiene un tipo de línea no reconocido');
  }
  return boxLabelSnapshotSchema.parse({
    version: 1, orderNumber, preparedBy: workerName, logoDataUrl,
    lines: items.filter((item) => item.item_type === 'PRODUCT' || includedGiftIds.includes(item.id)).map((item) => ({
      id: item.id, productName: item.product_name_snapshot, variantName: item.variant_name_snapshot,
      quantity: item.quantity, isGift: item.item_type === 'GIFT',
    })),
  });
}
