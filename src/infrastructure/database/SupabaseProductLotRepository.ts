/**
 * SupabaseProductLotRepository — implementa `IProductLotRepository`.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  IProductLotRepository,
  LotConsumption,
  LotDraft,
  LotExpiryRow,
  ProductLot,
} from "@/core/ports/IProductLotRepository";

const asError = (e: unknown): Error =>
  e instanceof Error ? e : new Error(String(e));

export const supabaseProductLotRepository: IProductLotRepository = {
  async listByProduct(organizationId, productId, warehouseId) {
    const { data, error } = await supabase
      .from("product_lots")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("product_id", productId)
      .eq("warehouse_id", warehouseId)
      .eq("is_active", true)
      .order("expires_at", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: true });
    if (error) throw asError(error);
    return (data ?? []) as ProductLot[];
  },

  async create(organizationId, productId, warehouseId, draft: LotDraft) {
    const { data, error } = await supabase
      .from("product_lots")
      .insert({
        organization_id: organizationId,
        product_id: productId,
        warehouse_id: warehouseId,
        lot_code: draft.lot_code,
        expires_at: draft.expires_at,
        manufactured_at: draft.manufactured_at,
        quantity: draft.quantity,
        received_quantity: draft.quantity,
        unit_cost: draft.unit_cost,
        notes: draft.notes,
      })
      .select("*")
      .single();
    if (error) throw asError(error);
    return data as ProductLot;
  },

  async update(lotId, patch) {
    const { error } = await supabase
      .from("product_lots")
      .update(patch)
      .eq("id", lotId);
    if (error) throw asError(error);
  },

  async deactivate(lotId) {
    const { error } = await supabase
      .from("product_lots")
      .update({ is_active: false })
      .eq("id", lotId);
    if (error) throw asError(error);
  },

  async expirySummary(organizationId, days = 60) {
    const { data, error } = await supabase.rpc("lots_expiry_summary", {
      _org_id: organizationId,
      _days: days,
    });
    if (error) throw asError(error);
    return (data ?? []) as LotExpiryRow[];
  },

  async consumeFefo(organizationId, productId, warehouseId, quantity) {
    const { data, error } = await supabase.rpc("consume_lots_fefo", {
      _org_id: organizationId,
      _product_id: productId,
      _warehouse_id: warehouseId,
      _quantity: quantity,
    });
    if (error) throw asError(error);
    return (data ?? []) as LotConsumption[];
  },
};
