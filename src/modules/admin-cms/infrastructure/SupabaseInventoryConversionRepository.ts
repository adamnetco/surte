import { supabase } from "@/integrations/supabase/client";
import type {
  ConversionLogEntry,
  ConversionRule,
  ConversionRuleInput,
  ExecuteConversionInput,
  ExecuteConversionResult,
  IInventoryConversionRepository,
} from "@/core/ports/IInventoryConversionRepository";

/** Adaptador Supabase del puerto de conversión de inventario. */
export class SupabaseInventoryConversionRepository implements IInventoryConversionRepository {
  async listRules(orgId: string): Promise<ConversionRule[]> {
    const { data, error } = await supabase
      .from("product_conversion_rules")
      .select("id, name, from_product_id, from_presentation_id, to_product_id, to_presentation_id, factor, is_active")
      .eq("organization_id", orgId)
      .eq("is_active", true)
      .order("name");
    if (error) throw error;
    return (data ?? []).map((r) => ({ ...r, factor: Number(r.factor) })) as ConversionRule[];
  }

  async saveRule(orgId: string, input: ConversionRuleInput, id?: string): Promise<void> {
    if (id) {
      const { error } = await supabase
        .from("product_conversion_rules")
        .update({ ...input })
        .eq("id", id)
        .eq("organization_id", orgId);
      if (error) throw error;
      return;
    }
    const { error } = await supabase
      .from("product_conversion_rules")
      .insert({ ...input, organization_id: orgId });
    if (error) throw error;
  }

  async deleteRule(orgId: string, id: string): Promise<void> {
    const { error } = await supabase
      .from("product_conversion_rules")
      .delete()
      .eq("id", id)
      .eq("organization_id", orgId);
    if (error) throw error;
  }

  async listHistory(orgId: string, warehouseId?: string, limit = 30): Promise<ConversionLogEntry[]> {
    let q = supabase
      .from("inventory_conversions")
      .select("id, warehouse_id, from_product_id, to_product_id, qty_from, factor, qty_to, unit_cost_to, notes, created_at")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false })
      .limit(limit);
    if (warehouseId) q = q.eq("warehouse_id", warehouseId);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map((r) => ({
      ...r,
      qty_from: Number(r.qty_from),
      qty_to: Number(r.qty_to),
      factor: Number(r.factor),
      unit_cost_to: r.unit_cost_to === null ? null : Number(r.unit_cost_to),
    })) as ConversionLogEntry[];
  }

  async execute(orgId: string, input: ExecuteConversionInput): Promise<ExecuteConversionResult> {
    const { data, error } = await supabase.rpc("convert_inventory", {
      p_org_id: orgId,
      p_warehouse_id: input.warehouseId,
      p_from_product: input.fromProductId,
      p_from_presentation: input.fromPresentationId,
      p_to_product: input.toProductId,
      p_to_presentation: input.toPresentationId,
      p_qty: input.qty,
      p_factor: input.factor,
      p_notes: input.notes ?? null,
      p_rule_id: input.ruleId ?? null,
    });
    if (error) throw error;
    const res = (data ?? {}) as Record<string, unknown>;
    return {
      conversionId: String(res.conversion_id ?? ""),
      qtyFrom: Number(res.qty_from ?? 0),
      qtyTo: Number(res.qty_to ?? 0),
      unitCostTo: Number(res.unit_cost_to ?? 0),
    };
  }
}

export const inventoryConversionRepository = new SupabaseInventoryConversionRepository();
