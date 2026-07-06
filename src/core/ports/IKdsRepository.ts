/**
 * IKdsRepository — contrato para pantalla de cocina (KDS): estaciones,
 * comandas activas, avance de estado y suscripción realtime.
 * Fase 2 · Adaptadores de Infraestructura (dominio POS · KDS).
 */
export interface KdsStation {
  id: string;
  name: string;
  color: string | null;
  sla_minutes: number;
}

export interface KdsTicketItem {
  name: string;
  qty: number;
  done?: boolean;
}

export interface KdsTicket {
  id: string;
  kitchen_station_id: string | null;
  dining_table_label: string | null;
  items: KdsTicketItem[];
  status: string;
  sent_at: string;
  started_at: string | null;
  ready_at: string | null;
  notes: string | null;
}

export interface KdsSnapshot {
  stations: KdsStation[];
  tickets: KdsTicket[];
}

export type KdsTicketPatch = Partial<{
  status: string;
  bumped_by: string;
  started_at: string;
  ready_at: string;
  served_at: string;
}>;

export interface IKdsRepository {
  /** Carga estaciones activas + comandas en estados pending/in_progress/ready. */
  loadSnapshot(organizationId: string): Promise<KdsSnapshot>;

  /** Aplica un patch al ticket (avance de estado, timestamps). */
  updateTicket(input: {
    ticketId: string;
    organizationId: string;
    patch: KdsTicketPatch;
  }): Promise<{ error: Error | null }>;

  /** Marca un ítem del ticket como hecho / no hecho vía RPC. */
  toggleItem(input: {
    ticketId: string;
    itemIndex: number;
    done: boolean;
  }): Promise<{ error: Error | null }>;

  /**
   * Suscribe cambios de `kds_tickets` para la organización.
   * Retorna la función de cleanup para desuscribirse.
   */
  subscribeToTickets(input: {
    organizationId: string;
    onChange: () => void;
  }): () => void;
}
