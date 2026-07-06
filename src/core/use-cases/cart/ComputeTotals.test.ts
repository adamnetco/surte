import { describe, it, expect } from "vitest";
import { computeTotals, lineTotal } from "./ComputeTotals";
import type { Cart } from "@/core/domain/entities/Cart";
import { percent, fixed } from "@/core/domain/value-objects/Discount";
import { IVA_19, INC_8 } from "@/core/domain/value-objects/Tax";

const line = (unitPrice: number, quantity: number, tax = undefined as any) => ({
  productId: `p-${unitPrice}`,
  name: "P",
  unitPrice,
  quantity,
  tax,
});

describe("computeTotals · Money COP", () => {
  it("carrito vacío retorna cero", () => {
    const cart: Cart = { currency: "COP", lines: [] };
    const t = computeTotals({ cart });
    expect(t.subtotal.amount).toBe(0);
    expect(t.total.amount).toBe(0);
    expect(t.totalItems).toBe(0);
  });

  it("suma líneas y respeta redondeo entero COP", () => {
    const cart: Cart = {
      currency: "COP",
      lines: [line(1500, 2), line(3499, 1)],
    };
    const t = computeTotals({ cart });
    expect(t.subtotal.amount).toBe(6499);
    expect(t.total.amount).toBe(6499);
    expect(t.totalItems).toBe(3);
  });

  it("aplica descuento porcentual y clampa al subtotal en fijo", () => {
    const cart: Cart = { currency: "COP", lines: [line(10_000, 1)] };
    expect(computeTotals({ cart, discount: percent(10) }).total.amount).toBe(9_000);
    expect(computeTotals({ cart, discount: fixed(50_000) }).total.amount).toBe(0);
  });

  it("extrae IVA 19 % incluido en el precio", () => {
    const cart: Cart = { currency: "COP", lines: [line(11_900, 1, IVA_19)] };
    const t = computeTotals({ cart });
    // 11900 * 19/119 = 1900
    expect(t.tax.amount).toBe(1900);
    expect(t.subtotal.amount).toBe(11_900);
  });

  it("extrae INC 8 % en múltiples líneas", () => {
    const cart: Cart = {
      currency: "COP",
      lines: [line(10_800, 1, INC_8), line(21_600, 2, INC_8)],
    };
    const t = computeTotals({ cart });
    // 10800*8/108 = 800; 43200*8/108 = 3200 → 4000
    expect(t.tax.amount).toBe(4000);
  });

  it("lineTotal es puro", () => {
    expect(lineTotal(line(2500, 3)).amount).toBe(7500);
  });
});
