// Registers a custom domain for a tenant via Cloudflare for SaaS Custom Hostnames.
// Requires: CLOUDFLARE_API_TOKEN, CLOUDFLARE_FALLBACK_ZONE_ID.
// Caller must be admin/superadmin (RLS-checked via auth_factors not needed — we check role via user_roles).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

interface ReqBody { tenant_id: string; hostname: string; }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const token = Deno.env.get("CLOUDFLARE_API_TOKEN");
  const zoneId = Deno.env.get("CLOUDFLARE_FALLBACK_ZONE_ID");
  if (!token || !zoneId) return json({ error: "cloudflare_not_configured" }, 500);

  const authz = req.headers.get("authorization");
  if (!authz?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authz } }, auth: { persistSession: false } },
  );
  const { data: u } = await sb.auth.getUser();
  if (!u.user) return json({ error: "unauthorized" }, 401);

  const svc = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  const { data: roles } = await svc.from("user_roles").select("role").eq("user_id", u.user.id);
  const ok = roles?.some((r) => r.role === "admin" || r.role === "superadmin");
  if (!ok) return json({ error: "forbidden" }, 403);

  let body: ReqBody;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const hostname = String(body?.hostname ?? "").trim().toLowerCase();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(hostname)) return json({ error: "invalid_hostname" }, 400);
  if (!body.tenant_id) return json({ error: "tenant_id_required" }, 400);

  const cfRes = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/custom_hostnames`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        hostname,
        ssl: { method: "http", type: "dv", settings: { min_tls_version: "1.2" } },
      }),
    },
  );
  const cfJson = await cfRes.json();
  if (!cfRes.ok || !cfJson.success) {
    return json({ error: "cloudflare_error", cf: cfJson }, 502);
  }
  const cfId = cfJson.result.id as string;
  const status = cfJson.result.status as string;
  const ssl_status = cfJson.result.ssl?.status as string | undefined;
  const ownership = cfJson.result.ownership_verification;
  const dcv = cfJson.result.ssl?.validation_records?.[0];

  // Look up organization_id for the site (required NOT NULL on insert path).
  const { data: siteRow } = await svc
    .from("tenant_sites")
    .select("organization_id")
    .eq("id", body.tenant_id)
    .maybeSingle();
  if (!siteRow?.organization_id) {
    return json({ error: "site_not_found", tenant_id: body.tenant_id }, 404);
  }

  const { error: upsertErr } = await svc.from("tenant_domains").upsert(
    {
      site_id: body.tenant_id,
      organization_id: siteRow.organization_id,
      hostname,
      dns_mode: "saas",
      cf_zone_id: zoneId,
      cf_hostname_id: cfId,
      cf_status: status,
      cf_ssl_status: ssl_status ?? null,
      cf_ownership_verification: ownership ?? null,
      cf_dcv_method: dcv ? "http" : null,
      cname_target: `${zoneId}.cloudflareondemand.com`,
      last_checked_at: new Date().toISOString(),
    },
    { onConflict: "hostname" },
  );
  if (upsertErr) {
    console.error("tenant_domains upsert failed", upsertErr);
    return json({ error: "db_upsert_failed", detail: upsertErr.message }, 500);
  }

  return json({
    ok: true,
    hostname,
    cf_hostname_id: cfId,
    status,
    ssl_status,
    ownership_verification: ownership,
    dcv_method: dcv ? "http" : null,
  });
});
