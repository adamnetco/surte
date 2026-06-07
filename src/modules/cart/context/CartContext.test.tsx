import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";

// Mock dependencies BEFORE importing the context.
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: vi.fn(() => ({ then: (cb: any) => cb({ error: null }) })),
    from: vi.fn(() => ({
      select: () => ({ in: () => Promise.resolve({ data: [] }) }),
    })),
  },
}));

vi.mock("@/modules/auth/context/AuthContext", () => ({
  useAuth: () => ({ user: null }),
}));

vi.mock("@/modules/cart/lib/cartToken", () => {
  let token = "test-token-1";
  return {
    getCartToken: () => token,
    setCartToken: (t: string) => { token = t; },
    resetCartToken: () => { token = "test-token-2"; return token; },
  };
});

import { CartProvider, useCart } from "./CartContext";

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <CartProvider>{children}</CartProvider>
);

const makeProduct = (id: string, price = 1000) =>
  ({ id, name: `Product ${id}`, price, image_url: null } as any);

describe("CartContext", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("starts empty with totals at zero", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    expect(result.current.items).toEqual([]);
    expect(result.current.totalItems).toBe(0);
    expect(result.current.totalPrice).toBe(0);
  });

  it("addItem adds and merges quantities for same product", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    const p = makeProduct("a", 500);
    act(() => result.current.addItem(p, 2));
    act(() => result.current.addItem(p, 3));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].quantity).toBe(5);
    expect(result.current.totalItems).toBe(5);
    expect(result.current.totalPrice).toBe(2500);
  });

  it("updateQuantity changes line and removes when <= 0", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    const p = makeProduct("a", 100);
    act(() => result.current.addItem(p, 1));
    act(() => result.current.updateQuantity("a", 4));
    expect(result.current.items[0].quantity).toBe(4);
    act(() => result.current.updateQuantity("a", 0));
    expect(result.current.items).toHaveLength(0);
  });

  it("removeItem removes the matching line", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addItem(makeProduct("a"), 1));
    act(() => result.current.addItem(makeProduct("b"), 2));
    act(() => result.current.removeItem("a"));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].product.id).toBe("b");
  });

  it("clearCart empties items and rotates cartToken", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addItem(makeProduct("a"), 1));
    const initialToken = result.current.cartToken;
    act(() => result.current.clearCart());
    expect(result.current.items).toEqual([]);
    expect(result.current.cartToken).not.toBe(initialToken);
  });

  it("persists items to localStorage", () => {
    const { result } = renderHook(() => useCart(), { wrapper });
    act(() => result.current.addItem(makeProduct("a", 200), 2));
    const raw = localStorage.getItem("surteya_cart");
    expect(raw).toBeTruthy();
    const parsed = JSON.parse(raw!);
    expect(parsed.items).toHaveLength(1);
    expect(parsed.items[0].quantity).toBe(2);
  });
});
