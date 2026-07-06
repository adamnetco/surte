/**
 * IInvoiceActionsRepository — contrato para las 3 acciones de la caja al
 * cerrar/pausar una venta: emitir factura electrónica, guardar cotización
 * y suspender ticket. Extraído de `InvoiceActionsDialog` (Fase 2).
 */

export interface InvoiceLineInput {
  productId: string;
  name: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface EmitInvoiceInput {
  organizationId: string;
  posOrderId: string;
}

export interface EmitInvoiceResult {
  trackId?: string | null;
}

export interface CreateQuoteInput {
  organizationId: string;
  locationId: string;
  userId: string;
  customerName?: string | null;
  customerPhone?: string | null;
  customerEmail?: string | null;
  items: InvoiceLineInput[];
  subtotal: number;
  total: number;
  notes?: string | null;
  validDays: number;
}

export interface ParkTicketInput {
  organizationId: string;
  locationId: string;
  cashSessionId: string;
  userId: string;
  label?: string | null;
  customerName?: string | null;
  items: InvoiceLineInput[];
  subtotal: number;
  total: number;
  notes?: string | null;
}

export interface IInvoiceActionsRepository {
  emitInvoice(input: EmitInvoiceInput): Promise<EmitInvoiceResult>;
  createQuote(input: CreateQuoteInput): Promise<void>;
  parkTicket(input: ParkTicketInput): Promise<void>;
}
