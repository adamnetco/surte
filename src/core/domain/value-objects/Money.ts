/**
 * Money — Value Object inmutable para representar montos monetarios.
 *
 * Reglas duras:
 *  - Redondeo COP a entero (no fracciones de peso).
 *  - Operaciones nunca mutan; devuelven una nueva instancia.
 *  - No depende de React ni de Supabase — TypeScript puro.
 *
 * Fase 1 · Aislamiento del Dominio.
 */

export type CurrencyCode = "COP" | "USD" | "EUR";

export interface Money {
  readonly amount: number; // entero para COP; decimales permitidos para USD/EUR
  readonly currency: CurrencyCode;
}

const DECIMAL_CURRENCIES: Record<CurrencyCode, number> = {
  COP: 0,
  USD: 2,
  EUR: 2,
};

const round = (value: number, decimals: number): number => {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

export const money = (amount: number, currency: CurrencyCode = "COP"): Money => ({
  amount: round(amount, DECIMAL_CURRENCIES[currency]),
  currency,
});

export const zero = (currency: CurrencyCode = "COP"): Money => money(0, currency);

const assertSameCurrency = (a: Money, b: Money) => {
  if (a.currency !== b.currency) {
    throw new Error(`Currency mismatch: ${a.currency} vs ${b.currency}`);
  }
};

export const add = (a: Money, b: Money): Money => {
  assertSameCurrency(a, b);
  return money(a.amount + b.amount, a.currency);
};

export const subtract = (a: Money, b: Money): Money => {
  assertSameCurrency(a, b);
  return money(a.amount - b.amount, a.currency);
};

export const multiply = (a: Money, factor: number): Money =>
  money(a.amount * factor, a.currency);

export const isZero = (m: Money): boolean => m.amount === 0;

export const isNegative = (m: Money): boolean => m.amount < 0;
