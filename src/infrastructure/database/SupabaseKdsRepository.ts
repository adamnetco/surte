/**
 * SupabaseKdsRepository — implementa `IKdsRepository` con las tablas
 * `kitchen_stations`, `kds_tickets`, el RPC `kds_toggle_item` y realtime.
 */
import { supabase } from "@/integrations/supabase/client";
import { uniqueTopic, safeRemoveChannel } from "@/lib/realtime/safeChannel";
import type {
  IKdsRepository,
  KdsSnapshot,
  KdsStation,
  KdsTicket,
  KdsTicketPatch,
} from "@/core/ports/IKdsRepository";

const asError = (raw: unknown): Error | null =>
  raw ? new Error((raw as { message?: string }).message ?? "kds_operation_failed") : null;

export const supabaseKdsRepository: IKdsRepository = {
  async loadSnapshot(organizationId: string): Promise<KdsSnapshot> {
    const [{ data: st }, { data: tk }] = await Promise.all([
      supabase
        .from("kitchen_stations")
        .select("id,name,color,sla_minutes")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("kds_tickets")
        .select("id,kitchen_station_id,dining_table_label,items,status,sent_at,started_at,ready_at,notes")
        .eq("organization_id", organizationId)
        .in("status", ["pending", "in_progress", "ready"])
        .order("sent_at"),
    ]);

    return {
      stations: ((st as KdsStation[]) ?? []),
      tickets: ((tk as unknown as KdsTicket[]) ?? []),
    };
  },

  async updateTicket({ ticketId, organizationId, patch }: { ticketId: string; organizationId: string; patch: KdsTicketPatch }) {
    const { error } = await supabase
      .from("kds_tickets")
      .update(patch)
      .eq("id", ticketId)
      .eq("organization_id", organizationId);
    return { error: asError(error) };
  },

  async toggleItem({ ticketId, itemIndex, done }) {
    const { error } = await supabase.rpc("kds_toggle_item", {
      p_ticket_id: ticketId,
      p_item_index: itemIndex,
      p_done: done,
    });
    return { error: asError(error) };
  },

  subscribeToTickets({ organizationId, onChange }) {
    let ch: ReturnType<typeof supabase.channel> | null = null;
    try {
      ch = supabase
        .channel(uniqueTopic(`kds-${organizationId}`))
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "kds_tickets",
            filter: `organization_id=eq.${organizationId}`,
          },
          () => onChange(),
        )
        .subscribe();
    } catch (err) {
      console.warn("[SupabaseKdsRepository] realtime subscribe failed", err);
    }
    return () => {
      safeRemoveChannel(ch);
    };
  },
};
