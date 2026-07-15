// Formato físico único de etiqueta (docs/FOOD_LABEL_ADMIN_DESIGN.md, §12).
// No es configurable por perfil a propósito — un único formato, una única
// plantilla React. Si en el futuro hace falta otro tamaño físico, es una
// decisión de producto deliberada, no una opción más del perfil.
export const LABEL_WIDTH_MM = 100;
export const LABEL_HEIGHT_MM = 70;

export const LABEL_STATUSES = ['PENDING', 'READY', 'PRINTED', 'REPRINTED', 'CANCELLED'] as const;
export type LabelStatus = (typeof LABEL_STATUSES)[number];

export const LABEL_STATUS_LABELS: Record<LabelStatus, string> = {
  PENDING: 'Pendiente',
  READY: 'Lista',
  PRINTED: 'Impresa',
  REPRINTED: 'Reimpresa',
  CANCELLED: 'Anulada',
};

export const DATE_TYPES = ['EXPIRY', 'BEST_BEFORE'] as const;
export type DateType = (typeof DATE_TYPES)[number];
