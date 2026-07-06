/**
 * Discount — Value Object inmutable para descuentos aplicables al carrito.
 * Fase 1 · Aislamiento del Dominio.
 */
import { type Money, money, multiply, subtract } from "./Money";

export type DiscountKind = "PERCENT" | "FIXED" | "NONE";

export interface Discount {
  readonly kind: DiscountKind;
  /** Para PERCENT: 0-100. Para FIXED: monto en la moneda del carrito. */
  readonly value: number;
}

export const NO_DISCOUNT: Discount = { kind: "NONE", value: 0 };

export const percent = (pct: number): Discount => ({
  kind: "PERCENT",
  value: Math.max(0, Math.min(100, pct)),
});

export const fixed = (amount: number): Discount => ({
  kind: "FIXED",
  value: Math.max(0, amount),
});

/** Calcula el monto de descuento que se resta al subtotal. */
export const discountAmount = (subtotal: Money, d: Discount): Money => {
  if (d.kind === "NONE" || d.value <= 0) return money(0, subtotal.currency);
  if (d.kind === "PERCENT") return multiply(subtotal, d.value / 100);
  const capped = Math.min(d.value, subtotal.amount);
  return money(capped, subtotal.currency);
};

export const applyDiscount = (subtotal: Money, d: Discount): Money =>
  subtract(subtotal, discountAmount(subtotal, d));
