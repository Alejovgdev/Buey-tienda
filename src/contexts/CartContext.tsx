'use client';

// Fase 3 del MVP (sección 6/7 del documento). El carrito es estado de cliente
// puro: React Context + localStorage. Solo cachea variantId/quantity y algunos
// campos de display (nombre, precio, imagen, stock, alérgenos) para pintar
// rápido sin ir a la base de datos — nunca es la fuente de verdad de precios,
// stock ni promociones. Eso lo recalcula el backend en la Fase 4.
//
// Se monta en el layout raíz (src/app/layout.tsx), no en un layout propio de
// /tienda, porque el badge del Navbar necesita leer el carrito y el Navbar
// vive fuera de cualquier layout específico de la tienda. No tiene efecto
// visual en el resto del sitio: solo aporta estado, no renderiza nada por sí
// mismo hasta que algo lo consume (mismo patrón que ConsentContext).

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { CartContextValue, CartItem, CartItemInput } from '@/types/cart';

const STORAGE_KEY = 'ebm_cart_v1';

function clampQuantity(quantity: number, stock: number): number {
  const upperBound = stock > 0 ? stock : quantity;
  return Math.min(Math.max(quantity, 1), upperBound);
}

function readStorage(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const data = JSON.parse(raw);
    return Array.isArray(data) ? (data as CartItem[]) : [];
  } catch {
    return [];
  }
}

function writeStorage(items: CartItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // localStorage puede fallar en modo privado o si está lleno — el carrito
    // sigue funcionando en memoria durante la sesión, solo no persiste.
  }
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    setItems(readStorage());
    setIsLoaded(true);
  }, []);

  const addItem = useCallback((input: CartItemInput, quantity = 1) => {
    setItems((current) => {
      const existing = current.find((line) => line.variantId === input.variantId);
      let next: CartItem[];

      if (existing) {
        next = current.map((line) =>
          line.variantId === input.variantId
            ? { ...input, quantity: clampQuantity(line.quantity + quantity, input.stock) }
            : line
        );
      } else {
        next = [...current, { ...input, quantity: clampQuantity(quantity, input.stock) }];
      }

      writeStorage(next);
      return next;
    });
  }, []);

  const removeItem = useCallback((variantId: string) => {
    setItems((current) => {
      const next = current.filter((line) => line.variantId !== variantId);
      writeStorage(next);
      return next;
    });
  }, []);

  const updateQuantity = useCallback((variantId: string, quantity: number) => {
    setItems((current) => {
      const next = current.map((line) =>
        line.variantId === variantId
          ? { ...line, quantity: clampQuantity(quantity, line.stock) }
          : line
      );
      writeStorage(next);
      return next;
    });
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    writeStorage([]);
  }, []);

  const totalQuantity = useMemo(
    () => items.reduce((sum, line) => sum + line.quantity, 0),
    [items]
  );

  return (
    <CartContext.Provider
      value={{ items, isLoaded, totalQuantity, addItem, removeItem, updateQuantity, clearCart }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart(): CartContextValue {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within a CartProvider');
  return ctx;
}
