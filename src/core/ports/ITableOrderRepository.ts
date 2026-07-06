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

export interface ITableOrderRepository {
  /**
   * Abre una orden nueva `dine_in` para la mesa indicada y marca la
   * mesa como `occupied`. Devuelve `{ error }` si algo falla.
   */
  openForTable(
    input: OpenTableOrderInput,
  ): Promise<{ order: OpenedTableOrder | null; error: Error | null }>;
}
