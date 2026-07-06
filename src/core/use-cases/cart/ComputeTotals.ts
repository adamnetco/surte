/**
 * ComputeTotals — Fuente única de verdad para totalizar un carrito.
 *
 * Usado por: CartContext (web), POS Workspace (futuro), payload WhatsApp,
 * facturación DIAN. Cualquier divergencia entre pantalla, factura y
 * mensajería debe corregirse aquí, no en cada consumidor.
 *
 * Fase 1 · Aislamiento del Dominio.
 */
import type { Cart, CartLine } from "@/core/domain/entities/Cart";
import {
  type Money,
  add,
  money,
  multiply,
  zero,
} from "@/core/domain/value-objects/Money";
import {
  type Discount,
  NO_DISCOUNT,
  applyDiscount,
  discountAmount,
} from "@/core/domain/value-objects/Discount";
import { extractTax, NO_TAX } from "@/core/domain/value-objects/Tax";

export interface CartTotals {
  readonly subtotal: Money;
  readonly discount: Money;
  readonly tax: Money;
  readonly total: Money;
  readonly totalItems: number;
}

export const lineTotal = (line: CartLine, currency = "COP" as const): Money =>
  multiply(money(line.unitPrice, currency), line.quantity);

export interface ComputeTotalsInput {
  readonly cart: Cart;
  readonly discount?: Discount;
}

export const computeTotals = ({
  cart,
  discount = NO_DISCOUNT,
}: ComputeTotalsInput): CartTotals => {
  const currency = cart.currency;

  const subtotal = cart.lines.reduce<Money>(
    (acc, line) => add(acc, lineTotal(line, currency)),
    zero(currency),
  );

  const totalItems = cart.lines.reduce<number>((acc, l) => acc + l.quantity, 0);

  const totalAfterDiscount = applyDiscount(subtotal, discount);

  const tax = cart.lines.reduce<Money>((acc, line) => {
    const rule = line.tax ?? NO_TAX;
    return add(acc, extractTax(lineTotal(line, currency), rule));
  }, zero(currency));

  return {
    subtotal,
    discount: discountAmount(subtotal, discount),
    tax,
    total: totalAfterDiscount,
    totalItems,
  };
};
