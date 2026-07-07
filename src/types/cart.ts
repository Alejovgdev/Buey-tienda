export interface CartItem {
  variantId: string;
  quantity: number;
  productSlug: string;
  productName: string;
  variantName: string;
  /** Céntimos, cacheado solo para pintar — el backend recalcula precios reales en la Fase 4. */
  unitPrice: number;
  imageUrl: string | null;
  /** Cacheado en el momento de añadir; solo se usa como tope informativo en la UI. */
  stock: number;
  /** Cacheado en el momento de añadir; se usa para el aviso agregado de alérgenos del carrito. */
  allergens: string[];
}

export type CartItemInput = Omit<CartItem, 'quantity'>;

export interface CartContextValue {
  items: CartItem[];
  isLoaded: boolean;
  totalQuantity: number;
  addItem: (item: CartItemInput, quantity?: number) => void;
  removeItem: (variantId: string) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  clearCart: () => void;
}

/** Respuesta de GET /api/tienda/promocion-activa — nunca incluye campos internos de promotions. */
export type PromotionAvailability =
  | { available: false }
  | { available: true; minSubtotal: number | null; giftName: string };
