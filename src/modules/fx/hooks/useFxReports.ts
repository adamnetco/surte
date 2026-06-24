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

export type MarginBucket = {
  key: string;
  label: string;
  count: number;
  margin: number;          // sum of commission_amount (assume same currency per bucket)
  marginCurrencyId?: string;
  invoiced: number;        // count with commission_invoice_status='emitted'
  pending: number;         // count with status pending/null and margin>0
  failed: number;
};

function emptyBucket(key: string, label: string): MarginBucket {
  return { key, label, count: 0, margin: 0, invoiced: 0, pending: 0, failed: 0 };
}

/** Resumen agregado: totales por divisa y por operación + márgenes por par/cajero/día. */
export function useFxSummary(range: FxReportRange) {
  const { data: txs = [], ...rest } = useFxTransactionsByRange(range);

  const byCurrency: Record<string, { buy: number; sell: number; count: number }> = {};
  const byPair: Record<string, MarginBucket> = {};
  const byCashier: Record<string, MarginBucket> = {};
  const byDay: Record<string, MarginBucket> = {};
  let totalOps = 0;
  let aboveThreshold = 0;
  let suspicious = 0;
  let totalMargin = 0;
  let marginCurrencyId: string | undefined;

  for (const t of txs as any[]) {
    totalOps += 1;
    if (t.is_above_threshold) aboveThreshold += 1;
    if (t.is_suspicious) suspicious += 1;
    const cur = t.operation === "buy" ? t.from_currency_id : t.to_currency_id;
    if (!byCurrency[cur]) byCurrency[cur] = { buy: 0, sell: 0, count: 0 };
    byCurrency[cur].count += 1;
    if (t.operation === "buy") byCurrency[cur].buy += Number(t.from_amount);
    else byCurrency[cur].sell += Number(t.to_amount);

    const margin = Number(t.commission_amount ?? 0);
    const status = t.commission_invoice_status as string | null;
    totalMargin += margin;
    if (margin > 0 && !marginCurrencyId) marginCurrencyId = t.commission_currency_id ?? undefined;

    const pairKey = `${t.from_currency_id}__${t.to_currency_id}`;
    const pairLabel = pairKey;
    const cashierKey = t.cashier_id ?? "—";
    const dayKey = (t.created_at as string).slice(0, 10);

    for (const [map, key, label] of [
      [byPair, pairKey, pairLabel],
      [byCashier, cashierKey, cashierKey],
      [byDay, dayKey, dayKey],
    ] as const) {
      if (!map[key]) map[key] = emptyBucket(key, label);
      const b = map[key];
      b.count += 1;
      b.margin += margin;
      if (margin > 0 && !b.marginCurrencyId) b.marginCurrencyId = t.commission_currency_id ?? undefined;
      if (status === "emitted") b.invoiced += 1;
      else if (status === "failed") b.failed += 1;
      else if (margin > 0) b.pending += 1;
    }
  }

  const sortByMargin = (a: MarginBucket, b: MarginBucket) => b.margin - a.margin;

  return {
    txs,
    totals: { totalOps, aboveThreshold, suspicious, totalMargin, marginCurrencyId },
    byCurrency,
    byPair: Object.values(byPair).sort(sortByMargin),
    byCashier: Object.values(byCashier).sort(sortByMargin),
    byDay: Object.values(byDay).sort((a, b) => a.key.localeCompare(b.key)),
    ...rest,
  };
}
