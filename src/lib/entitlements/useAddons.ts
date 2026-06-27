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
 * Reserva un add-on y abre Wompi Web Checkout en una pestaña nueva.
 * El webhook `wompi-events` activa el add-on (status=pending → active) al recibir APPROVED.
 */
export function usePurchaseAddon() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      organization_id: string;
      addon: Addon;
      quantity?: number;
      return_url?: string;
    }) => {
      const returnUrl =
        input.return_url ??
        `${window.location.origin}/billing?from=wompi&return_to=${encodeURIComponent("/planes")}`;

      const { data, error } = await supabase.functions.invoke("wompi-purchase-addon", {
        body: {
          organization_id: input.organization_id,
          addon_code: input.addon.code,
          quantity: input.quantity ?? 1,
          return_url: returnUrl,
        },
      });
      if (error) throw error;
      if (!data?.checkout_url) throw new Error("No se obtuvo checkout_url de Wompi");

      // Abre el checkout (nueva pestaña para no perder estado de la app)
      window.open(data.checkout_url, "_blank", "noopener,noreferrer");
      return data as { reference: string; tenant_addon_id: string; checkout_url: string };
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["addons", "tenant", vars.organization_id] });
      qc.invalidateQueries({ queryKey: ["entitlements", vars.organization_id] });
    },
  });
}

