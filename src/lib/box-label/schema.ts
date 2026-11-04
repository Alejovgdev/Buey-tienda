import { z } from 'zod';

export const boxLabelSnapshotSchema = z.object({
  version: z.literal(1),
  orderNumber: z.string().trim().min(1),
  preparedBy: z.string().trim().min(1).max(80),
  // Se guarda también el logo: las reimpresiones no dependen de Cloudinary
  // ni de que un despliegue posterior sustituya el recurso de la marca.
  logoDataUrl: z.string().regex(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/),
  lines: z.array(z.object({
    id: z.string().uuid(),
    productName: z.string().min(1),
    variantName: z.string(),
    quantity: z.number().int().positive(),
    isGift: z.boolean(),
  }).strict()).min(1),
}).strict();

export type BoxLabelSnapshot = z.infer<typeof boxLabelSnapshotSchema>;
export type BoxLabelLine = BoxLabelSnapshot['lines'][number];
export type BoxLabelGift = BoxLabelLine & { pendingStock: boolean; included: boolean };

export interface BoxLabelPreview {
  snapshot: BoxLabelSnapshot;
  draftToken: string | null;
  confirmedAt: string | null;
  gifts: BoxLabelGift[];
}

export const prepareBoxLabelSchema = z.object({ includedGiftIds: z.array(z.string().uuid()) }).strict();
export const MAX_BOX_LABEL_DRAFT_LENGTH = 2_000_000;
export const confirmBoxLabelSchema = z.object({ draftToken: z.string().min(1).max(MAX_BOX_LABEL_DRAFT_LENGTH) }).strict();

export function canPrepareBoxLabel(status: string): boolean {
  return status === 'PAID' || status === 'PREPARING';
}
