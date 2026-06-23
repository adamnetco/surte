import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { toast } from "sonner";

export type FxBalanceEntry = {
  opening: number;
  expected: number;
  counted: number | null;
  diff: number | null;
};

export type FxBalances = Record<string, FxBalanceEntry>;

export type FxDenomination = {
  id: string;
  value: number;
  kind: string;
  currency: string;
};

/** Sesión de caja activa para la org (multi-divisa). */
export function useActiveFxCashSession() {
  const { currentOrg } = useOrganization();
  return useQuery({
    queryKey: ["fx_active_session", currentOrg?.id],
    queryFn: async () => {
      if (!currentOrg?.id) return null;
      const { data, error } = await supabase
        .from("cash_sessions")
        .select("id, opening_amount, balances, status, opened_at, notes")
        .eq("organization_id", currentOrg.id)
        .eq("status", "open")
        .order("opened_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as
        | {
            id: string;
            opening_amount: number;
            balances: FxBalances;
            status: string;
            opened_at: string;
            notes: string | null;
          }
        | null;
    },
    enabled: !!currentOrg?.id,
    refetchInterval: 15_000,
  });
}

/** Denominaciones agrupadas por divisa. */
export function useFxDenominations() {
  return useQuery({
    queryKey: ["fx_denominations"],
    queryFn: async (): Promise<FxDenomination[]> => {
      const { data, error } = await supabase
        .from("cash_denominations")
        .select("id,value,kind,currency")
        .eq("is_active", true)
        .order("currency")
        .order("value", { ascending: false });
      if (error) throw error;
      return (data ?? []) as FxDenomination[];
    },
    staleTime: 5 * 60_000,
  });
}

/** Cierre multi-divisa. */
export function useCloseFxSession() {
  const qc = useQueryClient();
  const { currentOrg } = useOrganization();
  return useMutation({
    mutationFn: async (input: {
      sessionId: string;
      counts: { denomination_id: string; currency: string; quantity: number }[];
      notes?: string;
    }) => {
      const { data, error } = await supabase.rpc("close_cash_session_multi_currency", {
        _session_id: input.sessionId,
        _counts: input.counts as any,
        _notes: input.notes ?? null,
      });
      if (error) throw error;
      return data as FxBalances;
    },
    onSuccess: () => {
      toast.success("Caja FX cerrada");
      qc.invalidateQueries({ queryKey: ["fx_active_session", currentOrg?.id] });
      qc.invalidateQueries({ queryKey: ["fx_transactions_recent"] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Error al cerrar caja"),
  });
}

/** Apertura: fija opening + expected por divisa. */
export function useOpenFxSession() {
  const qc = useQueryClient();
  const { currentOrg } = useOrganization();
  return useMutation({
    mutationFn: async (input: {
      locationId: string;
      cashRegisterId: string;
      openingBalances: Record<string, number>;
    }) => {
      if (!currentOrg?.id) throw new Error("Sin organización");
      const userResp = await supabase.auth.getUser();
      const userId = userResp.data.user?.id;
      const balances: FxBalances = {};
      for (const [code, amt] of Object.entries(input.openingBalances)) {
        balances[code] = { opening: amt, expected: amt, counted: null, diff: null };
      }
      const copOpening = input.openingBalances["COP"] ?? 0;
      const { data, error } = await supabase
        .from("cash_sessions")
        .insert({
          organization_id: currentOrg.id,
          location_id: input.locationId,
          cash_register_id: input.cashRegisterId,
          opened_by: userId ?? null,
          opening_amount: copOpening,
          expected_amount: copOpening,
          balances: balances as any,
          status: "open",
        })
        .select("id")
        .single();
      if (error) throw error;
      return data.id as string;
    },
    onSuccess: () => {
      toast.success("Caja FX abierta");
      qc.invalidateQueries({ queryKey: ["fx_active_session", currentOrg?.id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Error al abrir caja"),
  });
}
