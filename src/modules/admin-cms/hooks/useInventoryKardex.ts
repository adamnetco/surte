import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface KardexRow {
  movement_at: string;
  movement_type: string;
  warehouse_id: string;
  warehouse_name: string | null;
  quantity: number;
  unit_cost: number;
  balance_after: number | null;
  running_balance: number;
  reference_type: string | null;
  reference_id: string | null;
  notes: string | null;
}

const n = (v: unknown) => (typeof v === "number" ? v : Number(v ?? 0));

export function useInventoryKardex(params: {
  productId?: string | null;
  from: Date;
  to: Date;
  warehouseId?: string | null;
}) {
  const { productId, from, to, warehouseId } = params;
  return useQuery({
    enabled: !!productId,
    queryKey: ["kardex", productId, from.toISOString(), to.toISOString(), warehouseId ?? null],
    queryFn: async (): Promise<KardexRow[]> => {
      const { data, error } = await (supabase as any).rpc("inventory_kardex", {
        _product_id: productId,
        _from: from.toISOString(),
        _to: to.toISOString(),
        _warehouse_id: warehouseId ?? null,
      });
      if (error) throw error;
      return (data ?? []).map((r: any) => ({
        movement_at: r.movement_at,
        movement_type: r.movement_type,
        warehouse_id: r.warehouse_id,
        warehouse_name: r.warehouse_name,
        quantity: n(r.quantity),
        unit_cost: n(r.unit_cost),
        balance_after: r.balance_after == null ? null : n(r.balance_after),
        running_balance: n(r.running_balance),
        reference_type: r.reference_type,
        reference_id: r.reference_id,
        notes: r.notes,
      }));
    },
    staleTime: 30_000,
  });
}
