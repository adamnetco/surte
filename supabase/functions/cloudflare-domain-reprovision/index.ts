// Forces Cloudflare to re-issue the SSL certificate for a custom hostname
// by PATCHing the SSL block (method=txt, type=dv). After patching, fetches
// the fresh status and persists it in tenant_domains.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const token = Deno.env.get("CLOUDFLARE_API_TOKEN");
  const zoneId = Deno.env.get("CLOUDFLARE_FALLBACK_ZONE_ID");
  if (!token || !zoneId) return json({ error: "cloudflare_not_configured" }, 500);

  let body: { hostname?: string };
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const hostname = String(body?.hostname ?? "").trim().toLowerCase();
  if (!hostname) return json({ error: "hostname_required" }, 400);

  const svc = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
  const { data: row } = await svc.from("tenant_domains")
    .select("cf_hostname_id").eq("hostname", hostname).maybeSingle();
  if (!row?.cf_hostname_id) return json({ error: "not_registered" }, 404);

  // PATCH SSL block to force re-issuance
  const patchRes = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/custom_hostnames/${row.cf_hostname_id}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        ssl: { method: "txt", type: "dv", settings: { min_tls_version: "1.2" } },
      }),
    },
  );
  const patchJson = await patchRes.json();
  if (!patchRes.ok || !patchJson.success) {
    return json({ error: "cloudflare_patch_failed", cf: patchJson }, 502);
  }

  const status = patchJson.result.status;
  const ssl_status = patchJson.result.ssl?.status;
  await svc.from("tenant_domains").update({
    cf_status: status,
    cf_ssl_status: ssl_status ?? "initializing",
    cf_ownership_verification: patchJson.result.ownership_verification ?? null,
    last_checked_at: new Date().toISOString(),
    verified_at: status === "active" ? new Date().toISOString() : null,
  }).eq("hostname", hostname);

  return json({
    ok: true,
    hostname,
    status,
    ssl_status,
    ownership_verification: patchJson.result.ownership_verification ?? null,
    ssl_validation_records: patchJson.result.ssl?.validation_records ?? null,
  });
});
