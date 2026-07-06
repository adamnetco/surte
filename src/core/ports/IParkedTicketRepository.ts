/**
 * IParkedTicketRepository — contrato para gestión de tickets suspendidos
 * (parked_tickets) del POS. Extraído de `ParkedTicketsSheet` como parte de
 * la Fase 2 del refactor hexagonal.
 */

export interface ParkedTicketItem {
  productId: string;
  name?: string;
  quantity: number;
  unitPrice?: number;
  total?: number;
  notes?: string;
}

export interface ParkedTicketRow {
  id: string;
  label: string | null;
  customer_name: string | null;
  notes: string | null;
  items: ParkedTicketItem[];
  subtotal: number;
  total: number;
  cashier_id: string | null;
  cash_session_id: string | null;
  created_at: string;
}

export interface IParkedTicketRepository {
  list(organizationId: string): Promise<ParkedTicketRow[]>;
  remove(id: string): Promise<void>;
  subscribe(organizationId: string, onChange: () => void): () => void;
}
