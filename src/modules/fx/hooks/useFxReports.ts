import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";

export type FxReportRange = { from: string; to: string };

export function monthRange(year: number, month: number): FxReportRange {
  const from = new Date(Date.UTC(year, month - 1, 1)).toISOString();
  const to = new Date(Date.UTC(year, month, 1)).toISOString();
  return { from, to };
}

export function useFxTransactionsByRange(range: FxReportRange) {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ["fx_tx_range", currentOrg?.id, range.from, range.to],
    queryFn: async () => {
      if (!currentOrg?.id) return [];
      const { data, error } = await supabase
        .from("fx_transactions")
        .select("*")
        .eq("organization_id", currentOrg.id)
        .gte("created_at", range.from)
        .lt("created_at", range.to)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!currentOrg?.id,
    staleTime: 30_000,
  });
}

/** Resumen agregado: totales por divisa y por operación (compra/venta). */
export function useFxSummary(range: FxReportRange) {
  const { data: txs = [], ...rest } = useFxTransactionsByRange(range);

  const byCurrency: Record<string, { buy: number; sell: number; count: number }> = {};
  let totalOps = 0;
  let aboveThreshold = 0;
  let suspicious = 0;

  for (const t of txs as any[]) {
    totalOps += 1;
    if (t.is_above_threshold) aboveThreshold += 1;
    if (t.is_suspicious) suspicious += 1;
    const key = t.operation === "buy" ? t.from_currency_id : t.to_currency_id;
    if (!byCurrency[key]) byCurrency[key] = { buy: 0, sell: 0, count: 0 };
    byCurrency[key].count += 1;
    if (t.operation === "buy") byCurrency[key].buy += Number(t.from_amount);
    else byCurrency[key].sell += Number(t.to_amount);
  }

  return {
    txs,
    totals: { totalOps, aboveThreshold, suspicious },
    byCurrency,
    ...rest,
  };
}
