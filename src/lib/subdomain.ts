/**
 * Subdomain / tenant detection for SistecPOS multi-domain architecture.
 *
 * Hosts del **panel SistecPOS** (control SaaS):
 *   admin.sistecpos.com → 'admin'  (AdminDashboard)
 *   mi.sistecpos.com    → 'mi'     (Portal de Clientes SistecPOS)
 *   pos.sistecpos.com   → 'pos'    (POSWorkspace)
 *   app.sistecpos.com   → 'app'    (Login portal / dashboard general)
 *   sistecpos.com / www → 'www'    (Login portal público)
 *
 * Hosts de **tenants** (cada negocio cliente):
 *   surteya.sistecpos.com  → tenant slug 'surteya' (storefront del negocio)
 *   <slug>.sistecpos.com   → tenant slug genérico (futuros negocios)
 *
 * Dev (localhost, *.lovable.app preview) → 'app' por defecto.
 * Override manual: añadir ?tenant=mi|admin|pos|app|surteya|<slug> a la URL.
 */
export type SystemTenant = "admin" | "mi" | "pos" | "app" | "www";
// Storefront tenant = cualquier slug de negocio (surteya, <futuro>, ...)
export type Tenant = SystemTenant | string;

const SYSTEM: SystemTenant[] = ["admin", "mi", "pos", "app", "www"];

/** True si el tenant detectado es un slug de negocio (no del panel SaaS). */
export const isStorefrontTenant = (t: Tenant): boolean =>
  !!t && !(SYSTEM as string[]).includes(t);

export function detectTenant(): Tenant {
  if (typeof window === "undefined") return "app";

  // 1. Query override (útil en dev / preview)
  try {
    const qp = new URLSearchParams(window.location.search).get("tenant");
    if (qp) {
      sessionStorage.setItem("sps_tenant_override", qp);
      return qp;
    }
    const stored = sessionStorage.getItem("sps_tenant_override");
    if (stored) return stored;
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

  // 3. Producción: primer label es el tenant (sistema o storefront).
  const first = host.split(".")[0];
  if ((SYSTEM as string[]).includes(first)) return first as SystemTenant;
  // www desnudo
  if (first === "sistecpos" || first === "www") return "www";
  // Cualquier otro slug → tenant storefront (surteya, etc.)
  return first;
}

export const isTenant = (...t: Tenant[]) => t.includes(detectTenant());
