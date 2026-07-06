import { useQuery } from "@tanstack/react-query";
import { supabaseHealthRepository } from "@/infrastructure/database/SupabaseHealthRepository";
import type { HealthSnapshot, HealthStatus, SiteHealth } from "@/core/ports/IHealthRepository";

export type { HealthStatus, SiteHealth, HealthSnapshot };

/**
 * Polls the unified health-snapshot edge function with:
 *  - staleTime 15s + refetchInterval 20s for a near-real-time feel
 *  - exponential backoff on failure (20s -> max 5min) via React Query retryDelay
 *  - keepPreviousData so a transient failure does not blank out the bar
 *
 * Returns a stable shape: callers should `select` the slice they need to
 * minimise re-renders.
 */
export function useHealthSnapshot(organizationId: string | undefined) {
  return useQuery<HealthSnapshot>({
    queryKey: ["health-snapshot", organizationId],
    enabled: !!organizationId,
    staleTime: 15_000,
    refetchInterval: 20_000,
    refetchOnWindowFocus: true,
    placeholderData: (prev) => prev,
    retry: 4,
    retryDelay: (attempt) => Math.min(20_000 * 2 ** attempt, 5 * 60_000),
    queryFn: () => supabaseHealthRepository.getSnapshot(organizationId!),
  });
}
