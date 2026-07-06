/**
 * SupabaseTableOrderRepository — implementa `ITableOrderRepository`
 * usando las tablas `dining_tables` y `table_orders`.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  ITableOrderRepository,
  OpenTableOrderInput,
  OpenedTableOrder,
} from "@/core/ports/ITableOrderRepository";

const asError = (raw: unknown): Error | null =>
  raw ? new Error((raw as { message?: string }).message ?? "table_order_open_failed") : null;

export const supabaseTableOrderRepository: ITableOrderRepository = {
  async openForTable({ organizationId, diningTableId, waiterId }: OpenTableOrderInput) {
    const { data: table, error: tableErr } = await supabase
      .from("dining_tables")
      .select("location_id")
      .eq("id", diningTableId)
      .single();
    if (tableErr) return { order: null, error: asError(tableErr) };

    const { data, error } = await supabase
      .from("table_orders")
      .insert({
        organization_id: organizationId,
        location_id: (table as { location_id: string | null } | null)?.location_id,
        dining_table_id: diningTableId,
        service_type_key: "dine_in",
        waiter_id: waiterId,
        status: "open",
      })
      .select()
      .single();
    if (error) return { order: null, error: asError(error) };

    const { error: updErr } = await supabase
      .from("dining_tables")
      .update({ status: "occupied" })
      .eq("id", diningTableId)
      .eq("organization_id", organizationId);
    if (updErr) return { order: null, error: asError(updErr) };

    return { order: data as OpenedTableOrder, error: null };
  },
};
