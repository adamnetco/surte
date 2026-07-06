/**
 * Cart / CartLine — Entidades de dominio agnósticas de UI y persistencia.
 * Fase 1 · Aislamiento del Dominio.
 */
import type { CurrencyCode } from "../value-objects/Money";
import type { TaxRule } from "../value-objects/Tax";

export interface CartLine {
  readonly productId: string;
  readonly name: string;
  readonly quantity: number;
  /** Precio unitario en la moneda del carrito (bruto, tal como se cobra al cliente). */
  readonly unitPrice: number;
  readonly presentationId?: string | null;
  readonly tax?: TaxRule;
}

export interface Cart {
  readonly currency: CurrencyCode;
  readonly lines: readonly CartLine[];
}

export const emptyCart = (currency: CurrencyCode = "COP"): Cart => ({
  currency,
  lines: [],
});
