import { Navigate } from "react-router-dom";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";

/**
 * Redirige /sitios (legacy global) a /superadmin/t/:slug/sitios usando el tenant activo.
 * Si no hay tenant activo, manda al selector. Evita el bug de scope desincronizado.
 */
export default function SitiosLegacyRedirect() {
  const { currentOrg, loading } = useOrganization();
  if (loading) return <div className="p-8 text-sm text-muted-foreground">Cargando…</div>;
  if (!currentOrg) return <Navigate to="/superadmin/tiendas" replace />;
  return <Navigate to={`/superadmin/t/${currentOrg.slug}/sitios`} replace />;
}
