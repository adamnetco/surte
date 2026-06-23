import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";

export type FxFraudRule = {
  id: string;
  organization_id: string;
  rule_code: string;
  name: string;
  description: string | null;
  params: Record<string, any>;
  severity: "low" | "medium" | "high" | "critical";
  is_active: boolean;
  auto_mark_suspicious: boolean;
  created_at: string;
  updated_at: string;
};

export type FxFraudAlert = {
  id: string;
  organization_id: string;
  transaction_id: string | null;
  rule_id: string | null;
  rule_code: string;
  severity: "low" | "medium" | "high" | "critical";
  status: "open" | "reviewed" | "dismissed" | "escalated";
  reason: string;
  details: Record<string, any>;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  created_at: string;
};

export type FxFraudWatchEntry = {
  id: string;
  organization_id: string;
  doc_type: string | null;
  doc_number: string;
  full_name: string | null;
  reason: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

const RULE_DEFAULTS: Array<Omit<FxFraudRule, "id" | "organization_id" | "created_at" | "updated_at">> = [
  {
    rule_code: "structuring_daily_count",
    name: "Estructuración por frecuencia diaria",
    description: "Alerta cuando el mismo cliente realiza varias operaciones en un mismo día.",
    params: { max_ops_per_day: 3 },
    severity: "medium",
    is_active: true,
    auto_mark_suspicious: false,
  },
  {
    rule_code: "structuring_daily_amount",
    name: "Estructuración por monto diario acumulado",
    description: "Alerta cuando el acumulado diario por cliente supera el umbral en COP.",
    params: { max_amount_per_day_cop: 50_000_000 },
    severity: "high",
    is_active: true,
    auto_mark_suspicious: true,
  },
  {
    rule_code: "rapid_operations",
    name: "Operaciones rápidas",
    description: "Alerta cuando un cliente realiza muchas operaciones en una ventana corta.",
    params: { max_ops: 5, window_minutes: 60 },
    severity: "high",
    is_active: true,
    auto_mark_suspicious: true,
  },
  {
    rule_code: "large_single_op",
    name: "Operación individual grande",
    description: "Alerta cuando una operación individual supera el umbral en COP.",
    params: { threshold_cop: 40_000_000 },
    severity: "medium",
    is_active: true,
    auto_mark_suspicious: false,
  },
  {
    rule_code: "missing_customer_data",
    name: "Datos de cliente incompletos sobre umbral UIAF",
    description: "Alerta cuando una operación sobre umbral UIAF no captura datos completos del cliente.",
    params: {},
    severity: "critical",
    is_active: true,
    auto_mark_suspicious: true,
  },
];

export function useFxFraudRules() {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ["fx-fraud-rules", currentOrg?.id],
    enabled: !!currentOrg?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("fx_fraud_rules")
        .select("*")
        .eq("organization_id", currentOrg!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as FxFraudRule[];
    },
  });
}

export function useSeedDefaultFraudRules() {
  const { currentOrg } = useOrganization();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!currentOrg?.id) throw new Error("Sin organización");
      const rows = RULE_DEFAULTS.map((r) => ({ ...r, organization_id: currentOrg.id }));
      const { error } = await (supabase as any)
        .from("fx_fraud_rules")
        .upsert(rows, { onConflict: "organization_id,rule_code" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fx-fraud-rules"] }),
  });
}

export function useUpdateFraudRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: Partial<FxFraudRule> & { id: string }) => {
      const { id, ...rest } = patch;
      const { error } = await (supabase as any).from("fx_fraud_rules").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fx-fraud-rules"] }),
  });
}

export function useFxFraudAlerts(status?: FxFraudAlert["status"] | "all") {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ["fx-fraud-alerts", currentOrg?.id, status ?? "open"],
    enabled: !!currentOrg?.id,
    queryFn: async () => {
      let q = (supabase as any)
        .from("fx_fraud_alerts")
        .select("*")
        .eq("organization_id", currentOrg!.id)
        .order("created_at", { ascending: false })
        .limit(200);
      if (status && status !== "all") q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as FxFraudAlert[];
    },
  });
}

export function useUpdateFraudAlert() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (patch: { id: string; status?: FxFraudAlert["status"]; review_notes?: string }) => {
      const { id, ...rest } = patch;
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await (supabase as any)
        .from("fx_fraud_alerts")
        .update({
          ...rest,
          reviewed_by: userData.user?.id ?? null,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fx-fraud-alerts"] }),
  });
}

export function useFxFraudWatchlist() {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ["fx-fraud-watchlist", currentOrg?.id],
    enabled: !!currentOrg?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("fx_fraud_watchlist")
        .select("*")
        .eq("organization_id", currentOrg!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as FxFraudWatchEntry[];
    },
  });
}

export function useAddWatchlistEntry() {
  const { currentOrg } = useOrganization();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (entry: { doc_type?: string; doc_number: string; full_name?: string; reason?: string }) => {
      if (!currentOrg?.id) throw new Error("Sin organización");
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await (supabase as any).from("fx_fraud_watchlist").insert({
        organization_id: currentOrg.id,
        added_by: userData.user?.id ?? null,
        ...entry,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fx-fraud-watchlist"] }),
  });
}

export function useRemoveWatchlistEntry() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("fx_fraud_watchlist")
        .update({ is_active: false })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fx-fraud-watchlist"] }),
  });
}
