/**
 * SSO Handoff endurecido para *.sistecpos.com
 *
 * Flujo (anti-replay, single-use, anti-leak en logs):
 *   1. Origen: `buildHandoffUrl(target)` → POST `sso-issue` con refresh_token
 *      y JWT en Authorization. El backend persiste {access, refresh} y devuelve
 *      un `nonce` con TTL ≤ 60 s. Solo el NONCE viaja en la URL.
 *   2. Destino: `consumeHandoff()` (en main.tsx, antes de montar React) lee
 *      `?sso=<nonce>`, POST `sso-consume`. El backend hace DELETE ... RETURNING
 *      (atómico → un solo uso) y devuelve los tokens. setSession() y limpia URL.
 *   3. Si el nonce expiró/ya fue usado → marca `window.__sso_error` y la app
 *      muestra `SSOErrorScreen` con botón "Iniciar sesión".
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tenant } from "@/modules/tenant/lib/subdomain";

const ROOT_DOMAIN = "sistecpos.com";
const QUERY_KEY = "sso";

const HOST_MAP: Record<Tenant, string> = {
  admin: `admin.${ROOT_DOMAIN}`,
  mi: `mi.${ROOT_DOMAIN}`,
  pos: `pos.${ROOT_DOMAIN}`,
  app: `app.${ROOT_DOMAIN}`,
  www: ROOT_DOMAIN,
};

export const tenantHost = (t: Tenant): string => HOST_MAP[t];

const isProdHost = (host = window.location.hostname) =>
  host.endsWith(`.${ROOT_DOMAIN}`) || host === ROOT_DOMAIN;

export type SSOError =
  | "expired_or_used"
  | "issue_failed"
  | "network"
  | "no_session";

declare global {
  interface Window {
    __sso_error?: SSOError;
  }
}

/**
 * Construye la URL absoluta del destino con un nonce single-use.
 * En dev / preview usa `?tenant=` sobre el mismo origen (sesión nativa).
 */
export async function buildHandoffUrl(target: Tenant, path = "/"): Promise<string> {
  if (typeof window !== "undefined" && !isProdHost()) {
    const u = new URL(path, window.location.origin);
    u.searchParams.set("tenant", target);
    return u.toString();
  }

  const base = `https://${tenantHost(target)}${path.startsWith("/") ? path : "/" + path}`;

  const { data } = await supabase.auth.getSession();
  const s = data.session;
  if (!s?.access_token || !s?.refresh_token) return base; // sin sesión → login en destino

  try {
    const { data: res, error } = await supabase.functions.invoke("sso-issue", {
      body: { refresh_token: s.refresh_token, target_tenant: target },
    });
    if (error || !res?.nonce) {
      console.warn("[SSO] issue falló:", error);
      return base;
    }
    const sep = base.includes("?") ? "&" : "?";
    return `${base}${sep}${QUERY_KEY}=${encodeURIComponent(res.nonce)}`;
  } catch (err) {
    console.warn("[SSO] issue exception:", err);
    return base;
  }
}

/**
 * Si la URL trae `?sso=<nonce>`, canjea el nonce en backend y aplica la
 * sesión. Marca `window.__sso_error` cuando falla, para que el UI lo muestre.
 */
export async function consumeHandoff(): Promise<boolean> {
  if (typeof window === "undefined") return false;

  // Soporte legacy: limpiar cualquier fragment con tokens del esquema viejo.
  if (window.location.hash.includes("sps_sso=")) cleanUrl();

  const url = new URL(window.location.href);
  const nonce = url.searchParams.get(QUERY_KEY);
  if (!nonce) return false;

  try {
    const { data, error } = await supabase.functions.invoke("sso-consume", {
      body: { nonce },
    });
    cleanUrl();

    if (error) {
      const status = (error as any)?.context?.status ?? (error as any)?.status;
      window.__sso_error = status === 404 ? "expired_or_used" : "issue_failed";
      console.warn("[SSO] consume falló:", error);
      return false;
    }
    if (!data?.access_token || !data?.refresh_token) {
      window.__sso_error = "expired_or_used";
      return false;
    }

    const { error: setErr } = await supabase.auth.setSession({
      access_token: data.access_token,
      refresh_token: data.refresh_token,
    });
    if (setErr) {
      window.__sso_error = "issue_failed";
      console.warn("[SSO] setSession falló:", setErr.message);
      return false;
    }
    return true;
  } catch (err) {
    cleanUrl();
    window.__sso_error = "network";
    console.warn("[SSO] consume exception:", err);
    return false;
  }
}

function cleanUrl() {
  try {
    const url = new URL(window.location.href);
    url.searchParams.delete(QUERY_KEY);
    url.hash = "";
    window.history.replaceState({}, "", url.toString());
  } catch { /* noop */ }
}
