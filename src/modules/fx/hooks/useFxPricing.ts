import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { toast } from "sonner";

export type FxPricingRule = {
  id: string;
  organization_id: string;
  pair_id: string;
  base_source: "manual" | "trm_banrep" | "api";
  spread_buy_pct: number;
  spread_sell_pct: number;
  min_buy: number | null;
  max_buy: number | null;
  min_sell: number | null;
  max_sell: number | null;
  auto_publish: boolean;
  is_active: boolean;
};

export type FxRateRow = {
  id: string;
  pair_id: string;
  buy_rate: number;
  sell_rate: number;
  source: string;
  base_rate: number | null;
  effective_at: string;
  is_published: boolean;
};

export function useFxPricingRules() {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ["fx_pricing_rules", currentOrg?.id],
    queryFn: async (): Promise<FxPricingRule[]> => {
      if (!currentOrg?.id) return [];
      const { data, error } = await supabase
        .from("fx_pricing_rules" as any)
        .select("*")
        .eq("organization_id", currentOrg.id);
      if (error) throw error;
      return (data ?? []) as unknown as FxPricingRule[];
    },
    enabled: !!currentOrg?.id,
  });
}

export function useUpsertPricingRule() {
  const { currentOrg } = useOrganization();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (rule: Partial<FxPricingRule> & { pair_id: string }) => {
      if (!currentOrg?.id) throw new Error("Sin organización");
      const { error } = await supabase
        .from("fx_pricing_rules" as any)
        .upsert(
          { ...rule, organization_id: currentOrg.id },
          { onConflict: "organization_id,pair_id" },
        );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fx_pricing_rules"] });
      toast.success("Regla de pricing guardada");
    },
    onError: (e: any) => toast.error(e.message ?? "Error al guardar regla"),
  });
}

export function useFxRateHistory(pairId: string | null, limit = 60) {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ["fx_rate_history", currentOrg?.id, pairId, limit],
    queryFn: async (): Promise<FxRateRow[]> => {
      if (!currentOrg?.id || !pairId) return [];
      const { data, error } = await supabase
        .from("fx_rates")
        .select("id,pair_id,buy_rate,sell_rate,source,base_rate,effective_at,is_published")
        .eq("organization_id", currentOrg.id)
        .eq("pair_id", pairId)
        .order("effective_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as FxRateRow[];
    },
    enabled: !!currentOrg?.id && !!pairId,
  });
}

export function usePublishRate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: {
      pair_id: string;
      buy_rate: number;
      sell_rate: number;
      source?: string;
      base_rate?: number | null;
    }) => {
      const { data, error } = await supabase.rpc("fx_publish_rate" as any, {
        _pair_id: p.pair_id,
        _buy_rate: p.buy_rate,
        _sell_rate: p.sell_rate,
        _source: p.source ?? "manual",
        _base_rate: p.base_rate ?? null,
      });
      if (error) throw error;
      return data as string;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fx_latest_rates"] });
      qc.invalidateQueries({ queryKey: ["fx_rate_history"] });
      toast.success("Cotización publicada");
    },
    onError: (e: any) => toast.error(e.message ?? "Error al publicar"),
  });
}

export function useImportTrm() {
  return useMutation({
    mutationFn: async (opts?: { pair_id?: string; publish?: boolean }) => {
      const { data, error } = await supabase.functions.invoke("fx-import-trm", {
        body: opts ?? {},
      });
      if (error) throw error;
      return data as { trm: number; effective_from: string; effective_to: string; published_rate_id: string | null };
    },
    onError: (e: any) => toast.error(e.message ?? "Error al importar TRM"),
  });
}

export function applySpread(base: number, rule?: FxPricingRule | null) {
  if (!base || !rule) return { buy: base, sell: base };
  let buy = base * (1 - rule.spread_buy_pct / 100);
  let sell = base * (1 + rule.spread_sell_pct / 100);
  if (rule.min_buy != null && buy < rule.min_buy) buy = rule.min_buy;
  if (rule.max_buy != null && buy > rule.max_buy) buy = rule.max_buy;
  if (rule.min_sell != null && sell < rule.min_sell) sell = rule.min_sell;
  if (rule.max_sell != null && sell > rule.max_sell) sell = rule.max_sell;
  return { buy: Number(buy.toFixed(2)), sell: Number(sell.toFixed(2)) };
}
