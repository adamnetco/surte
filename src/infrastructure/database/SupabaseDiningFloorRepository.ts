/**
 * SupabaseDiningFloorRepository — implementa `IDiningFloorRepository`
 * usando `dining_areas`, `dining_tables`, `table_orders` y realtime.
 */
import { supabase } from "@/integrations/supabase/client";
import { uniqueTopic, safeRemoveChannel } from "@/lib/realtime/safeChannel";
import type {
  DiningArea,
  DiningFloorSnapshot,
  DiningTable,
  IDiningFloorRepository,
  OpenTableOrder,
} from "@/core/ports/IDiningFloorRepository";

export const supabaseDiningFloorRepository: IDiningFloorRepository = {
  async loadSnapshot({ organizationId, withCoords }): Promise<DiningFloorSnapshot> {
    const tableCols = withCoords
      ? "id,label,capacity,pos_x,pos_y,width,height,shape,status,dining_area_id,location_id"
      : "id,label,capacity,status,dining_area_id";

    const [{ data: a }, { data: t }, { data: o }] = await Promise.all([
      supabase
        .from("dining_areas")
        .select("id,name,color")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("sort_order"),
      supabase
        .from("dining_tables")
        .select(tableCols as "*")
        .eq("organization_id", organizationId)
        .eq("is_active", true)
        .order("label"),
      supabase
        .from("table_orders")
        .select("id,dining_table_id,total,opened_at,sub_label")
        .eq("organization_id", organizationId)
        .in("status", ["open", "sent", "billed"]),
    ]);

    return {
      areas: ((a as DiningArea[]) ?? []),
      tables: ((t as unknown as DiningTable[]) ?? []),
      openOrders: ((o as OpenTableOrder[]) ?? []),
    };
  },

  subscribeToFloor({ organizationId, onChange }) {
    let ch: ReturnType<typeof supabase.channel> | null = null;
    try {
      ch = supabase
        .channel(uniqueTopic(`floor-${organizationId}`))
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "table_orders", filter: `organization_id=eq.${organizationId}` },
          () => onChange(),
        )
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "dining_tables", filter: `organization_id=eq.${organizationId}` },
          () => onChange(),
        )
        .subscribe();
    } catch (err) {
      console.warn("[SupabaseDiningFloorRepository] realtime subscribe failed", err);
    }
    return () => {
      safeRemoveChannel(ch);
    };
  },
};
