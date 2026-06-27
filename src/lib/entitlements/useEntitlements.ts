import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type EntitlementModule = {
  enabled: boolean;
  source: 'plan' | 'override' | 'none';
  name?: string;
  category?: string | null;
  quota?: number | null;
};

export type EntitlementLimit = {
  value: number | null;
  source: 'plan' | 'override';
  used?: number;
  remaining?: number | null;
};

export type SubscriptionStatus =
  | 'active' | 'trialing' | 'past_due' | 'canceled' | 'pending' | 'paused' | 'none';

export type ResolvedEntitlements = {
  organization_id: string;
  plan_key: string;
  plan_name?: string | null;
  status: SubscriptionStatus;
  active: boolean;
  trial_ends_at: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  modules: Record<string, EntitlementModule>;
  limits: Record<string, EntitlementLimit>;
  resolved_at: string;
};

/**
 * Resuelve entitlements de una organización combinando plan + overrides + estado de suscripción.
 * Prioridad de fuente:
 *  1. RPC `resolve_entitlements` (preferido — incluye status/trial)
 *  2. Edge `resolve-entitlements` (legacy con usage counters)
 *  3. Vistas + counters directos (último recurso)
 */
export function useEntitlements(organizationId: string | null | undefined) {
  return useQuery({
    queryKey: ['entitlements', organizationId],
    enabled: !!organizationId,
    staleTime: 60_000,
    queryFn: async (): Promise<ResolvedEntitlements> => {
      // 1) RPC preferida
      const rpc = await supabase.rpc('resolve_entitlements' as any, { p_org_id: organizationId! });
      if (!rpc.error && rpc.data) {
        return normalizeRpc(rpc.data as any, organizationId!);
      }

      // 2) Edge legacy
      const ef = await supabase.functions.invoke('resolve-entitlements', {
        body: { organization_id: organizationId },
      });
      if (!ef.error && ef.data) {
        return normalizeLegacy(ef.data as any, organizationId!);
      }

      // 3) Vistas + counters
      const [m, l, c] = await Promise.all([
        supabase.from('v_tenant_entitlements_modules' as any).select('*').eq('organization_id', organizationId!),
        supabase.from('v_tenant_entitlements_limits' as any).select('*').eq('organization_id', organizationId!),
        supabase.from('tenant_usage_counters').select('limit_key, period_key, used').eq('organization_id', organizationId!),
      ]);

      const modules: ResolvedEntitlements['modules'] = {};
      ((m.data as any[]) ?? []).forEach((row) => {
        modules[row.module_key] = {
          enabled: !!row.enabled, source: row.source, name: row.module_name, category: row.category,
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
        organization_id: organizationId!,
        plan_key: 'free',
        status: 'none',
        active: false,
        trial_ends_at: null,
        current_period_end: null,
        cancel_at_period_end: false,
        modules, limits,
        resolved_at: new Date().toISOString(),
      };
    },
  });
}

function normalizeRpc(d: any, orgId: string): ResolvedEntitlements {
  const modules: Record<string, EntitlementModule> = {};
  Object.entries(d.modules ?? {}).forEach(([k, v]: any) => {
    modules[k] = { enabled: !!v?.enabled, source: v?.source ?? 'plan', quota: v?.quota ?? null };
  });
  const limits: Record<string, EntitlementLimit> = {};
  Object.entries(d.limits ?? {}).forEach(([k, v]: any) => {
    const value = v?.value ?? null;
    limits[k] = { value, source: v?.source ?? 'plan', used: 0, remaining: value };
  });
  return {
    organization_id: orgId,
    plan_key: d.plan_key ?? 'free',
    plan_name: d.plan_name ?? null,
    status: (d.status ?? 'none') as SubscriptionStatus,
    active: !!d.active,
    trial_ends_at: d.trial_ends_at ?? null,
    current_period_end: d.current_period_end ?? null,
    cancel_at_period_end: !!d.cancel_at_period_end,
    modules, limits,
    resolved_at: d.resolved_at ?? new Date().toISOString(),
  };
}

function normalizeLegacy(d: any, orgId: string): ResolvedEntitlements {
  return {
    organization_id: orgId,
    plan_key: d.plan_key ?? 'free',
    status: (d.status ?? 'none') as SubscriptionStatus,
    active: d.active ?? true,
    trial_ends_at: d.trial_ends_at ?? null,
    current_period_end: d.current_period_end ?? null,
    cancel_at_period_end: !!d.cancel_at_period_end,
    modules: d.modules ?? {},
    limits: d.limits ?? {},
    resolved_at: d.resolved_at ?? new Date().toISOString(),
  };
}

export function hasModule(ent: ResolvedEntitlements | undefined, key: string): boolean {
  if (!ent) return false;
  // Sin suscripción activa, sólo permitimos módulos marcados explícitamente como override
  const m = ent.modules[key];
  if (!m) return false;
  if (m.source === 'override') return m.enabled;
  return m.enabled && ent.active;
}

export function getLimit(ent: ResolvedEntitlements | undefined, key: string): EntitlementLimit | null {
  return ent?.limits[key] ?? null;
}

export function trialDaysLeft(ent: ResolvedEntitlements | undefined): number | null {
  if (!ent?.trial_ends_at) return null;
  const diff = new Date(ent.trial_ends_at).getTime() - Date.now();
  if (diff <= 0) return 0;
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}
