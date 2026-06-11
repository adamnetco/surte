/**
 * useTenantSite — Resuelve el tenant (organización + branding) a partir del
 * hostname actual usando la RPC `resolve_tenant_by_host`.
 *
 * Devuelve `organization_id` para que las queries del storefront filtren por
 * tenant correcto (Etapa 6 del refactor SaaS multi-tenant).
 *
 * Comportamiento:
 *  - En subdominios del panel (admin/mi/pos/app/www) no resuelve tenant
 *    (devuelve `null`).
 *  - En subdominios de negocio (`<slug>.sistecpos.com`) o dominio propio
 *    verificado, consulta `tenant_domains` → `tenant_sites` y devuelve el
 *    `organization_id` asociado.
 *  - Cachea por `staleTime: 10 min` (Realtime no aplica acá).
 *  - Override por `?tenant=<slug>` heredado de `detectTenant()`.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { detectTenant, isSystemTenant } from "./subdomain";

export interface TenantSite {
  site_id: string;
  organization_id: string;
  slug: string;
  name: string | null;
  logo_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  default_locale: string | null;
  hostname: string;
  is_primary: boolean;
}

function currentHost(): string {
  if (typeof window === "undefined") return "";
  return window.location.hostname.toLowerCase();
}

export function useTenantSite() {
  const host = currentHost();
  const tenantSlug = detectTenant();
  const skipResolve = !host || isSystemTenant(tenantSlug);

  return useQuery<TenantSite | null>({
    queryKey: ["tenant-site", host, tenantSlug],
    enabled: !skipResolve,
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      // 1. Resolver por host primario
      const { data, error } = await (supabase as any).rpc("resolve_tenant_by_host", {
        _host: host,
      });
      if (error) throw error;
      if (data) return data as TenantSite;

      // 2. Fallback: resolver por slug (override `?tenant=x` o dev en lovable.app)
      if (typeof tenantSlug === "string" && tenantSlug && !isSystemTenant(tenantSlug)) {
        const { data: site } = await (supabase as any)
          .from("tenant_sites")
          .select("id, organization_id, slug, name, logo_url, primary_color, accent_color, default_locale")
          .eq("slug", tenantSlug)
          .eq("is_published", true)
          .maybeSingle();
        if (site) {
          return {
            site_id: site.id,
            organization_id: site.organization_id,
            slug: site.slug,
            name: site.name,
            logo_url: site.logo_url,
            primary_color: site.primary_color,
            accent_color: site.accent_color,
            default_locale: site.default_locale,
            hostname: host,
            is_primary: false,
          } as TenantSite;
        }
      }

      return null;
    },
  });
}

/** Helper síncrono: devuelve el organization_id si ya está en caché, o null. */
export function useTenantOrgId(): string | null {
  const { data } = useTenantSite();
  return data?.organization_id ?? null;
}
