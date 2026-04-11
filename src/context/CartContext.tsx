import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import type { Tables } from "@/integrations/supabase/types";

type Product = Tables<"products">;

export interface CartModifier {
  groupId: string;
  groupName: string;
  optionId: string;
  displayName: string;
  linkedProductId: string | null;
  linkedProductName: string | null;
  priceAdjustment: number;
  quantity: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  presentationId?: string;
  presentationName?: string;
  modifiers?: CartModifier[];
  modifierTotal?: number;
}

interface CartContextType {
  items: CartItem[];
  addItem: (product: Product, quantity?: number, unitPrice?: number, presentation?: { id: string; name: string }, modifiers?: CartModifier[], modifierTotal?: number) => void;
  removeItem: (productId: string, presentationId?: string) => void;
  updateQuantity: (productId: string, quantity: number, presentationId?: string) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  isDrawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const STORAGE_KEY = "surteya_cart";
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

/** Unique key for a cart line */
const lineKey = (productId: string, presentationId?: string) =>
  presentationId ? `${productId}__${presentationId}` : productId;

const getLineKey = (item: CartItem) => lineKey(item.product.id, item.presentationId);

/* ── persistence helpers ── */
function saveCart(items: CartItem[]) {
  try {
    const payload = { items, ts: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch { /* quota exceeded – ignore */ }
}

function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const { items, ts } = JSON.parse(raw) as { items: CartItem[]; ts: number };
    if (Date.now() - ts > TTL_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return [];
    }
    return items ?? [];
  } catch {
    return [];
  }
}

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>(() => loadCart());
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const itemsRef = useRef(items);
  itemsRef.current = items;

  // Persist whenever items change
  useEffect(() => {
    saveCart(items);
  }, [items]);

  // Warn before leaving the page when cart has items
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (itemsRef.current.length > 0) {
        e.preventDefault();
        // Most browsers show a generic message; setting returnValue is required
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const addItem = useCallback((product: Product, quantity = 1, unitPrice?: number, presentation?: { id: string; name: string }, modifiers?: CartModifier[], modifierTotal?: number) => {
    const price = unitPrice ?? product.price;
    const key = lineKey(product.id, presentation?.id);
    setItems((prev) => {
      // If modifiers are present, always add as new line (modifiers make each line unique)
      if (modifiers && modifiers.length > 0) {
        return [...prev, {
          product,
          quantity,
          unitPrice: price + (modifierTotal || 0),
          presentationId: presentation?.id,
          presentationName: presentation?.name,
          modifiers,
          modifierTotal: modifierTotal || 0,
        }];
      }
      const existing = prev.find((i) => getLineKey(i) === key && (!i.modifiers || i.modifiers.length === 0));
      if (existing) {
        return prev.map((i) =>
          getLineKey(i) === key && (!i.modifiers || i.modifiers.length === 0)
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

  const clearCart = useCallback(() => {
    setItems([]);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

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
