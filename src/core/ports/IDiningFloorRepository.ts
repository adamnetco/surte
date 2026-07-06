/**
 * IDiningFloorRepository — contrato para el salón de mesas: áreas, mesas
 * y órdenes abiertas por mesa, más suscripción realtime.
 * Fase 2 · Adaptadores de Infraestructura (dominio POS · salón).
 */
export interface DiningArea {
  id: string;
  name: string;
  color: string | null;
}

export interface DiningTable {
  id: string;
  label: string;
  capacity: number;
  status: string;
  dining_area_id: string | null;
  pos_x?: number;
  pos_y?: number;
  width?: number;
  height?: number;
  shape?: string;
  location_id?: string | null;
}

export interface OpenTableOrder {
  id: string;
  dining_table_id: string | null;
  total: number;
  opened_at: string;
  sub_label: string | null;
}

export interface DiningFloorSnapshot {
  areas: DiningArea[];
  tables: DiningTable[];
  openOrders: OpenTableOrder[];
}

export interface IDiningFloorRepository {
  loadSnapshot(input: {
    organizationId: string;
    withCoords: boolean;
  }): Promise<DiningFloorSnapshot>;

  /**
   * Suscribe cambios en `table_orders` y `dining_tables` para la organización.
   * Retorna función de cleanup.
   */
  subscribeToFloor(input: {
    organizationId: string;
    onChange: () => void;
  }): () => void;
}
