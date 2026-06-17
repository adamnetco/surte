import { useSearchParams } from "react-router-dom";
import Sitios from "./Sitios";

/**
 * Wrapper de Sitios montado bajo /superadmin/t/:slug/sitios.
 * - El slug en URL es la fuente de verdad del tenant (sincronizado por RequireActiveTenant).
 * - Soporta ?tab=domains|sites|cloudflare para deep-link desde TenantHealth.
 */
export default function SitiosTenantRoute() {
  const [params] = useSearchParams();
  const tab = params.get("tab") ?? "sites";
  return <Sitios embedded initialTab={tab} />;
}
