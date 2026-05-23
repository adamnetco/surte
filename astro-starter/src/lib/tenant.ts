// Resolver de tenant: una llamada por request a la edge function pública.
// Cachea 5 min en memoria por host para reducir latencia.

const SUPABASE_URL = import.meta.env.PUBLIC_SUPABASE_URL!;
const ANON_KEY = import.meta.env.PUBLIC_SUPABASE_ANON_KEY!;

export interface Tenant {
  site_id: string;
  organization_id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  primary_color: string;
  accent_color: string;
  default_locale: string;
  wp_base_url: string | null;
  default_post_type: string;
  taxonomies: Record<string, unknown>;
  hostname: string;
  is_primary: boolean;
}

const cache = new Map<string, { value: Tenant; expires: number }>();

export async function resolveTenant(host: string): Promise<Tenant | null> {
  const key = host.toLowerCase().replace(/^www\./, "");
  const hit = cache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;

  const res = await fetch(`${SUPABASE_URL}/functions/v1/resolve-tenant?host=${encodeURIComponent(key)}`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
  });
  if (!res.ok) return null;
  const value = (await res.json()) as Tenant;
  cache.set(key, { value, expires: Date.now() + 5 * 60 * 1000 });
  return value;
}

// ── WordPress headless helpers ──────────────────────────────
export async function wpFetch<T = any>(tenant: Tenant, path: string, init?: RequestInit): Promise<T> {
  if (!tenant.wp_base_url) throw new Error("Tenant sin WordPress configurado");
  const url = `${tenant.wp_base_url}/wp-json/wp/v2${path.startsWith("/") ? path : `/${path}`}`;
  const res = await fetch(url, { ...init, headers: { Accept: "application/json", ...(init?.headers ?? {}) } });
  if (!res.ok) throw new Error(`WP ${res.status}: ${await res.text()}`);
  return res.json() as Promise<T>;
}

export const wpPosts = (t: Tenant, params = "per_page=12&_embed") => wpFetch(t, `/${t.default_post_type}?${params}`);
export const wpPostBySlug = (t: Tenant, slug: string) => wpFetch(t, `/${t.default_post_type}?slug=${slug}&_embed`);
