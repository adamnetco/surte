// Provision a tenant subdomain on Cloudflare Pages + DNS, and record it in tenant_domains.
// POST body: { hostname: "surteya.sistecpos.com", site_id: uuid, organization_id: uuid, is_primary?: boolean }
// Auth: requires authenticated superadmin (verified in code; verify_jwt = false at gateway)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const PAGES_PROJECT = (Deno.env.get("LOVABLE_STOREFRONT_SLUG") ?? "sistecpos-storefront").trim();
const CNAME_TARGET = `${PAGES_PROJECT}.pages.dev`;
const ROOT_DOMAIN = (Deno.env.get("LOVABLE_ROOT_DOMAIN") ?? "sistecpos.com").trim();

const CF_API = "https://api.cloudflare.com/client/v4";
// Auto-detect swapped secrets: a CF API Token starts with "cfut_" or is >35 chars; an Account ID is 32 hex.
const RAW_TOKEN = (Deno.env.get("CLOUDFLARE_API_TOKEN") ?? "").trim();
const RAW_ACCOUNT = (Deno.env.get("CLOUDFLARE_ACCOUNT_ID") ?? "").trim();
const looksLikeToken = (s: string) => s.startsWith("cfut_") || s.length > 35;
const SWAPPED = !looksLikeToken(RAW_TOKEN) && looksLikeToken(RAW_ACCOUNT);
const CF_TOKEN = SWAPPED ? RAW_ACCOUNT : RAW_TOKEN;
const CF_ACCOUNT = SWAPPED ? RAW_TOKEN : RAW_ACCOUNT;
const CF_ZONE = (Deno.env.get("CLOUDFLARE_ZONE_ID") ?? "").trim();

const cfHeaders = {
  Authorization: `Bearer ${CF_TOKEN}`,
  "Content-Type": "application/json",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function cfFetch(path: string, init: RequestInit = {}) {
  const res = await fetch(`${CF_API}${path}`, { ...init, headers: { ...cfHeaders, ...(init.headers ?? {}) } });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok && (data as any)?.success !== false, status: res.status, data };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  try {
    // ---- Authn / Authz ----
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json(401, { error: "Missing bearer token" });

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) return json(401, { error: "Unauthorized" });

    const admin = createClient(SUPABASE_URL, SERVICE);
    const { data: roles } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const isSuper = (roles ?? []).some((r: any) => r.role === "superadmin");
    if (!isSuper) return json(403, { error: "Superadmin required" });

    // ---- Input ----
    const body = await req.json().catch(() => ({}));
    const hostname = String(body?.hostname ?? "").trim().toLowerCase();
    const site_id = String(body?.site_id ?? "");
    const organization_id = String(body?.organization_id ?? "");
    const is_primary = Boolean(body?.is_primary);

    if (!/^[a-z0-9-]+\.sistecpos\.com$/.test(hostname)) {
      return json(400, { error: `hostname must be <sub>.${ROOT_DOMAIN}` });
    }
    if (!site_id || !organization_id) return json(400, { error: "site_id and organization_id required" });

    const subdomain = hostname.replace(`.${ROOT_DOMAIN}`, "");

    // ---- 1) DNS: create CNAME (proxied) ----
    const dnsRes = await cfFetch(`/zones/${CF_ZONE}/dns_records`, {
      method: "POST",
      body: JSON.stringify({
        type: "CNAME",
        name: subdomain,
        content: CNAME_TARGET,
        proxied: true,
        ttl: 1,
        comment: `auto: tenant ${organization_id}`,
      }),
    });

    // 81057 = record already exists → continue
    const dnsAlreadyExists =
      !dnsRes.ok &&
      Array.isArray((dnsRes.data as any)?.errors) &&
      (dnsRes.data as any).errors.some((e: any) => e.code === 81057 || e.code === 81053);

    if (!dnsRes.ok && !dnsAlreadyExists) {
      return json(502, { step: "dns", cf: dnsRes.data });
    }

    // ---- 2) Pages: attach custom domain ----
    const pagesRes = await cfFetch(
      `/accounts/${CF_ACCOUNT}/pages/projects/${PAGES_PROJECT}/domains`,
      { method: "POST", body: JSON.stringify({ name: hostname }) },
    );

    const pagesAlreadyExists =
      !pagesRes.ok &&
      Array.isArray((pagesRes.data as any)?.errors) &&
      (pagesRes.data as any).errors.some((e: any) =>
        String(e.message ?? "").toLowerCase().includes("already")
      );

    if (!pagesRes.ok && !pagesAlreadyExists) {
      return json(502, { step: "pages", cf: pagesRes.data });
    }

    // ---- 3) Upsert tenant_domains ----
    const { error: upsertErr } = await admin
      .from("tenant_domains")
      .upsert(
        {
          site_id,
          organization_id,
          hostname,
          is_primary,
          dns_mode: "saas",
          cf_zone_id: CF_ZONE,
          cname_target: CNAME_TARGET,
          cf_status: "provisioning",
          ssl_status: "pending",
          last_checked_at: new Date().toISOString(),
        },
        { onConflict: "hostname" },
      );

    if (upsertErr) return json(500, { step: "db", error: upsertErr.message });

    return json(200, {
      ok: true,
      hostname,
      cname_target: CNAME_TARGET,
      dns_created: !dnsAlreadyExists,
      pages_attached: !pagesAlreadyExists,
      note: "SSL provisioning by Cloudflare takes 1-3 minutes",
    });
  } catch (e) {
    return json(500, { error: (e as Error).message });
  }
});
