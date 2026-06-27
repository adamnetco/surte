import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type CriticalStockRow = {
  stock_id: string;
  warehouse_id: string;
  warehouse_name: string;
  product_id: string;
  product_name: string;
  sku: string | null;
  image_url: string | null;
  quantity: number;
  min_stock: number;
  reorder_point: number | null;
  max_stock: number | null;
  avg_cost: number;
  suggested_qty: number;
  severity: "critical" | "warning" | "ok";
};

export function useCriticalStock(orgId: string | undefined, enabled = true) {
  const [rows, setRows] = useState<CriticalStockRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!orgId || !enabled) return;
    setLoading(true);
    const { data, error } = await supabase.rpc("inventory_critical_summary", { _org_id: orgId });
    if (!error) setRows((data ?? []) as CriticalStockRow[]);
    setLoading(false);
  }, [orgId, enabled]);

  useEffect(() => { load(); }, [load]);

  return { rows, loading, reload: load };
}
