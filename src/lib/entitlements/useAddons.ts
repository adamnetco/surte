import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Addon = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  price_cop: number;
  billing_period: "one_shot" | "monthly" | "yearly";
  icon: string | null;
  sort_order: number;
  is_active: boolean;
};

export type TenantAddon = {
  id: string;
  organization_id: string;
  addon_code: string;
  quantity: number;
  status: "pending" | "active" | "expired" | "canceled" | "failed";
  starts_at: string;
  ends_at: string | null;
  amount_paid_cop: number | null;
  wompi_transaction_id: string | null;
};

export function useAddonsCatalog() {
  return useQuery({
    queryKey: ["addons", "catalog"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Addon[]> => {
      const { data, error } = await supabase
        .from("addons" as any)
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as Addon[];
    },
  });
}

export function useTenantAddons(organizationId: string | null | undefined) {
  return useQuery({
    queryKey: ["addons", "tenant", organizationId],
    enabled: !!organizationId,
    queryFn: async (): Promise<TenantAddon[]> => {
      const { data, error } = await supabase
        .from("tenant_addons" as any)
        .select("*")
        .eq("organization_id", organizationId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as TenantAddon[];
    },
  });
}

/**
 * Reserva un add-on creando una fila `pending` en `tenant_addons`.
 * El cobro real con Wompi se completa en Slice 3 (mutación de status a 'active').
 */
export function usePurchaseAddon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      organization_id: string;
      addon: Addon;
      quantity?: number;
    }) => {
      const ends_at =
        input.addon.billing_period === "one_shot"
          ? new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString()
          : input.addon.billing_period === "yearly"
            ? new Date(Date.now() + 365 * 24 * 3600 * 1000).toISOString()
            : new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString();

      const { data, error } = await supabase
        .from("tenant_addons" as any)
        .insert({
          organization_id: input.organization_id,
          addon_code: input.addon.code,
          quantity: input.quantity ?? 1,
          status: "pending",
          amount_paid_cop: input.addon.price_cop * (input.quantity ?? 1),
          ends_at,
          metadata: { source: "self_service_ui" },
        })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as TenantAddon;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["addons", "tenant", vars.organization_id] });
      qc.invalidateQueries({ queryKey: ["entitlements", vars.organization_id] });
    },
  });
}
