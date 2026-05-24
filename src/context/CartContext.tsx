import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from "react";
import type { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { getCartToken, resetCartToken, setCartToken } from "@/lib/cartToken";

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

interface AddItemOptions {
  openDrawer?: boolean;
}

interface CartContextType {
  items: CartItem[];
  cartToken: string;
  addItem: (product: Product, quantity?: number, unitPrice?: number, presentation?: { id: string; name: string }, modifiers?: CartModifier[], modifierTotal?: number, options?: AddItemOptions) => void;
  removeItem: (productId: string, presentationId?: string) => void;
  updateQuantity: (productId: string, quantity: number, presentationId?: string) => void;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  isDrawerOpen: boolean;
  setDrawerOpen: (open: boolean) => void;
  /** Hydrate the cart from a Supabase persistent_carts row (omnichannel return). */
  hydrateFromRemote: (token: string) => Promise<boolean>;
  /** Attach a phone number to the active cart (used after the user types one). */
  attachPhone: (phone: string) => void;
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
  const { user } = useAuth();
  const [items, setItems] = useState<CartItem[]>(() => loadCart());
  const [isDrawerOpen, setDrawerOpen] = useState(false);
  const [cartToken, setCartTokenState] = useState<string>(() => getCartToken());
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const phoneRef = useRef<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const syncTimer = useRef<number | null>(null);
  const isHydratingRef = useRef(false);

  // Track auth user_id to associate carts on login without competing auth token reads.
  useEffect(() => {
    userIdRef.current = user?.id ?? null;
  }, [user]);

  // Persist whenever items change
  useEffect(() => {
    saveCart(items);
  }, [items]);

  // Debounced remote sync to persistent_carts (skipped while hydrating)
  useEffect(() => {
    if (isHydratingRef.current) return;
    if (syncTimer.current) window.clearTimeout(syncTimer.current);
    syncTimer.current = window.setTimeout(() => {
      const payload = items.map((i) => ({
        product_id: i.product.id,
        name: i.product.name,
        quantity: i.quantity,
        unit_price: i.unitPrice,
        line_total: i.unitPrice * i.quantity,
        image_url: i.product.image_url,
        presentation_id: i.presentationId ?? null,
        presentation_name: i.presentationName ?? null,
        modifiers: i.modifiers ?? null,
      }));
      const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
      const totalItems = items.reduce((s, i) => s + i.quantity, 0);
      // Fire-and-forget — never block the UI on cart sync.
      supabase.rpc("upsert_persistent_cart", {
        _cart_token: cartToken,
        _items: payload as any,
        _subtotal: subtotal,
        _total_items: totalItems,
        _phone: phoneRef.current,
        _user_id: userIdRef.current,
        _channel: "web",
        _metadata: {} as any,
      }).then(({ error }) => {
        if (error) console.warn("[cart-sync]", error.message);
      });
    }, 800);
    return () => {
      if (syncTimer.current) window.clearTimeout(syncTimer.current);
    };
  }, [items, cartToken]);

  // Warn before leaving the page when cart has items
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

  const addItem = useCallback((product: Product, quantity = 1, unitPrice?: number, presentation?: { id: string; name: string }, modifiers?: CartModifier[], modifierTotal?: number, options?: AddItemOptions) => {
    const price = unitPrice ?? product.price;
    const key = lineKey(product.id, presentation?.id);
    setItems((prev) => {
      if (modifiers && modifiers.length > 0) {
        return [...prev, {
          product, quantity,
          unitPrice: price + (modifierTotal || 0),
          presentationId: presentation?.id, presentationName: presentation?.name,
          modifiers, modifierTotal: modifierTotal || 0,
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
        product, quantity, unitPrice: price,
        presentationId: presentation?.id, presentationName: presentation?.name,
      }];
    });
    if (options?.openDrawer !== false) setDrawerOpen(true);
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
    // Rotate the cart_token so the next cart starts fresh in Supabase
    const next = resetCartToken();
    setCartTokenState(next);
  }, []);

  const attachPhone = useCallback((phone: string) => {
    const digits = (phone || "").replace(/\D/g, "");
    phoneRef.current = digits || null;
  }, []);

  /**
   * Hydrate the in-memory cart from a remote cart_token. Used when the
   * user returns from WhatsApp (?cart=token) or logs in on another device.
   * Returns true when the remote cart is found and applied.
   */
  const hydrateFromRemote = useCallback(async (token: string): Promise<boolean> => {
    if (!token) return false;
    isHydratingRef.current = true;
    try {
      const { data, error } = await supabase.rpc("get_persistent_cart", { _cart_token: token });
      if (error || !data || data.length === 0) return false;
      const remote = data[0] as any;
      const remoteItems = Array.isArray(remote.items) ? remote.items : [];
      if (remoteItems.length === 0) return false;

      // Re-fetch the live products referenced by the remote cart so we
      // honour current price/stock and avoid stale data.
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
      setItems(rebuilt);
      if (remote.phone) phoneRef.current = remote.phone;
      return true;
    } finally {
      // Allow auto-sync again after hydration settles
      setTimeout(() => { isHydratingRef.current = false; }, 100);
    }
  }, []);

  const totalItems = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

  return (
    <CartContext.Provider value={{
      items, cartToken, addItem, removeItem, updateQuantity, clearCart,
      totalItems, totalPrice, isDrawerOpen, setDrawerOpen,
      hydrateFromRemote, attachPhone,
    }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within CartProvider");
  return ctx;
};
