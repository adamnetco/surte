/**
 * CartContext — Phase 3 bridge.
 *
 * El estado del carrito ahora vive en `useCartStore` (Zustand) para
 * reactividad instantánea. Este Provider mantiene la MISMA API pública
 * (`useCart()`), y orquesta los efectos secundarios que no pertenecen
 * al dominio: localStorage, sync a Supabase (via adapter), warn-on-leave
 * e hidratación desde `persistent_carts`.
 */
import React, { createContext, useContext, useCallback, useEffect, useRef } from "react";
import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { getCartToken, resetCartToken, setCartToken } from "@/modules/cart/lib/cartToken";
import { supabaseCartRepository } from "@/infrastructure/database/SupabaseCartRepository";
import {
  useCartStore,
  selectCartTotals,
  type CartItem,
  type CartModifier,
} from "@/presentation/store/useCartStore";

type Product = Tables<"products">;

export type { CartItem, CartModifier };

interface AddItemOptions {
  openDrawer?: boolean;
}

interface CartContextType {
  items: CartItem[];
  cartToken: string;
  addItem: (
    product: Product,
    quantity?: number,
    unitPrice?: number,
    presentation?: { id: string; name: string },
    modifiers?: CartModifier[],
    modifierTotal?: number,
    options?: AddItemOptions,
  ) => void;
  removeItem: (productId: string, presentationId?: string) => void;
  updateQuantity: (productId: string, quantity: number, presentationId?: string) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  isDrawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  hydrateFromRemote: (token: string) => Promise<boolean>;
  attachPhone: (phone: string) => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

const STORAGE_KEY = "tenant_cart";
const LEGACY_STORAGE_KEY = "surteya_cart";
const TTL_MS = 24 * 60 * 60 * 1000;

function saveCart(items: CartItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ items, ts: Date.now() }));
  } catch { /* quota exceeded – ignore */ }
}

function loadCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? localStorage.getItem(LEGACY_STORAGE_KEY);
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
  const { user } = useAuth();

  // Store selectors
  const items = useCartStore((s) => s.items);
  const isDrawerOpen = useCartStore((s) => s.isDrawerOpen);
  const setItemsStore = useCartStore((s) => s.setItems);
  const addItemStore = useCartStore((s) => s.addItem);
  const removeItemStore = useCartStore((s) => s.removeItem);
  const updateQuantityStore = useCartStore((s) => s.updateQuantity);
  const clearCartStore = useCartStore((s) => s.clearCart);
  const setDrawerOpenStore = useCartStore((s) => s.setDrawerOpen);

  const [cartToken, setCartTokenState] = React.useState<string>(() => getCartToken());
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const phoneRef = useRef<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const syncTimer = useRef<number | null>(null);
  const isHydratingRef = useRef(false);
  const didHydrateLocalRef = useRef(false);

  // Hydrate store from localStorage once on mount.
  useEffect(() => {
    if (didHydrateLocalRef.current) return;
    didHydrateLocalRef.current = true;
    const saved = loadCart();
    if (saved.length > 0) setItemsStore(saved);
  }, [setItemsStore]);

  useEffect(() => {
    userIdRef.current = user?.id ?? null;
  }, [user]);

  // Persist to localStorage whenever items change.
  useEffect(() => {
    saveCart(items);
  }, [items]);

  // Debounced remote sync via SupabaseCartRepository adapter.
  useEffect(() => {
    if (isHydratingRef.current) return;
    if (items.length === 0 && !phoneRef.current && !userIdRef.current) return;
    if (syncTimer.current) window.clearTimeout(syncTimer.current);
    syncTimer.current = window.setTimeout(() => {
      const { totalItems, subtotal } = selectCartTotals(items);
      supabaseCartRepository
        .persist({
          cartToken,
          cart: {
            currency: "COP",
            lines: items.map((i) => ({
              productId: i.product.id,
              name: i.product.name,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              presentationId: i.presentationId ?? null,
            })),
          },
          subtotal,
          totalItems,
          phone: phoneRef.current,
          userId: userIdRef.current,
          channel: "web",
          metadata: {},
        })
        .then(({ error }) => {
          if (error) console.warn("[cart-sync]", error.message);
        });
    }, 800);
    return () => {
      if (syncTimer.current) window.clearTimeout(syncTimer.current);
    };
  }, [items, cartToken]);

  // Warn before leaving with items in cart.
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (itemsRef.current.length > 0) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, []);

  const addItem: CartContextType["addItem"] = useCallback(
    (product, quantity = 1, unitPrice, presentation, modifiers, modifierTotal, options) => {
      const price = unitPrice ?? product.price;
      addItemStore(product, quantity, price, presentation, modifiers, modifierTotal);
      if (options?.openDrawer !== false) setDrawerOpenStore(true);
    },
    [addItemStore, setDrawerOpenStore],
  );

  const removeItem = useCallback(
    (productId: string, presentationId?: string) => removeItemStore(productId, presentationId),
    [removeItemStore],
  );

  const updateQuantity = useCallback(
    (productId: string, quantity: number, presentationId?: string) =>
      updateQuantityStore(productId, quantity, presentationId),
    [updateQuantityStore],
  );

  const clearCart = useCallback(() => {
    clearCartStore();
    localStorage.removeItem(STORAGE_KEY);
    const next = resetCartToken();
    setCartTokenState(next);
  }, [clearCartStore]);

  const attachPhone = useCallback((phone: string) => {
    const digits = (phone || "").replace(/\D/g, "");
    phoneRef.current = digits || null;
  }, []);

  const hydrateFromRemote = useCallback(
    async (token: string): Promise<boolean> => {
      if (!token) return false;
      isHydratingRef.current = true;
      try {
        const { data, error } = await supabase.rpc("get_persistent_cart", { _cart_token: token });
        if (error || !data || data.length === 0) return false;
        const remote = data[0] as any;
        const remoteItems = Array.isArray(remote.items) ? remote.items : [];
        if (remoteItems.length === 0) return false;

        const ids = Array.from(new Set(remoteItems.map((i: any) => i.product_id))).filter(Boolean);
        const { data: prods } = await supabase
          .from("products")
          .select("*")
          .in("id", ids as string[]);
        const prodMap = new Map((prods || []).map((p: any) => [p.id, p]));

        const rebuilt: CartItem[] = remoteItems
          .map((it: any) => {
            const p = prodMap.get(it.product_id);
            if (!p) return null;
            return {
              product: p as Product,
              quantity: Number(it.quantity) || 1,
              unitPrice: Number(it.unit_price) || Number((p as any).price),
              presentationId: it.presentation_id || undefined,
              presentationName: it.presentation_name || undefined,
              modifiers: it.modifiers || undefined,
            } as CartItem;
          })
          .filter(Boolean) as CartItem[];

        setCartToken(token);
        setCartTokenState(token);
        setItemsStore(rebuilt);
        if (remote.phone) phoneRef.current = remote.phone;
        return true;
      } finally {
        setTimeout(() => { isHydratingRef.current = false; }, 100);
      }
    },
    [setItemsStore],
  );

  const { totalItems, totalPrice } = selectCartTotals(items);

  return (
    <CartContext.Provider
      value={{
        items,
        cartToken,
        addItem,
        removeItem,
        updateQuantity,
        clearCart,
        totalItems,
        totalPrice,
        isDrawerOpen,
        setDrawerOpen: setDrawerOpenStore,
        hydrateFromRemote,
        attachPhone,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
};
