/**
 * SupabaseInvoiceActionsRepository — implementa `IInvoiceActionsRepository`
 * mediante el edge function `innapsis-emit` y las tablas `pos_quotes` y
 * `parked_tickets`.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  IInvoiceActionsRepository,
  EmitInvoiceInput,
  EmitInvoiceResult,
  CreateQuoteInput,
  ParkTicketInput,
  InvoiceLineInput,
} from "@/core/ports/IInvoiceActionsRepository";

const asError = (e: unknown): Error =>
  e instanceof Error ? e : new Error(String(e));

const serializeItems = (items: InvoiceLineInput[]) =>
  items.map((l) => ({
    product_id: l.productId,
    name: l.name,
    quantity: l.quantity,
    unit_price: l.unitPrice,
    total: l.total,
  }));

export const supabaseInvoiceActionsRepository: IInvoiceActionsRepository = {
  async emitInvoice({ organizationId, posOrderId }: EmitInvoiceInput): Promise<EmitInvoiceResult> {
    const { data, error } = await supabase.functions.invoke("innapsis-emit", {
      body: {
        organization_id: organizationId,
        pos_order_id: posOrderId,
        document_type: "invoice",
      },
    });
    if (error || !data?.success) {
      throw asError(data?.error || error?.message || "Error al emitir");
    }
    return { trackId: data?.track_id ?? null };
  },

  async createQuote(input: CreateQuoteInput): Promise<void> {
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + input.validDays);
    const { error } = await supabase.from("pos_quotes").insert({
      organization_id: input.organizationId,
      location_id: input.locationId,
      customer_name: input.customerName ?? null,
      customer_phone: input.customerPhone ?? null,
      customer_email: input.customerEmail ?? null,
      items: serializeItems(input.items),
      subtotal: input.subtotal,
      total: input.total,
      notes: input.notes ?? null,
      valid_until: validUntil.toISOString().slice(0, 10),
      created_by: input.userId,
    });
    if (error) throw asError(error);
  },

  async parkTicket(input: ParkTicketInput): Promise<void> {
    const { error } = await supabase.from("parked_tickets").insert({
      organization_id: input.organizationId,
      location_id: input.locationId,
      cash_session_id: input.cashSessionId,
      cashier_id: input.userId,
      label: input.label ?? `Ticket ${new Date().toLocaleTimeString("es-CO")}`,
      customer_name: input.customerName ?? null,
      items: serializeItems(input.items),
      subtotal: input.subtotal,
      total: input.total,
      notes: input.notes ?? null,
    });
    if (error) throw asError(error);
  },
};
