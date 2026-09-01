/**
 * SupabaseStockWatchRepository — implementa `IStockWatchRepository` sobre la
 * tabla `products` con realtime `postgres_changes`.
 */
import { supabase } from "@/integrations/supabase/client";
import { uniqueTopic, safeRemoveChannel } from "@/lib/realtime/safeChannel";
import type {
  IStockWatchRepository,
  StockSnapshot,
} from "@/core/ports/IStockWatchRepository";

const asError = (e: unknown): Error =>
  e instanceof Error ? e : new Error(String(e));

export const supabaseStockWatchRepository: IStockWatchRepository = {
  async getStock(organizationId, productIds) {
    if (!organizationId || productIds.length === 0) return [];
    const { data, error } = await supabase
      .from("products")
      .select("id, name, stock, sku, unit")
      .eq("organization_id", organizationId)
      .in("id", productIds.slice(0, 500));
    if (error) throw asError(error);
    return (data ?? []) as StockSnapshot[];
  },

  subscribe(organizationId, onChange) {
    const channel = supabase
      .channel(uniqueTopic(`stock-watch-${organizationId}`))
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "products",
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
