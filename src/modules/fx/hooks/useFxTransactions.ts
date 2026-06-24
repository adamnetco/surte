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

/**
 * Slice 2 — Ola 2: dispara la facturación electrónica de la comisión
 * implícita de una operación FX. Llama a la edge `fx-emit-commission-invoice`
 * que crea un pos_order sintético y delega en `innapsis-emit`.
 */
export function useEmitFxCommissionInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (fxTransactionId: string) => {
      const { data, error } = await supabase.functions.invoke("fx-emit-commission-invoice", {
        body: { fx_transaction_id: fxTransactionId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["fx_transactions_recent"] });
      if (data?.skipped) {
        toast.info("Operación sin margen — no requiere factura.");
      } else if (data?.contingency) {
        toast.warning(`Emitida en contingencia ${data.full_number ?? ""}. Se transmitirá cuando DIAN se restaure.`);
      } else if (data?.already_emitted) {
        toast.info("Esta comisión ya fue facturada.");
      } else {
        toast.success(`Comisión facturada ${data?.full_number ?? ""}`.trim());
      }
    },
    onError: (e: any) => {
      const msg = e?.message ?? "Error al facturar comisión";
      toast.error(msg.includes("fx_tx_missing_session_or_location")
        ? "La operación no tiene sesión de caja o sede asociada."
        : msg);
    },
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
