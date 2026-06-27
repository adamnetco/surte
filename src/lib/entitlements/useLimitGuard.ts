import { useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

export type LimitDecision = {
  allowed: boolean;
  reason?: "limit_exceeded" | "forbidden";
  limit?: number | null;
  used?: number;
  remaining?: number | null;
  period?: string;
};

/**
 * useLimitGuard — wrap acciones que consumen cuota.
 * Atómico vía RPC consume_limit: si hay cupo, incrementa y registra usage_event;
 * si no, registra denial y emite toast con CTA a /planes.
 */
export function useLimitGuard() {
  const { currentOrg } = useOrganization();
  const qc = useQueryClient();
  const navigate = useNavigate();

  const consume = useCallback(
    async (limitKey: string, amount = 1, opts?: { silent?: boolean; period?: string }): Promise<LimitDecision> => {
      if (!currentOrg?.id) return { allowed: false, reason: "forbidden" };
      const { data, error } = await supabase.rpc("consume_limit" as any, {
        p_org_id: currentOrg.id,
        p_limit_key: limitKey,
        p_amount: amount,
        p_period_key: opts?.period ?? "lifetime",
      });
      if (error) {
        if (!opts?.silent) toast.error("No se pudo validar el límite: " + error.message);
        return { allowed: false, reason: "forbidden" };
      }
      const d = (data ?? {}) as LimitDecision;
      if (!d.allowed && !opts?.silent) {
        toast.error(
          d.reason === "limit_exceeded"
            ? `Alcanzaste tu cupo de ${limitKey} (${d.used}/${d.limit}). Mejora tu plan para continuar.`
            : "Acceso denegado",
          {
            action: d.reason === "limit_exceeded"
              ? { label: "Ver planes", onClick: () => navigate(`/planes?reason=${limitKey}`) }
              : undefined,
          }
        );
      }
      if (d.allowed) qc.invalidateQueries({ queryKey: ["entitlements", currentOrg.id] });
      return d;
    },
    [currentOrg?.id, qc, navigate]
  );

  const logDenial = useCallback(
    async (kind: "module" | "subscription" | "limit", key: string, reason?: string) => {
      if (!currentOrg?.id) return;
      await supabase.rpc("gate_denial" as any, {
        p_org_id: currentOrg.id,
        p_kind: kind,
        p_key: key,
        p_reason: reason ?? null,
        p_context: {},
      });
    },
    [currentOrg?.id]
  );

  return { consume, logDenial };
}
