/**
 * SupabaseTableOrderRepository — implementa `ITableOrderRepository`
 * usando las tablas `dining_tables` y `table_orders`.
 */
import { supabase } from "@/integrations/supabase/client";
import { safeRemoveChannel, uniqueTopic } from "@/lib/realtime/safeChannel";
import type {
  ITableOrderRepository,
  OpenTableOrderInput,
  OpenedTableOrder,
  DeliveryRow,
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

  async listActiveDeliveries(organizationId) {
    const { data, error } = await (supabase as any)
      .from("table_orders")
      .select("id,order_number,customer_name,customer_phone,total,status,opened_at,notes,metadata,service_type_key")
      .eq("organization_id", organizationId)
      .in("status", ["open", "sent", "billed"])
      .or("service_type_key.eq.delivery,metadata->>mode.eq.domicilio")
      .order("opened_at", { ascending: false })
      .limit(100);
    if (error) {
      console.warn("[SupabaseTableOrderRepository.listActiveDeliveries]", error);
      return [];
    }
    return (data ?? []) as DeliveryRow[];
  },

  subscribeTableOrders(organizationId, onChange) {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = (supabase as any)
        .channel(uniqueTopic(`table-orders-${organizationId}`))
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "table_orders", filter: `organization_id=eq.${organizationId}` },
          () => onChange(),
        )
        .subscribe();
    } catch (err) {
      console.warn("[SupabaseTableOrderRepository] realtime subscribe failed", err);
    }
    return () => safeRemoveChannel(channel);
  },

  async splitTableOrder(sourceOrderId) {
    const { data, error } = await (supabase.rpc as any)("split_table_order", { _source: sourceOrderId });
    if (error) throw asError(error);
    return data as string;
  },

  async transferTableItem(itemId, destOrderId) {
    const { error } = await (supabase.rpc as any)("transfer_table_item", { _item: itemId, _dest_order: destOrderId });
    if (error) throw asError(error);
  },

  async moveOrderToTable({ organizationId, orderId, fromTableId, toTableId }) {
    const { error: uErr } = await (supabase as any)
      .from("table_orders")
      .update({ dining_table_id: toTableId })
      .eq("id", orderId)
      .eq("organization_id", organizationId);
    if (uErr) throw asError(uErr);

    const { error: occErr } = await (supabase as any)
      .from("dining_tables")
      .update({ status: "occupied" })
      .eq("id", toTableId)
      .eq("organization_id", organizationId);
    if (occErr) throw asError(occErr);

    const { error: freeErr } = await (supabase as any)
      .from("dining_tables")
      .update({ status: "available" })
      .eq("id", fromTableId)
      .eq("organization_id", organizationId);
    if (freeErr) throw asError(freeErr);
  },
};

