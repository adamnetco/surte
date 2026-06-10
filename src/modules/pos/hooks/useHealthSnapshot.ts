import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

export type HealthStatus = "ok" | "warn" | "off" | "unknown";

export interface SiteHealth {
  id: string;
  slug: string;
  name: string;
  is_published: boolean;
  last_sync_at: string | null;
  hostname: string | null;
  cf_status: string | null;
  cf_ssl_status: string | null;
  domain_verified: boolean;
  wp_configured: boolean;
  wp_host: string | null;
}

export interface HealthSnapshot {
  version: string;
  generated_at: string;
  cached?: boolean;
  core: { status: HealthStatus; latency_ms: number; checked_at: string; error?: string };
  sites: { total: number; published: number; last_sync_at: string | null; items: SiteHealth[] };
  wp: { connected: boolean; errors: string[] };
}

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
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke<HealthSnapshot>("health-snapshot", {
        body: { organization_id: organizationId },
      });
      if (error) {
        logger.warn("health-snapshot failed", { organizationId, message: error.message });
        throw error;
      }
      if (!data) throw new Error("health-snapshot: empty response");
      return data;
    },
  });
}
