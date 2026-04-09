import React, { createContext, useContext, useState, useCallback } from "react";
import type { Tables } from "@/integrations/supabase/types";

type Product = Tables<"products">;

export interface CartItem {
  product: Product;
  quantity: number;
  /** The resolved price per unit (accounts for user tier or presentation) */
  unitPrice: number;
  /** Optional presentation info */
  presentationId?: string;
  presentationName?: string;
}

interface CartContextType {
  items: CartItem[];
  addItem: (product: Product, quantity?: number, unitPrice?: number, presentation?: { id: string; name: string }) => void;
  removeItem: (productId: string, presentationId?: string) => void;
  updateQuantity: (productId: string, quantity: number, presentationId?: string) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  isDrawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

/** Unique key for a cart line */
const lineKey = (productId: string, presentationId?: string) =>
  presentationId ? `${productId}__${presentationId}` : productId;

const getLineKey = (item: CartItem) => lineKey(item.product.id, item.presentationId);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isDrawerOpen, setDrawerOpen] = useState(false);

  const addItem = useCallback((product: Product, quantity = 1, unitPrice?: number, presentation?: { id: string; name: string }) => {
    const price = unitPrice ?? product.price;
    const key = lineKey(product.id, presentation?.id);
    setItems((prev) => {
      const existing = prev.find((i) => getLineKey(i) === key);
      if (existing) {
        return prev.map((i) =>
          getLineKey(i) === key
            ? { ...i, quantity: i.quantity + quantity, unitPrice: price }
            : i
        );
      }
      return [...prev, {
        product,
        quantity,
        unitPrice: price,
        presentationId: presentation?.id,
        presentationName: presentation?.name,
      }];
    });
    setDrawerOpen(true);
  }, []);

  const removeItem = useCallback((productId: string, presentationId?: string) => {
    const key = lineKey(productId, presentationId);
    setItems((prev) => prev.filter((i) => getLineKey(i) !== key));
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number, presentationId?: string) => {
    const key = lineKey(productId, presentationId);
    if (quantity <= 0) {
      setItems((prev) => prev.filter((i) => getLineKey(i) !== key));
      return;
    }
    setItems((prev) =>
      prev.map((i) => (getLineKey(i) === key ? { ...i, quantity } : i))
    );
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, totalItems, totalPrice, isDrawerOpen, setDrawerOpen }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
};
