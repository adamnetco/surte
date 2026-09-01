/**
 * IStockWatchRepository — contrato para observar stock de productos en tiempo
 * real. Usado por la pantalla de Tickets Abiertos para mostrar disponibilidad
 * de los productos comprometidos en tickets suspendidos.
 *
 * La presentación nunca conoce Supabase: solo este puerto.
 */

export interface StockSnapshot {
  id: string;
  name: string;
  stock: number;
  sku: string | null;
  unit: string | null;
}

export interface IStockWatchRepository {
  /** Stock actual de los productos indicados. Ids inexistentes se omiten. */
  getStock(organizationId: string, productIds: string[]): Promise<StockSnapshot[]>;
  /** Suscripción a cambios de stock de la organización. Devuelve un unsubscribe. */
  subscribe(organizationId: string, onChange: () => void): () => void;
}
