/**
 * useTenantFromRoute — sincroniza `OrganizationContext.currentOrg` con el
 * slug presente en la URL (`/superadmin/t/:slug/...`).
 *
 * Devuelve `{ slug, org, mismatch }` para que la vista pueda mostrar un
 * banner si por alguna razón el slug no coincide con la tienda activa.
 */
import { useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useOrganization } from "@/context/OrganizationContext";

export function useTenantFromRoute() {
  const { slug } = useParams<{ slug: string }>();
  const { orgs, currentOrg, switchOrg, loading } = useOrganization();

  const org = useMemo(
    () => (slug ? orgs.find((o) => o.slug === slug) ?? null : currentOrg),
    [slug, orgs, currentOrg]
  );

  useEffect(() => {
    if (loading) return;
    if (org && org.id !== currentOrg?.id) {
      switchOrg(org.id);
    }
  }, [org, currentOrg?.id, switchOrg, loading]);

  const mismatch = !!slug && !!currentOrg && !!org && org.id !== currentOrg.id;

  return { slug: slug ?? null, org, mismatch, loading };
}
