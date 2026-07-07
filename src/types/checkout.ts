export interface RedsysRedirectPayload {
  actionUrl: string;
  Ds_SignatureVersion: string;
  Ds_MerchantParameters: string;
  Ds_Signature: string;
}

export interface CreateSessionSuccess {
  orderNumber: string;
  totalAmount: number;
  redsys: RedsysRedirectPayload;
}

export interface StockIssueItem {
  variantId: string | null;
  productName: string;
  variantName: string;
  requestedQuantity: number;
  availableStock: number;
  isGift: boolean;
}

export type CreateSessionError =
  | { error: 'CHECKOUT_DESHABILITADO'; message: string }
  | { error: 'DATOS_INVALIDOS'; message: string; fieldErrors?: Record<string, string[]> }
  | { error: 'STOCK_INSUFICIENTE'; message: string; items: StockIssueItem[] }
  | { error: 'ERROR_INTERNO'; message: string };

// Endpoint no autenticado y consultado por order_number (adivinable/enumerable) -
// solo lo estrictamente necesario para pintar el estado. Nunca PII, direccion,
// productos, importes ni ids internos (id de fila, redsys_ds_order, etc.).
export interface OrderStatusResponse {
  orderNumber: string;
  status: string;
}
