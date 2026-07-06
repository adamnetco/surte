/**
 * useCartStore — Zustand in-memory cart store (Phase 3).
 *
 * Objetivo: reactividad instantánea "tipo escritorio" para el POS y el
 * ecommerce. Todas las mutaciones se reflejan en memoria en <16ms; la
 * persistencia remota (Supabase) y el localStorage viven fuera del store,
 * orquestados por `CartProvider`.
 *
 * Este store NO conoce React, Supabase ni ninguna API externa:
 * consume `computeTotals` del core y expone acciones puras.
 */
import { create } from "zustand";
import type { Tables } from "@/integrations/supabase/types";
import { computeTotals } from "@/core/use-cases/cart/ComputeTotals";

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

const lineKey = (productId: string, presentationId?: string) =>
  presentationId ? `${productId}__${presentationId}` : productId;

const getLineKey = (item: CartItem) => lineKey(item.product.id, item.presentationId);

interface CartState {
  items: CartItem[];
  isDrawerOpen: boolean;

  // actions
  setItems: (items: CartItem[]) => void;
  addItem: (
    product: Product,
    quantity: number,
    unitPrice: number,
    presentation?: { id: string; name: string },
    modifiers?: CartModifier[],
    modifierTotal?: number,
  ) => void;
  removeItem: (productId: string, presentationId?: string) => void;
  updateQuantity: (productId: string, quantity: number, presentationId?: string) => void;
  clearCart: () => void;
  setDrawerOpen: (open: boolean) => void;
}

export const useCartStore = create<CartState>((set) => ({
  items: [],
  isDrawerOpen: false,

  setItems: (items) => set({ items }),

  addItem: (product, quantity, unitPrice, presentation, modifiers, modifierTotal) =>
    set((state) => {
      const key = lineKey(product.id, presentation?.id);
      // Con modificadores => cada agregado es una línea nueva (variantes distintas).
      if (modifiers && modifiers.length > 0) {
        return {
          items: [
            ...state.items,
            {
              product,
              quantity,
              unitPrice: unitPrice + (modifierTotal || 0),
              presentationId: presentation?.id,
              presentationName: presentation?.name,
              modifiers,
              modifierTotal: modifierTotal || 0,
            },
          ],
        };
      }
      const existing = state.items.find(
        (i) => getLineKey(i) === key && (!i.modifiers || i.modifiers.length === 0),
      );
      if (existing) {
        return {
          items: state.items.map((i) =>
            getLineKey(i) === key && (!i.modifiers || i.modifiers.length === 0)
              ? { ...i, quantity: i.quantity + quantity, unitPrice }
              : i,
          ),
        };
      }
      return {
        items: [
          ...state.items,
          {
            product,
            quantity,
            unitPrice,
            presentationId: presentation?.id,
            presentationName: presentation?.name,
          },
        ],
      };
    }),

  removeItem: (productId, presentationId) =>
    set((state) => {
      const key = lineKey(productId, presentationId);
      return { items: state.items.filter((i) => getLineKey(i) !== key) };
    }),

  updateQuantity: (productId, quantity, presentationId) =>
    set((state) => {
      const key = lineKey(productId, presentationId);
      if (quantity <= 0) {
        return { items: state.items.filter((i) => getLineKey(i) !== key) };
      }
      return {
        items: state.items.map((i) =>
          getLineKey(i) === key ? { ...i, quantity } : i,
        ),
      };
    }),

  clearCart: () => set({ items: [] }),

  setDrawerOpen: (open) => set({ isDrawerOpen: open }),
}));

/**
 * Selector helper: totales calculados vía `computeTotals` (core).
 * Uso en componentes:
 *   const { totalItems, totalPrice } = useCartTotals();
 */
export function selectCartTotals(items: CartItem[]) {
  const totals = computeTotals({
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
  });
  return {
    totalItems: totals.totalItems,
    totalPrice: totals.total.amount,
    subtotal: totals.subtotal.amount,
  };
}
