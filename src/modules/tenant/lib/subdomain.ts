/**
 * Subdomain / tenant detection for SistecPOS multi-domain architecture.
 *
 * Hosts del **panel SistecPOS** (control SaaS):
 *   admin.sistecpos.com → 'admin'  (LoginRouter → AdminDashboard/Superadmin según rol)
 *   mi.sistecpos.com    → 'mi'     (Portal de Clientes SistecPOS)
 *   pos.sistecpos.com   → 'pos'    (POSWorkspace, legado)
 *   app.sistecpos.com   → 'app'    (Login portal genérico)
 *   sistecpos.com / www → 'www'    (Landing pública de prospección)
 *
 * Hosts de **tenants** (cada negocio cliente):
 *   <slug>.sistecpos.com    → tenant slug (storefront del negocio)
 *
 * Dev (localhost, *.lovable.app preview) → 'app' por defecto.
 *
 * Override manual (solo para inspección puntual): `?tenant=<slug>`. Para
 * persistir entre navegaciones, añadir `&persist=1`. Sin `persist`, el override
 * se aplica solo a la URL actual y no contamina futuras sesiones.
 */
export type SystemTenant = "admin" | "mi" | "pos" | "app" | "www";
// Storefront tenant = cualquier slug de negocio
export type Tenant = SystemTenant | string;

const SYSTEM: SystemTenant[] = ["admin", "mi", "pos", "app", "www"];
const OVERRIDE_KEY = "sps_tenant_override";

/** True si el tenant detectado es un slug de negocio (no del panel SaaS). */
export const isStorefrontTenant = (t: Tenant): boolean =>
  !!t && !(SYSTEM as string[]).includes(t);

/** True si el tenant detectado es un host del panel SaaS. */
export const isSystemTenant = (t: Tenant): boolean =>
  (SYSTEM as string[]).includes(t);

/** Limpia el override de tenant (útil para volver al comportamiento por host). */
export function clearTenantOverride() {
  try { sessionStorage.removeItem(OVERRIDE_KEY); } catch { /* ignore */ }
}

export function detectTenant(): Tenant {
  if (typeof window === "undefined") return "app";

  // 1. Query override
  try {
    const params = new URLSearchParams(window.location.search);
    const qp = params.get("tenant");
    if (qp) {
      // Solo persistimos si el usuario lo pide explícitamente (?tenant=x&persist=1).
      // Esto evita que un enlace de prueba contamine futuras navegaciones.
      if (params.get("persist") === "1") {
        sessionStorage.setItem(OVERRIDE_KEY, qp);
      }
      return qp;
    }
    const stored = sessionStorage.getItem(OVERRIDE_KEY);
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
    host.endsWith(".lovable.dev") ||
    host.endsWith(".lovableproject.com")
  ) {
    return "app";
  }

  // 3. Producción: primer label es el tenant (sistema o storefront).
  const first = host.split(".")[0];
  if ((SYSTEM as string[]).includes(first)) return first as SystemTenant;
  if (first === "sistecpos" || first === "www") return "www";
  return first;
}

export const isTenant = (...t: Tenant[]) => t.includes(detectTenant());

/** True si estamos en preview / dev (no aplican redirects entre hosts). */
export function isPreviewHost(): boolean {
  if (typeof window === "undefined") return false;
  const h = window.location.hostname.toLowerCase();
  return (
    h === "localhost" ||
    h.startsWith("127.") ||
    h.endsWith(".lovable.app") ||
    h.endsWith(".lovable.dev") ||
    h.endsWith(".lovableproject.com")
  );
}
