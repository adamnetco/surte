import { useSearchParams } from "react-router-dom";
import Sitios from "./Sitios";

/**
 * Wrapper de Sitios montado bajo /superadmin/t/:slug/sitios.
 * - El slug en URL es la fuente de verdad del tenant (sincronizado por RequireActiveTenant).
 * - Soporta ?tab=domains|sites|cloudflare para deep-link desde TenantHealth.
 * - Soporta ?focus=<tenant_domains.id> para resaltar y hacer scroll a un dominio
 *   específico cuando se entra desde el checklist de TenantHealth.
 */
export default function SitiosTenantRoute() {
  const [params] = useSearchParams();
  const tab = params.get("tab") ?? "sites";
  const focus = params.get("focus") ?? null;
  return <Sitios embedded initialTab={tab} initialFocus={focus} />;
}
