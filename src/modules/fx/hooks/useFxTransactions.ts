import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { toast } from "sonner";

export type FxTransactionInput = {
  pair_id: string;
  operation: "buy" | "sell";
  from_currency_id: string;
  to_currency_id: string;
  from_amount: number;
  to_amount: number;
  rate_applied: number;
  mid_rate?: number | null;
  commission_amount?: number | null;
  commission_currency_id?: string | null;
  is_above_threshold: boolean;
  customer_doc_type?: string | null;
  customer_doc_number?: string | null;
  customer_name?: string | null;
  customer_address?: string | null;
  customer_occupation?: string | null;
  funds_origin?: string | null;
  notes?: string | null;
};

export function useFxTransactionsRecent(limit = 20) {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ["fx_transactions_recent", currentOrg?.id, limit],
    queryFn: async () => {
      if (!currentOrg?.id) return [];
      const { data, error } = await supabase
        .from("fx_transactions")
        .select("*")
        .eq("organization_id", currentOrg.id)
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!currentOrg?.id,
  });
}

export function useCreateFxTransaction() {
  const { currentOrg } = useOrganization();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: FxTransactionInput) => {
      if (!currentOrg?.id) throw new Error("Sin organización");
      const { data: user } = await supabase.auth.getUser();
      const { data, error } = await supabase
        .from("fx_transactions")
        .insert({
          organization_id: currentOrg.id,
          cashier_id: user.user?.id,
          ...input,
        })
        .select("id, receipt_number, created_at")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fx_transactions_recent"] });
      toast.success("Operación FX registrada");
    },
    onError: (e: any) => toast.error(e.message ?? "Error al registrar operación"),
  });
}

/** Lee el umbral UIAF configurado en la organización. */
export function useUiafThreshold() {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ["uiaf_threshold", currentOrg?.id],
    queryFn: async (): Promise<{ amount: number; currency: string }> => {
      if (!currentOrg?.id) return { amount: 10000, currency: "USD" };
      const { data, error } = await supabase
        .from("organizations")
        .select("uiaf_threshold_amount, uiaf_threshold_currency")
        .eq("id", currentOrg.id)
        .single();
      if (error) throw error;
      return {
        amount: Number((data as any)?.uiaf_threshold_amount ?? 10000),
        currency: (data as any)?.uiaf_threshold_currency ?? "USD",
      };
    },
    enabled: !!currentOrg?.id,
    staleTime: 60_000,
  });
}
