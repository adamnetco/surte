/**
 * IPriceListRepository — contrato para leer overrides de precio
 * asociados a una lista de precios activa.
 *
 * Fase 2 · Hexagonal. Consumido por hooks del POS (usePriceListOverrides).
 */

export interface PriceListItemRow {
  product_id: string;
  price: number;
}

export interface PriceListRow {
  id: string;
  name: string;
}

export interface IPriceListRepository {
  /**
   * Devuelve los overrides de precio base para la lista dada.
   * Sólo incluye filas sin `presentation_id` (precio del producto base).
   */
  listBasePriceOverrides(priceListId: string): Promise<PriceListItemRow[]>;

  /** Lista las listas de precios activas de la organización, ordenadas por nombre. */
  listActive(organizationId: string): Promise<PriceListRow[]>;
}

