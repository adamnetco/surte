import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEntitlements, hasModule, getLimit } from "@/lib/entitlements/useEntitlements";

/**
 * useFeatureEnabled('kds') → boolean (false durante loading).
 */
export function useFeatureEnabled(organizationId: string | null | undefined, feature: string) {
  const { data: ent, isLoading } = useEntitlements(organizationId);
  return { enabled: hasModule(ent, feature), loading: isLoading };
}

/**
 * useLimit('max_users') → { value, used, remaining, source } resuelto.
 */
export function useLimit(organizationId: string | null | undefined, limitKey: string) {
  const { data: ent, isLoading } = useEntitlements(organizationId);
  return { limit: getLimit(ent, limitKey), loading: isLoading };
}

/**
 * useConsumeLimit() → mutation que invoca la RPC atómica `consume_limit`.
 * Maneja el error `limit_exceeded:<key>:<used>:<limit>` lanzado por Postgres.
 */
export class LimitExceededError extends Error {
  constructor(public limitKey: string, public used: number, public limit: number) {
    super(`limit_exceeded:${limitKey}:${used}:${limit}`);
    this.name = "LimitExceededError";
  }
}

export function useConsumeLimit(organizationId: string | null | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { limitKey: string; delta?: number; period?: string }) => {
      if (!organizationId) throw new Error("no_organization");
      const { data, error } = await (supabase as any).rpc("consume_limit", {
        p_org_id: organizationId,
        p_limit_key: input.limitKey,
        p_amount: input.delta ?? 1,
        p_period_key: input.period ?? "lifetime",
      });
      if (error) {
        const m = error.message?.match(/limit_exceeded:([^:]+):(\d+):(\d+)/);
        if (m) throw new LimitExceededError(m[1], Number(m[2]), Number(m[3]));
        throw error;
      }
      return data as { ok: boolean; used: number; limit: number | null; remaining: number | null };
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["entitlements", organizationId] }),
  });
}

/**
 * usePeekLimit: lectura puntual sin mutar (server-side, evita stale cache).
 */
export function usePeekLimit(organizationId: string | null | undefined, limitKey: string, period = "lifetime") {
  return useQuery({
    queryKey: ["peek_limit", organizationId, limitKey, period],
    enabled: !!organizationId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("peek_limit", {
        _org_id: organizationId,
        _limit_key: limitKey,
        _period: period,
      });
      if (error) throw error;
      return data as { limit_key: string; used: number; limit: number | null; remaining: number | null };
    },
  });
}
