/**
 * Tax — Value Object para reglas fiscales colombianas (IVA, INC).
 * Fase 1 · Aislamiento del Dominio.
 */
import { type Money, money, multiply } from "./Money";

export type TaxKind = "IVA" | "INC" | "NONE";

export interface TaxRule {
  readonly kind: TaxKind;
  /** Porcentaje entero — 19 para IVA 19 %, 8 para INC 8 %. */
  readonly rate: number;
  /** True = el precio de venta ya incluye impuesto (Colombia por defecto). */
  readonly included: boolean;
}

export const NO_TAX: TaxRule = { kind: "NONE", rate: 0, included: true };
export const IVA_19: TaxRule = { kind: "IVA", rate: 19, included: true };
export const INC_8: TaxRule = { kind: "INC", rate: 8, included: true };

/**
 * Extrae el impuesto contenido en un monto ya-con-IVA.
 * Ej.: base 11.900 COP con IVA 19 % → tax 1.900 COP.
 */
export const extractTax = (grossAmount: Money, rule: TaxRule): Money => {
  if (rule.rate <= 0 || rule.kind === "NONE") return money(0, grossAmount.currency);
  if (!rule.included) return multiply(grossAmount, rule.rate / 100);
  const factor = rule.rate / (100 + rule.rate);
  return multiply(grossAmount, factor);
};

/**
 * Aplica el impuesto sobre un monto neto (cuando included=false).
 */
export const applyTax = (netAmount: Money, rule: TaxRule): Money => {
  if (rule.rate <= 0 || rule.kind === "NONE") return money(0, netAmount.currency);
  return multiply(netAmount, rule.rate / 100);
};
