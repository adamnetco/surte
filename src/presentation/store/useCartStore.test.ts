/**
 * useCartStore — unit tests (Phase 3).
 *
 * El store es la fuente de verdad reactiva del carrito. Estos tests
 * validan comportamiento puro en memoria: sin React, sin Supabase.
 */
import { describe, it, expect, beforeEach } from "vitest";
import { useCartStore, selectCartTotals } from "./useCartStore";
import type { Tables } from "@/integrations/supabase/types";

type Product = Tables<"products">;

const mkProduct = (id: string, price: number, name = `p-${id}`): Product =>
  ({ id, price, name } as unknown as Product);

describe("useCartStore", () => {
  beforeEach(() => {
    useCartStore.setState({ items: [], isDrawerOpen: false });
  });

  it("starts empty", () => {
    expect(useCartStore.getState().items).toEqual([]);
  });

  it("addItem stacks quantity when same product + no modifiers", () => {
    const p = mkProduct("a", 1000);
    const { addItem } = useCartStore.getState();
    addItem(p, 2, 1000);
    addItem(p, 3, 1000);
    const items = useCartStore.getState().items;
    expect(items).toHaveLength(1);
    expect(items[0].quantity).toBe(5);
  });

  it("addItem creates separate lines for different presentations", () => {
    const p = mkProduct("a", 1000);
    const { addItem } = useCartStore.getState();
    addItem(p, 1, 1000, { id: "pres-1", name: "Unidad" });
    addItem(p, 1, 6000, { id: "pres-2", name: "Six-pack" });
    expect(useCartStore.getState().items).toHaveLength(2);
  });

  it("addItem with modifiers ALWAYS creates a new line", () => {
    const p = mkProduct("a", 1000);
    const { addItem } = useCartStore.getState();
    const mods = [{
      groupId: "g", groupName: "Extras", optionId: "o",
      displayName: "Queso", linkedProductId: null, linkedProductName: null,
      priceAdjustment: 500, quantity: 1,
    }];
    addItem(p, 1, 1000, undefined, mods, 500);
    addItem(p, 1, 1000, undefined, mods, 500);
    const items = useCartStore.getState().items;
    expect(items).toHaveLength(2);
    expect(items[0].unitPrice).toBe(1500); // price + modifier
  });

  it("updateQuantity removes line when qty <= 0", () => {
    const p = mkProduct("a", 1000);
    const s = useCartStore.getState();
    s.addItem(p, 2, 1000);
    s.updateQuantity("a", 0);
    expect(useCartStore.getState().items).toEqual([]);
  });

  it("clearCart empties everything", () => {
    const s = useCartStore.getState();
    s.addItem(mkProduct("a", 100), 1, 100);
    s.addItem(mkProduct("b", 200), 3, 200);
    s.clearCart();
    expect(useCartStore.getState().items).toEqual([]);
  });

  it("selectCartTotals delegates to computeTotals (COP rounded)", () => {
    const items = [
      { product: mkProduct("a", 1500), quantity: 2, unitPrice: 1500 },
      { product: mkProduct("b", 3333), quantity: 1, unitPrice: 3333 },
    ];
    const totals = selectCartTotals(items);
    expect(totals.totalItems).toBe(3);
    expect(totals.totalPrice).toBe(6333);
  });
});
