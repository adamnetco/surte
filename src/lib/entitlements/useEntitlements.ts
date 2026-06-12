import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type EntitlementModule = {
  enabled: boolean;
  source: 'plan' | 'override' | 'none';
  name: string;
  category: string | null;
};

export type EntitlementLimit = {
  value: number | null;
  source: 'plan' | 'override';
  used: number;
  remaining: number | null;
};

export type ResolvedEntitlements = {
  organization_id: string;
  modules: Record<string, EntitlementModule>;
  limits: Record<string, EntitlementLimit>;
  resolved_at: string;
};

/**
 * Resolves the entitlements (modules + limits) for an organization,
 * combining the active plan with tenant overrides and usage counters.
 */
export function useEntitlements(organizationId: string | null | undefined) {
  return useQuery({
    queryKey: ['entitlements', organizationId],
    enabled: !!organizationId,
    staleTime: 60_000,
    queryFn: async (): Promise<ResolvedEntitlements> => {
      const { data, error } = await supabase.functions.invoke('resolve-entitlements', {
        method: 'GET',
        // edge function reads organization_id from the URL — pass via query string
        // supabase-js doesn't support GET query params on invoke directly, so use a direct fetch fallback
      } as any);

      if (error || !data) {
        // Fallback: query the views directly through PostgREST (RLS protected)
        const [m, l, c] = await Promise.all([
          supabase.from('v_tenant_entitlements_modules' as any).select('*').eq('organization_id', organizationId!),
          supabase.from('v_tenant_entitlements_limits' as any).select('*').eq('organization_id', organizationId!),
          supabase.from('tenant_usage_counters').select('limit_key, period_key, used').eq('organization_id', organizationId!),
        ]);

        const modules: ResolvedEntitlements['modules'] = {};
        ((m.data as any[]) ?? []).forEach((row) => {
          modules[row.module_key] = {
            enabled: row.enabled, source: row.source, name: row.module_name, category: row.category,
          };
        });

        const limits: ResolvedEntitlements['limits'] = {};
        ((l.data as any[]) ?? []).forEach((row) => {
          const used = ((c.data as any[]) ?? []).find(
            (cc) => cc.limit_key === row.limit_key && cc.period_key === 'lifetime',
          )?.used ?? 0;
          const value = row.effective_value;
          limits[row.limit_key] = {
            value, source: row.source, used: Number(used),
            remaining: value == null ? null : Math.max(0, Number(value) - Number(used)),
          };
        });

        return {
          organization_id: organizationId!, modules, limits, resolved_at: new Date().toISOString(),
        };
      }

      return data as ResolvedEntitlements;
    },
  });
}

export function hasModule(ent: ResolvedEntitlements | undefined, key: string): boolean {
  return !!ent?.modules[key]?.enabled;
}

export function getLimit(ent: ResolvedEntitlements | undefined, key: string): EntitlementLimit | null {
  return ent?.limits[key] ?? null;
}
