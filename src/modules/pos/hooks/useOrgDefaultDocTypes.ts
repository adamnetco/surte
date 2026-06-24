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
 * Lee los defaults por tipo de cliente desde `einvoice_configs` para la organización.
 * Realtime UPDATE refresca el cache. Cache local hasta cambio de pestaña.
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
      const { data } = await supabase
        .from("einvoice_configs")
        .select("default_doc_type_consumer_final, default_doc_type_with_nit, default_doc_type_fx_operation")
        .eq("organization_id", organizationId)
        .eq("environment", "prod")
        .maybeSingle();
      if (cancelled) return;
      const next: OrgDefaultDocTypes = {
        consumerFinal: (data as any)?.default_doc_type_consumer_final ?? FALLBACK.consumerFinal,
        withNit: (data as any)?.default_doc_type_with_nit ?? FALLBACK.withNit,
        fxOperation: (data as any)?.default_doc_type_fx_operation ?? FALLBACK.fxOperation,
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
