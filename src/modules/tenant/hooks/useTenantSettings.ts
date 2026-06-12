import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";

/**
 * Lee `app_settings` para la org activa. Si la org no define una key,
 * cae al default global (organization_id IS NULL).
 *
 * Devuelve un Map { key -> value } y un helper `get(key, fallback)`.
 */
export function useTenantSettings(prefix?: string) {
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id ?? null;

  const query = useQuery({
    queryKey: ["tenant", "settings", orgId, prefix ?? "all"],
    enabled: !!orgId,
    staleTime: 60 * 1000,
    queryFn: async () => {
      if (!orgId) return new Map<string, string>();
      let q = supabase
        .from("app_settings")
        .select("key, value, organization_id")
        .or(`organization_id.eq.${orgId},organization_id.is.null`);
      if (prefix) q = q.like("key", `${prefix}%`);
      const { data, error } = await q;
      if (error) throw error;

      // Prioridad: valor de la org > valor global.
      const merged = new Map<string, string>();
      const rows = (data ?? []) as Array<{
        key: string;
        value: string;
        organization_id: string | null;
      }>;
      // primero globales, luego sobrescribe con los de la org.
      for (const r of rows.filter((r) => r.organization_id === null)) {
        merged.set(r.key, r.value);
      }
      for (const r of rows.filter((r) => r.organization_id === orgId)) {
        merged.set(r.key, r.value);
      }
      return merged;
    },
  });

  const get = (key: string, fallback = ""): string =>
    query.data?.get(key) ?? fallback;

  return { ...query, get };
}
