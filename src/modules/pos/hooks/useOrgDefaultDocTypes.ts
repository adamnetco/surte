import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabaseDocumentTypesRepository } from "@/infrastructure/database/SupabaseDocumentTypesRepository";

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
  const row = await supabaseDocumentTypesRepository.getEinvoiceDefaults(orgId);
  return {
    consumerFinal: row.consumerFinal ?? FALLBACK.consumerFinal,
    withNit: row.withNit ?? FALLBACK.withNit,
    fxOperation: row.fxOperation ?? FALLBACK.fxOperation,
  };
}

/**
 * POS-einvoice-default-doctype-by-business
 * Lee defaults DIAN por tipo de cliente vía `supabaseDocumentTypesRepository`
 * (Fase 2 hexagonal).
 * - React Query con key `["einvoice-defaults", orgId]` → cache por-org.
 * - Realtime UPDATE invalida la query mediante el puerto.
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
    const unsubscribe = supabaseDocumentTypesRepository.subscribeEinvoiceDefaultsChanges(
      organizationId,
      () => qc.invalidateQueries({ queryKey: queryKey(organizationId) }),
    );
    return unsubscribe;
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
