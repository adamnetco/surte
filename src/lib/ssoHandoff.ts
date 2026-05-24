/**
 * SSO Handoff cross-subdomain para *.sistecpos.com
 *
 * Problema: Supabase guarda la sesión en `localStorage`, que NO se comparte
 * entre subdominios. Las cookies con `Domain=.sistecpos.com` tampoco sirven
 * con la config actual (`storage: localStorage`).
 *
 * Solución: cuando un usuario autenticado salta entre subdominios usamos un
 * link `https://<dest>/?sso=1#sps_sso=<base64(payload)>`. El destino lee el
 * fragment (que jamás viaja al servidor), llama `supabase.auth.setSession()`
 * y borra el hash de la URL. El token tiene TTL corto y solo se acepta una vez.
 */
import { supabase } from "@/integrations/supabase/client";
import type { Tenant } from "@/lib/subdomain";

const FRAGMENT_KEY = "sps_sso";
const HANDOFF_TTL_MS = 60_000; // 60s, ventana corta para el redirect
const ROOT_DOMAIN = "sistecpos.com";

const HOST_MAP: Record<Tenant, string> = {
  admin: `admin.${ROOT_DOMAIN}`,
  mi: `mi.${ROOT_DOMAIN}`,
  pos: `pos.${ROOT_DOMAIN}`,
  app: `app.${ROOT_DOMAIN}`,
  www: ROOT_DOMAIN,
};

export function tenantHost(t: Tenant): string {
  return HOST_MAP[t];
}

interface HandoffPayload {
  access_token: string;
  refresh_token: string;
  iat: number;
}

const isProdHost = (host = window.location.hostname) =>
  host.endsWith(`.${ROOT_DOMAIN}`) || host === ROOT_DOMAIN;

/**
 * Construye una URL absoluta hacia otro subdominio con la sesión actual
 * inyectada en el hash. Si no hay sesión o estamos en dev, devuelve la URL
 * sin el fragment (el usuario tendrá que loguearse en destino).
 */
export async function buildHandoffUrl(
  target: Tenant,
  path = "/"
): Promise<string> {
  const host = tenantHost(target);
  // En dev mantenemos el mismo origen y usamos query ?tenant=
  if (typeof window !== "undefined" && !isProdHost()) {
    const u = new URL(path, window.location.origin);
    u.searchParams.set("tenant", target);
    return u.toString();
  }

  const base = `https://${host}${path.startsWith("/") ? path : "/" + path}`;

  const { data } = await supabase.auth.getSession();
  const s = data.session;
  if (!s?.access_token || !s?.refresh_token) return base;

  const payload: HandoffPayload = {
    access_token: s.access_token,
    refresh_token: s.refresh_token,
    iat: Date.now(),
  };
  const token = btoa(unescape(encodeURIComponent(JSON.stringify(payload))));
  const sep = base.includes("?") ? "&" : "?";
  return `${base}${sep}sso=1#${FRAGMENT_KEY}=${token}`;
}

/**
 * Lee el fragment al arrancar la app. Si trae un payload SSO válido, instala
 * la sesión y limpia el hash. Llamar UNA vez, antes de cualquier render
 * que dependa de auth. Es idempotente.
 */
export async function consumeHandoff(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  const hash = window.location.hash || "";
  if (!hash.includes(FRAGMENT_KEY + "=")) return false;

  try {
    const raw = hash.split(FRAGMENT_KEY + "=")[1]?.split("&")[0];
    if (!raw) return false;
    const json = decodeURIComponent(escape(atob(raw)));
    const payload = JSON.parse(json) as HandoffPayload;

    if (!payload.access_token || !payload.refresh_token) return false;
    if (Date.now() - (payload.iat || 0) > HANDOFF_TTL_MS) {
      console.warn("[SSO] Handoff expirado, ignorando");
      cleanHash();
      return false;
    }

    const { error } = await supabase.auth.setSession({
      access_token: payload.access_token,
      refresh_token: payload.refresh_token,
    });

    cleanHash();
    if (error) {
      console.warn("[SSO] setSession falló:", error.message);
      return false;
    }
    return true;
  } catch (err) {
    console.warn("[SSO] payload inválido:", err);
    cleanHash();
    return false;
  }
}

function cleanHash() {
  try {
    const url = new URL(window.location.href);
    url.hash = "";
    url.searchParams.delete("sso");
    window.history.replaceState({}, "", url.toString());
  } catch {
    /* noop */
  }
}
