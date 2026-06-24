import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type ResolutionStatus =
  | "ok"            // todo configurado y dentro de rango
  | "missing"       // no hay número/prefijo/from-to
  | "exhausted"     // current >= to
  | "near_limit"    // queda <= 5% del rango
  | "inactive"      // is_active = false
  | "unknown";

export interface ResolutionSnapshot {
  status: ResolutionStatus;
  remaining: number | null;
  total: number | null;
  resolutionNumber: string | null;
  prefix: string | null;
}

const EMPTY: ResolutionSnapshot = {
  status: "unknown",
  remaining: null,
  total: null,
  resolutionNumber: null,
  prefix: null,
};

function parse(row: any): ResolutionSnapshot {
  if (!row) return EMPTY;
  if (!row.is_active) {
    return { ...EMPTY, status: "inactive", resolutionNumber: row.resolution_number ?? null, prefix: row.resolution_prefix ?? null };
  }
  const num = row.resolution_number;
  const from = Number(row.resolution_from ?? 0);
  const to = Number(row.resolution_to ?? 0);
  const current = Number(row.resolution_current ?? from);
  if (!num || !from || !to || to <= from) {
    return { ...EMPTY, status: "missing", resolutionNumber: num ?? null, prefix: row.resolution_prefix ?? null };
  }
  const total = to - from + 1;
  const remaining = Math.max(0, to - current);
  let status: ResolutionStatus = "ok";
  if (remaining <= 0) status = "exhausted";
  else if (remaining / total <= 0.05) status = "near_limit";
  return { status, remaining, total, resolutionNumber: num, prefix: row.resolution_prefix ?? null };
}

/**
 * AC14: Lee `einvoice_configs` para saber si la organización tiene resolución DIAN
 * vigente, próxima a vencerse o agotada. Realtime para actualizar el banner sin recargar.
 */
export function useEinvoiceResolutionStatus(organizationId: string | null | undefined): ResolutionSnapshot {
  const [snap, setSnap] = useState<ResolutionSnapshot>(EMPTY);

  useEffect(() => {
    if (!organizationId) { setSnap(EMPTY); return; }
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("einvoice_configs")
        .select("is_active, resolution_number, resolution_prefix, resolution_from, resolution_to, resolution_current, environment")
        .eq("organization_id", organizationId)
        .eq("environment", "prod")
        .maybeSingle();
      if (!cancelled) setSnap(parse(data));
    })();

    const channel = supabase
      .channel(`einvoice-cfg-${organizationId}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "einvoice_configs", filter: `organization_id=eq.${organizationId}` },
        (payload) => setSnap(parse(payload.new)),
      )
      .subscribe();

    return () => { cancelled = true; supabase.removeChannel(channel); };
  }, [organizationId]);

  return snap;
}
