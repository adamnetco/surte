// Polls Cloudflare for current SSL/ownership status of a custom hostname.
// Etapa 22: agregado JWT + role admin + membership-check sobre la org dueña del dominio.
import {
  corsHeaders, jsonResponse, requireAuth, requireAdminRole, requireMembership, serviceClient,
} from "../_shared/tenant-guard.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);
  const token = Deno.env.get("CLOUDFLARE_API_TOKEN");
  const zoneId = Deno.env.get("CLOUDFLARE_FALLBACK_ZONE_ID");
  if (!token || !zoneId) return jsonResponse({ error: "cloudflare_not_configured" }, 500);

  const auth = await requireAuth(req);
  if (!auth.ok) return auth.response;
  const svc = serviceClient();
  const roleGate = await requireAdminRole(svc, auth.userId, auth.isServiceRole);
  if (roleGate !== true) return roleGate;

  let body: { hostname?: string };
  try { body = await req.json(); } catch { return jsonResponse({ error: "invalid_json" }, 400); }
  const hostname = String(body?.hostname ?? "").trim().toLowerCase();
  if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(hostname)) return jsonResponse({ error: "invalid_hostname" }, 400);

  const { data: row } = await svc.from("tenant_domains")
    .select("cf_hostname_id, organization_id").eq("hostname", hostname).maybeSingle();
  if (!row?.cf_hostname_id) return jsonResponse({ error: "not_registered" }, 404);

  const memGate = await requireMembership(svc, auth.userId, row.organization_id, auth.isServiceRole);
  if (memGate !== true) return memGate;

  const cfRes = await fetch(
    `https://api.cloudflare.com/client/v4/zones/${zoneId}/custom_hostnames/${row.cf_hostname_id}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const cfJson = await cfRes.json();
  if (!cfRes.ok || !cfJson.success) return jsonResponse({ error: "cloudflare_error", cf: cfJson }, 502);

  const status = cfJson.result.status;
  const ssl_status = cfJson.result.ssl?.status;
  await svc.from("tenant_domains").update({
    cf_status: status,
    cf_ssl_status: ssl_status ?? null,
    cf_ownership_verification: cfJson.result.ownership_verification ?? null,
    last_checked_at: new Date().toISOString(),
    verified_at: status === "active" ? new Date().toISOString() : null,
  }).eq("hostname", hostname);

  return jsonResponse({ ok: true, hostname, status, ssl_status, result: cfJson.result });
});
