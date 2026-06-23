import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { toast } from "sonner";

export type FxCurrency = {
  id: string;
  organization_id: string;
  code: string;
  name: string;
  symbol: string | null;
  decimals: number;
  is_active: boolean;
  created_at: string;
};

export type FxPair = {
  id: string;
  organization_id: string;
  base_currency_id: string;
  quote_currency_id: string;
  is_active: boolean;
  created_at: string;
};

export type FxRate = {
  id: string;
  organization_id: string;
  pair_id: string;
  buy_rate: number;
  sell_rate: number;
  source: "manual" | "trm_banrep" | "api";
  effective_at: string;
  created_at: string;
};

export function useFxCurrencies() {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ["fx_currencies", currentOrg?.id],
    queryFn: async (): Promise<FxCurrency[]> => {
      if (!currentOrg?.id) return [];
      const { data, error } = await supabase
        .from("fx_currencies")
        .select("*")
        .eq("organization_id", currentOrg.id)
        .order("code");
      if (error) throw error;
      return (data ?? []) as FxCurrency[];
    },
    enabled: !!currentOrg?.id,
  });
}

export function useFxPairs() {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ["fx_pairs", currentOrg?.id],
    queryFn: async (): Promise<FxPair[]> => {
      if (!currentOrg?.id) return [];
      const { data, error } = await supabase
        .from("fx_pairs")
        .select("*")
        .eq("organization_id", currentOrg.id);
      if (error) throw error;
      return (data ?? []) as FxPair[];
    },
    enabled: !!currentOrg?.id,
  });
}

export function useFxLatestRates() {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ["fx_latest_rates", currentOrg?.id],
    queryFn: async (): Promise<Record<string, FxRate>> => {
      if (!currentOrg?.id) return {};
      const { data, error } = await supabase
        .from("fx_rates")
        .select("*")
        .eq("organization_id", currentOrg.id)
        .order("effective_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      const latest: Record<string, FxRate> = {};
      for (const r of (data ?? []) as FxRate[]) {
        if (!latest[r.pair_id]) latest[r.pair_id] = r;
      }
      return latest;
    },
    enabled: !!currentOrg?.id,
  });
}

export function useUpsertCurrency() {
  const { currentOrg } = useOrganization();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<FxCurrency> & { code: string; name: string }) => {
      if (!currentOrg?.id) throw new Error("Sin organización");
      const { error } = await supabase
        .from("fx_currencies")
        .upsert({
          ...payload,
          organization_id: currentOrg.id,
          code: payload.code.toUpperCase(),
        }, { onConflict: "organization_id,code" });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fx_currencies"] });
      toast.success("Divisa guardada");
    },
    onError: (e: any) => toast.error(e.message ?? "Error al guardar"),
  });
}

export function useCreatePair() {
  const { currentOrg } = useOrganization();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { base_currency_id: string; quote_currency_id: string }) => {
      if (!currentOrg?.id) throw new Error("Sin organización");
      const { error } = await supabase
        .from("fx_pairs")
        .insert({ ...p, organization_id: currentOrg.id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fx_pairs"] });
      toast.success("Par creado");
    },
    onError: (e: any) => toast.error(e.message ?? "Error al crear par"),
  });
}

export function useSetRate() {
  const { currentOrg } = useOrganization();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (p: { pair_id: string; buy_rate: number; sell_rate: number; source?: "manual" | "trm_banrep" | "api" }) => {
      if (!currentOrg?.id) throw new Error("Sin organización");
      if (p.buy_rate <= 0 || p.sell_rate <= 0) throw new Error("Tasas deben ser positivas");
      const { error } = await supabase
        .from("fx_rates")
        .insert({
          organization_id: currentOrg.id,
          pair_id: p.pair_id,
          buy_rate: p.buy_rate,
          sell_rate: p.sell_rate,
          source: p.source ?? "manual",
        });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fx_latest_rates"] });
      toast.success("Cotización registrada");
    },
    onError: (e: any) => toast.error(e.message ?? "Error al registrar tasa"),
  });
}
