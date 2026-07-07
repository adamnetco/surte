/**
 * ITableOrderRepository — contrato para abrir una orden de mesa
 * (dine-in) y marcar la mesa como ocupada.
 * Fase 2 · Adaptadores de Infraestructura (dominio POS · mesas).
 */
export interface OpenTableOrderInput {
  organizationId: string;
  diningTableId: string;
  waiterId: string;
}

export interface OpenedTableOrder {
  id: string;
  organization_id: string;
  dining_table_id: string;
  status: string;
}

export interface DeliveryRow {
  id: string;
  order_number: number | null;
  customer_name: string | null;
  customer_phone: string | null;
  total: number;
  status: string;
  opened_at: string;
  notes: string | null;
  metadata: Record<string, unknown> | null;
}

export interface ITableOrderRepository {
  /**
   * Abre una orden nueva `dine_in` para la mesa indicada y marca la
   * mesa como `occupied`. Devuelve `{ error }` si algo falla.
   */
  openForTable(
    input: OpenTableOrderInput,
  ): Promise<{ order: OpenedTableOrder | null; error: Error | null }>;

  /**
   * Lista los pedidos activos (`open|sent|billed`) de tipo domicilio,
   * ya sea por `service_type_key='delivery'` o `metadata.mode='domicilio'`.
   */
  listActiveDeliveries(organizationId: string): Promise<DeliveryRow[]>;

  /** Realtime sobre cambios en `table_orders` de la organización. */
  subscribeTableOrders(organizationId: string, onChange: () => void): () => void;

  /** Crea nueva sub-cuenta a partir de una orden fuente. Devuelve el id de la nueva orden. */
  splitTableOrder(sourceOrderId: string): Promise<string>;

  /** Mueve un item de una orden a otra sub-cuenta. */
  transferTableItem(itemId: string, destOrderId: string): Promise<void>;

  /**
   * Mueve una cuenta (`table_orders.id`) de una mesa origen a una mesa
   * destino libre, actualizando el status de ambas mesas
   * (`origin → available`, `destination → occupied`).
   */
  moveOrderToTable(input: {
    organizationId: string;
    orderId: string;
    fromTableId: string;
    toTableId: string;
  }): Promise<void>;
}

