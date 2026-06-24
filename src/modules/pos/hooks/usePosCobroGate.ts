import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDianHealth } from "./useDianHealth";

/**
 * POS-einvoice-hard-block-policy — AC3/AC4/AC5
 *
 * Gate de "Cobrar" en el POS. Combina:
 *  - DIAN health (useDianHealth)
 *  - Existencia de rango de contingencia vigente (useDianHealth.hasContingencyRange)
 *  - Flag `einvoice_configs.hard_block_when_dian_down`
 *  - Tipo de documento seleccionado (recibo interno = bypass siempre, AC4)
 *  - Override por sesión (sessionStorage, TTL 30 min, AC5)
 */

export type CobroReason =
  | "ok"
  | "dian_down_no_contingency"
  | "override_active";

export interface PosCobroGate {
  canCharge: boolean;
  reason: CobroReason;
  overrideActive: boolean;
  loading: boolean;
  /** Activa override por 30 min y registra auditoría en sync_logs. Solo debe llamarse si user es superadmin. */
  activateOverride: () => Promise<void>;
}

const OVERRIDE_TTL_MS = 30 * 60 * 1000;
const overrideKey = (orgId: string) => `pos:hard_block_override:${orgId}`;

function readOverride(orgId: string): boolean {
  try {
    const raw = sessionStorage.getItem(overrideKey(orgId));
    if (!raw) return false;
    const ts = Number(raw);
    if (!Number.isFinite(ts)) return false;
    if (Date.now() - ts > OVERRIDE_TTL_MS) {
      sessionStorage.removeItem(overrideKey(orgId));
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

const BYPASS_DOC_TYPES = new Set(["recibo_interno", "sin_dian", "ticket_pos"]);

export function usePosCobroGate(
  organizationId: string | null | undefined,
  docType?: string | null,
): PosCobroGate {
  const dian = useDianHealth(organizationId ?? null);
  const [hardBlock, setHardBlock] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [overrideActive, setOverrideActive] = useState<boolean>(
    organizationId ? readOverride(organizationId) : false,
  );

  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("einvoice_configs")
        .select("hard_block_when_dian_down")
        .eq("organization_id", organizationId)
        .eq("environment", "prod")
        .maybeSingle();
      if (cancelled) return;
      setHardBlock(!!(data as any)?.hard_block_when_dian_down);
      setLoading(false);
    })();

    const channel = supabase
      .channel(`hard-block-${organizationId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "einvoice_configs",
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) =>
          setHardBlock(!!(payload.new as any)?.hard_block_when_dian_down),
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [organizationId]);

  // Refrescar override cuando cambia la org o cuando se monta.
  useEffect(() => {
    if (!organizationId) return;
    setOverrideActive(readOverride(organizationId));
    const i = setInterval(() => {
      setOverrideActive(readOverride(organizationId));
    }, 60_000);
    return () => clearInterval(i);
  }, [organizationId]);

  const activateOverride = useCallback(async () => {
    if (!organizationId) return;
    try {
      sessionStorage.setItem(overrideKey(organizationId), String(Date.now()));
    } catch {
      /* storage no disponible */
    }
    setOverrideActive(true);
    const { data: userData } = await supabase.auth.getUser();
    await supabase.from("sync_logs").insert({
      organization_id: organizationId,
      service_name: "pos_hard_block_override",
      status: "warning",
      payload: {
        user_id: userData?.user?.id ?? null,
        dian_health: dian.health,
        has_contingency: dian.hasContingencyRange,
        activated_at: new Date().toISOString(),
        ttl_minutes: 30,
      } as any,
    } as any);
  }, [organizationId, dian.health, dian.hasContingencyRange]);

  // Resolver gate.
  let canCharge = true;
  let reason: CobroReason = "ok";

  const isBypassDoc = !!docType && BYPASS_DOC_TYPES.has(docType);
  const dianDown = dian.health === "offline" || dian.health === "degraded";
  const shouldBlock =
    hardBlock && dianDown && !dian.hasContingencyRange && !isBypassDoc;

  if (shouldBlock) {
    if (overrideActive) {
      canCharge = true;
      reason = "override_active";
    } else {
      canCharge = false;
      reason = "dian_down_no_contingency";
    }
  }

  return { canCharge, reason, overrideActive, loading, activateOverride };
}
