/**
 * SupabaseParkedTicketRepository — implementa `IParkedTicketRepository`
 * usando la tabla `parked_tickets` y realtime `postgres_changes`.
 */
import { supabase } from "@/integrations/supabase/client";
import { uniqueTopic, safeRemoveChannel } from "@/lib/realtime/safeChannel";
import type {
  IParkedTicketRepository,
  ParkedTicketRow,
} from "@/core/ports/IParkedTicketRepository";

const asError = (e: unknown): Error =>
  e instanceof Error ? e : new Error(String(e));

export const supabaseParkedTicketRepository: IParkedTicketRepository = {
  async list(organizationId) {
    const { data, error } = await supabase
      .from("parked_tickets")
      .select(
        "id, label, customer_name, notes, items, subtotal, total, cashier_id, cash_session_id, created_at",
      )
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw asError(error);
    return (data ?? []) as unknown as ParkedTicketRow[];
  },

  async remove(id) {
    const { error } = await supabase
      .from("parked_tickets")
      .delete()
      .eq("id", id);
    if (error) throw asError(error);
  },

  subscribe(organizationId, onChange) {
    const channel = supabase
      .channel(uniqueTopic(`parked-sheet-${organizationId}`))
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "parked_tickets",
          filter: `organization_id=eq.${organizationId}`,
        },
        () => onChange(),
      )
      .subscribe();
    return () => {
      safeRemoveChannel(channel);
    };
  },
};
