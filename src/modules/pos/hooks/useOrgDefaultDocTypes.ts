import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface OrgDefaultDocTypes {
  consumerFinal: string;
  withNit: string;
  fxOperation: string;
  loading: boolean;
}

const FALLBACK = {
  consumerFinal: "pos_electronico",
  withNit: "factura_electronica",
  fxOperation: "documento_soporte",
} as const;

const queryKey = (orgId: string) => ["einvoice-defaults", orgId] as const;

async function fetchDefaults(orgId: string): Promise<Omit<OrgDefaultDocTypes, "loading">> {
  // Preferimos la fila activa; si no existe, la más reciente (cubre sandbox `dev`).
  const { data } = await supabase
    .from("einvoice_configs")
    .select(
      "default_doc_type_consumer_final, default_doc_type_with_nit, default_doc_type_fx_operation, is_active, updated_at",
    )
    .eq("organization_id", orgId)
    .order("is_active", { ascending: false })
    .order("updated_at", { ascending: false })
    .limit(1);
  const row = data?.[0] as any;
  return {
    consumerFinal: row?.default_doc_type_consumer_final ?? FALLBACK.consumerFinal,
    withNit: row?.default_doc_type_with_nit ?? FALLBACK.withNit,
    fxOperation: row?.default_doc_type_fx_operation ?? FALLBACK.fxOperation,
  };
}

/**
 * POS-einvoice-default-doctype-by-business
 * Lee defaults DIAN por tipo de cliente desde `einvoice_configs`.
 * - React Query con key `["einvoice-defaults", orgId]` → cache por-org, invalidación correcta al cambiar de tenant.
 * - Realtime UPDATE invalida la query.
 * - Fallback estándar si la org no tiene config.
 */
export function useOrgDefaultDocTypes(organizationId: string | null | undefined): OrgDefaultDocTypes {
  const qc = useQueryClient();
  const enabled = !!organizationId;

  const { data, isLoading } = useQuery({
    queryKey: enabled ? queryKey(organizationId!) : ["einvoice-defaults", "_disabled_"],
    queryFn: () => fetchDefaults(organizationId!),
    enabled,
    staleTime: 5 * 60_000,
  });

  useEffect(() => {
    if (!organizationId) return;
    const channel = supabase
      .channel(`einvoice-defaults-${organizationId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "einvoice_configs", filter: `organization_id=eq.${organizationId}` },
        () => {
          qc.invalidateQueries({ queryKey: queryKey(organizationId) });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId, qc]);

  return {
    consumerFinal: data?.consumerFinal ?? FALLBACK.consumerFinal,
    withNit: data?.withNit ?? FALLBACK.withNit,
    fxOperation: data?.fxOperation ?? FALLBACK.fxOperation,
    loading: enabled && isLoading,
  };
}

/** Test-only: stub retained for backwards compat with existing test file. */
export function __resetOrgDefaultDocTypesCache() {
  // React Query maneja el cache; los tests crean un QueryClient nuevo por test.
}
