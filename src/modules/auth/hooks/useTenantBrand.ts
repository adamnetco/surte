import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { detectTenant, isStorefrontTenant } from "@/modules/tenant/lib/subdomain";

export interface TenantBrand {
  slug: string | null;
  name: string;
  logo_url: string | null;
  loading: boolean;
}

// Cache en memoria para evitar re-fetch al cambiar de ruta dentro del mismo tenant.
const cache = new Map<string, { name: string; logo_url: string | null }>();

const FALLBACK: Omit<TenantBrand, "loading"> = {
  slug: null,
  name: "SistecPOS",
  logo_url: null,
};

/**
 * Hook que devuelve el branding del tenant actual (organización por slug).
 * - En hosts de tenant (storefront), busca el logo+nombre en `organizations`.
 * - En hosts de sistema (admin/app/www), devuelve marca SistecPOS por defecto.
 *
 * Se usa en el login de cliente para que cada tienda muestre SU identidad,
 * en lugar de la del tenant semilla.
 */
export function useTenantBrand(): TenantBrand {
  const tenant = detectTenant();
  const slug = isStorefrontTenant(tenant) ? tenant : null;

  const cached = slug ? cache.get(slug) : null;
  const [brand, setBrand] = useState<Omit<TenantBrand, "loading">>(
    cached ? { slug, ...cached } : slug ? { slug, name: slug, logo_url: null } : FALLBACK
  );
  const [loading, setLoading] = useState<boolean>(!!slug && !cached);

  useEffect(() => {
    if (!slug || cached) return;
    let alive = true;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("organizations")
          .select("name, logo_url")
          .eq("slug", slug)
          .eq("is_active", true)
          .maybeSingle();
        if (!alive) return;
        if (!error && data) {
          const value = { name: data.name ?? slug, logo_url: data.logo_url ?? null };
          cache.set(slug, value);
          setBrand({ slug, ...value });
        }
      } catch { /* offline / RLS — fallback al slug */ }
      finally { if (alive) setLoading(false); }
    })();
    return () => { alive = false; };
  }, [slug, cached]);

  return { ...brand, loading };
}
