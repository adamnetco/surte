import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface OrgDefaultDocTypes {
  consumerFinal: string;
  withNit: string;
  fxOperation: string;
  loading: boolean;
}

const FALLBACK: OrgDefaultDocTypes = {
  consumerFinal: "pos_electronico",
  withNit: "factura_electronica",
  fxOperation: "documento_soporte",
  loading: false,
};

const cache = new Map<string, OrgDefaultDocTypes>();

/**
 * POS-einvoice-default-doctype-by-business
 * Lee los defaults por tipo de cliente desde `einvoice_configs`.
 *
 * Selección de fila:
 *  1. is_active = true (cualquier environment)
 *  2. Fallback: la fila más reciente por organization_id
 * Esto cubre tenants en sandbox DIAN (`environment='dev'`) y en producción (`prod`).
 */
export function useOrgDefaultDocTypes(organizationId: string | null | undefined): OrgDefaultDocTypes {
  const [snap, setSnap] = useState<OrgDefaultDocTypes>(() => {
    if (!organizationId) return { ...FALLBACK, loading: false };
    return cache.get(organizationId) ?? { ...FALLBACK, loading: true };
  });

  useEffect(() => {
    if (!organizationId) {
      setSnap({ ...FALLBACK, loading: false });
      return;
    }
    let cancelled = false;
    const cached = cache.get(organizationId);
    if (cached) setSnap(cached);
    else setSnap((s) => ({ ...s, loading: true }));

    (async () => {
      // Preferimos la fila activa; si no existe, la más reciente (cubre setups en `dev`).
      const { data: rows } = await supabase
        .from("einvoice_configs")
        .select(
          "default_doc_type_consumer_final, default_doc_type_with_nit, default_doc_type_fx_operation, is_active, updated_at",
        )
        .eq("organization_id", organizationId)
        .order("is_active", { ascending: false })
        .order("updated_at", { ascending: false })
        .limit(1);
      if (cancelled) return;
      const row = rows?.[0] as any;
      const next: OrgDefaultDocTypes = {
        consumerFinal: row?.default_doc_type_consumer_final ?? FALLBACK.consumerFinal,
        withNit: row?.default_doc_type_with_nit ?? FALLBACK.withNit,
        fxOperation: row?.default_doc_type_fx_operation ?? FALLBACK.fxOperation,
        loading: false,
      };
      cache.set(organizationId, next);
      setSnap(next);
    })();

    const channel = supabase
      .channel(`einvoice-defaults-${organizationId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "einvoice_configs", filter: `organization_id=eq.${organizationId}` },
        (payload) => {
          const row = payload.new as any;
          const next: OrgDefaultDocTypes = {
            consumerFinal: row?.default_doc_type_consumer_final ?? FALLBACK.consumerFinal,
            withNit: row?.default_doc_type_with_nit ?? FALLBACK.withNit,
            fxOperation: row?.default_doc_type_fx_operation ?? FALLBACK.fxOperation,
            loading: false,
          };
          cache.set(organizationId, next);
          setSnap(next);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [organizationId]);

  return snap;
}

/** Test-only: limpia el cache module-scope entre tests. */
export function __resetOrgDefaultDocTypesCache() {
  cache.clear();
}
