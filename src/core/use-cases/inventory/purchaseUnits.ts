/**
 * Normalización de unidades de compra y conversión de empaques.
 *
 * Lógica pura (0% React, 0% Supabase). Resuelve el caso clásico de retail:
 * se compra por bulto/caja/paca y se vende por unidad, así que hay que
 * normalizar cantidad y costo antes de tocar inventario.
 */

export interface PurchaseUnitInput {
  /** Cantidad tal como viene en la factura del proveedor (p. ej. 5 cajas). */
  purchaseQty: number;
  /** Unidades vendibles que trae cada unidad de compra (factor de conversión). */
  unitsPerPurchase: number;
  /** Costo total pagado por cada unidad de compra (p. ej. costo de la caja). */
  purchaseUnitCost: number;
  /** Descuento por línea en valor absoluto sobre el costo total. */
  lineDiscount?: number;
  /** Impuesto no descontable que se capitaliza al costo (IPO/consumo). */
  nonDeductibleTax?: number;
}

export interface NormalizedPurchaseUnit {
  /** Unidades vendibles que entran a inventario. */
  baseQty: number;
  /** Costo por unidad vendible, ya con descuentos e impuestos capitalizados. */
  baseUnitCost: number;
  /** Costo total de la línea. */
  lineTotal: number;
  /** Factor efectivamente aplicado (nunca menor a 1 unidad). */
  factor: number;
}

const round = (value: number, decimals: number): number => {
  const f = 10 ** decimals;
  return Math.round((Number.isFinite(value) ? value : 0) * f) / f;
};

const positive = (value: number | undefined, fallback: number): number => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

/**
 * Convierte una línea de compra expresada en unidades de empaque a
 * unidades base vendibles, repartiendo descuentos e impuestos capitalizables.
 */
export function normalizePurchaseUnit(input: PurchaseUnitInput): NormalizedPurchaseUnit {
  const factor = positive(input.unitsPerPurchase, 1);
  const purchaseQty = Math.max(0, Number(input.purchaseQty) || 0);
  const purchaseUnitCost = Math.max(0, Number(input.purchaseUnitCost) || 0);
  const discount = Math.max(0, Number(input.lineDiscount) || 0);
  const tax = Math.max(0, Number(input.nonDeductibleTax) || 0);

  const gross = purchaseQty * purchaseUnitCost;
  const lineTotal = Math.max(0, gross - discount + tax);
  const baseQty = round(purchaseQty * factor, 3);
  const baseUnitCost = baseQty > 0 ? round(lineTotal / baseQty, 4) : 0;

  return { baseQty, baseUnitCost, lineTotal: round(lineTotal, 2), factor };
}

/**
 * Convierte una existencia entre dos presentaciones del mismo artículo
 * (o entre artículos ligados por una regla), trasladando el costo promedio.
 */
export function computeConversion(params: {
  qtyFrom: number;
  factor: number;
  avgCostFrom: number;
}): { qtyTo: number; unitCostTo: number } {
  const factor = positive(params.factor, 1);
  const qtyFrom = Math.max(0, Number(params.qtyFrom) || 0);
  const avgCostFrom = Math.max(0, Number(params.avgCostFrom) || 0);
  const qtyTo = round(qtyFrom * factor, 3);
  const unitCostTo = qtyTo > 0 ? round((avgCostFrom * qtyFrom) / qtyTo, 4) : 0;
  return { qtyTo, unitCostTo };
}

/**
 * Factor implícito entre dos presentaciones a partir de su conversion_factor.
 * Ej.: origen caja (factor 24) → destino unidad (factor 1) ⇒ 24.
 */
export function factorBetweenPresentations(
  fromConversionFactor: number | null | undefined,
  toConversionFactor: number | null | undefined,
): number {
  const from = positive(fromConversionFactor ?? 1, 1);
  const to = positive(toConversionFactor ?? 1, 1);
  return round(from / to, 4);
}
