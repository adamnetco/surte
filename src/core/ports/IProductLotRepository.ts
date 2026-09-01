/**
 * IProductLotRepository — contrato para lotes y caducidad de productos.
 *
 * La presentación nunca conoce Supabase: solo este puerto.
 */

export type ProductLot = {
  id: string;
  product_id: string;
  warehouse_id: string;
  lot_code: string;
  expires_at: string | null;
  manufactured_at: string | null;
  received_quantity: number;
  quantity: number;
  unit_cost: number;
  notes: string | null;
  is_active: boolean;
  created_at: string;
};

export type LotDraft = {
  lot_code: string;
  expires_at: string | null;
  manufactured_at: string | null;
  quantity: number;
  unit_cost: number;
  notes: string | null;
};

export type LotSeverity = "expired" | "critical" | "soon" | "ok";

export type LotExpiryRow = {
  lot_id: string;
  product_id: string;
  product_name: string;
  sku: string | null;
  warehouse_id: string;
  warehouse_name: string;
  lot_code: string;
  expires_at: string | null;
  quantity: number;
  unit_cost: number;
  days_left: number | null;
  severity: LotSeverity;
};

export type LotConsumption = {
  lot_id: string;
  lot_code: string;
  expires_at: string | null;
  taken: number;
};

export interface IProductLotRepository {
  /** Lotes activos de un producto en una bodega, ordenados FEFO. */
  listByProduct(
    organizationId: string,
    productId: string,
    warehouseId: string,
  ): Promise<ProductLot[]>;

  create(
    organizationId: string,
    productId: string,
    warehouseId: string,
    draft: LotDraft,
  ): Promise<ProductLot>;

  update(lotId: string, patch: Partial<LotDraft>): Promise<void>;

  /** Baja lógica del lote (no borra historial). */
  deactivate(lotId: string): Promise<void>;

  /** Resumen de vencimientos de la organización (vencidos + próximos N días). */
  expirySummary(organizationId: string, days?: number): Promise<LotExpiryRow[]>;

  /** Descuenta cantidad de los lotes que vencen primero (FEFO). */
  consumeFefo(
    organizationId: string,
    productId: string,
    warehouseId: string,
    quantity: number,
  ): Promise<LotConsumption[]>;
}
