// Unified health snapshot: Core (DB reachability) + Sites (publication + Cloudflare) + WP.
// Cached server-side per organization for 10s to dampen polling load.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

interface CacheEntry { at: number; body: unknown }
const cache = new Map<string, CacheEntry>();
const TTL_MS = 10_000;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const auth = req.headers.get("Authorization") ?? "";
  if (!auth.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  let body: { organization_id?: string };
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const orgId = (body.organization_id ?? "").trim();
  if (!orgId) return json({ error: "organization_id_required" }, 400);

  // Auth gate: user must be member or superadmin
  const userClient = createClient(SUPABASE_URL, ANON, { global: { headers: { Authorization: auth } } });
  const { data: u } = await userClient.auth.getUser();
  if (!u?.user) return json({ error: "unauthorized" }, 401);

  // Cache key per (user, org) — RLS already scopes, but we keep it explicit.
  const key = `${orgId}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL_MS) {
    return json({ ...(hit.body as object), cached: true });
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE);

  // Membership check (skip for superadmin)
  const [{ data: isSuper }, { data: memberRow }] = await Promise.all([
    admin.rpc("has_role", { _user_id: u.user.id, _role: "superadmin" }).then((r) => r).catch(() => ({ data: false })),
    admin.from("organization_members").select("user_id").eq("organization_id", orgId).eq("user_id", u.user.id).maybeSingle(),
  ]);
  if (!isSuper && !memberRow) return json({ error: "forbidden" }, 403);

  // 1) Core: simple ping
  const t0 = performance.now();
  const { error: coreErr } = await admin.from("organizations").select("id", { head: true, count: "exact" }).eq("id", orgId);
  const latency_ms = Math.round(performance.now() - t0);
  const core = coreErr
    ? { status: "off", latency_ms, error: coreErr.message, checked_at: new Date().toISOString() }
    : { status: latency_ms > 800 ? "warn" : "ok", latency_ms, checked_at: new Date().toISOString() };

  // 2) Sites + domains + wp config
  const { data: sites } = await admin
    .from("tenant_sites")
    .select("id, slug, name, is_published, updated_at, tenant_domains(hostname,is_primary,cf_status,cf_ssl_status,verified_at,last_checked_at), tenant_wp_config(wp_base_url,wp_app_password)")
    .eq("organization_id", orgId);

  const items = (sites ?? []).map((s: any) => {
    const primary = s.tenant_domains?.find((d: any) => d.is_primary) ?? s.tenant_domains?.[0] ?? null;
    const wp = s.tenant_wp_config?.[0];
    return {
      id: s.id,
      slug: s.slug,
      name: s.name,
      is_published: s.is_published,
      last_sync_at: s.updated_at,
      hostname: primary?.hostname ?? null,
      cf_status: primary?.cf_status ?? null,
      cf_ssl_status: primary?.cf_ssl_status ?? null,
      domain_verified: !!primary?.verified_at,
      wp_configured: !!wp?.wp_app_password,
      wp_host: wp?.wp_base_url ? new URL(wp.wp_base_url).hostname : null,
    };
  });
  const published = items.filter((i) => i.is_published).length;
  const last_sync_at = items.reduce<string | null>((acc, i) => (!acc || (i.last_sync_at && i.last_sync_at > acc)) ? i.last_sync_at : acc, null);
  const wpErrors = items.filter((i) => i.is_published && !i.wp_configured).map((i) => `WP no configurado en "${i.name}"`);

  const payload = {
    version: "v1",
    generated_at: new Date().toISOString(),
    core,
    sites: { total: items.length, published, last_sync_at, items },
    wp: { connected: items.length > 0 && wpErrors.length === 0, errors: wpErrors },
  };

  cache.set(key, { at: Date.now(), body: payload });
  // Cap cache
  if (cache.size > 500) {
    const oldest = [...cache.entries()].sort((a, b) => a[1].at - b[1].at)[0]?.[0];
    if (oldest) cache.delete(oldest);
  }

  return json(payload);
});
