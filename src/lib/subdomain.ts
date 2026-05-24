/**
 * Subdomain / tenant detection for SistecPOS multi-domain architecture.
 *
 * Hosts:
 *   admin.sistecpos.com → 'admin'  (AdminDashboard)
 *   mi.sistecpos.com    → 'mi'     (Portal de Clientes)
 *   pos.sistecpos.com   → 'pos'    (POSWorkspace)
 *   app.sistecpos.com   → 'app'    (Dashboard general)
 *   sistecpos.com / www → 'www'    (Sitio público — fallback al 'app')
 *
 * Dev (localhost, *.lovable.app preview) → 'app' por defecto.
 * Override manual: añadir ?tenant=mi|admin|pos|app a la URL.
 */
export type Tenant = "admin" | "mi" | "pos" | "app" | "www";

const VALID: Tenant[] = ["admin", "mi", "pos", "app", "www"];

export function detectTenant(): Tenant {
  if (typeof window === "undefined") return "app";

  // 1. Query override (útil en dev / preview)
  try {
    const qp = new URLSearchParams(window.location.search).get("tenant");
    if (qp && (VALID as string[]).includes(qp)) {
      sessionStorage.setItem("sps_tenant_override", qp);
      return qp as Tenant;
    }
    const stored = sessionStorage.getItem("sps_tenant_override");
    if (stored && (VALID as string[]).includes(stored)) return stored as Tenant;
  } catch {
    // ignore
  }

  const host = window.location.hostname.toLowerCase();

  // 2. Dev / preview → app
  if (
    host === "localhost" ||
    host.startsWith("127.") ||
    host.endsWith(".lovable.app") ||
    host.endsWith(".lovable.dev")
  ) {
    return "app";
  }

  // 3. Producción
  const first = host.split(".")[0];
  if ((VALID as string[]).includes(first)) return first as Tenant;
  return "www";
}

export const isTenant = (...t: Tenant[]) => t.includes(detectTenant());
