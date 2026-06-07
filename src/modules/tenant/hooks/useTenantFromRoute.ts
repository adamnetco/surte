/**
 * useTenantFromRoute — sincroniza `OrganizationContext.currentOrg` con el
 * slug presente en la URL (`/superadmin/t/:slug/...`).
 *
 * Devuelve:
 *  - slug: el slug en la URL (o null si no aplica)
 *  - org: la organización que coincide con el slug (o currentOrg si no hay slug)
 *  - notFound: true cuando hay slug en URL pero no coincide con ninguna org
 *  - syncing: true mientras esperamos que `switchOrg` propague
 *  - loading: heredado del context
 */
import { useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";

export function useTenantFromRoute() {
  const { slug } = useParams<{ slug: string }>();
  const { orgs, currentOrg, switchOrg, loading } = useOrganization();

  const org = useMemo(
    () => (slug ? orgs.find((o) => o.slug === slug) ?? null : currentOrg),
    [slug, orgs, currentOrg],
  );

  useEffect(() => {
    if (loading) return;
    if (org && org.id !== currentOrg?.id) {
      switchOrg(org.id);
    }
  }, [org, currentOrg?.id, switchOrg, loading]);

  const notFound = !loading && !!slug && orgs.length > 0 && !org;
  const syncing = !!org && org.id !== currentOrg?.id;

  return { slug: slug ?? null, org, notFound, syncing, loading };
}
