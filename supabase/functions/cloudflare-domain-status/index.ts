// Polls Cloudflare for current SSL/ownership status of a custom hostname.
// Etapa 22: agregado JWT + role admin + membership-check sobre la org dueña del dominio.
// Mejora panel aprovisionamiento dominios (jun-2026):
//   - Devuelve `verification_errors` (mensajes reales de Cloudflare).
//   - Detecta "orange cloud" (proxy de CF en la zona del cliente) que rompe Cloudflare for SaaS.
//   - Persiste cname_target desde CLOUDFLARE_FALLBACK_HOSTNAME para que el panel no quede vacío.
import {
  corsHeaders, jsonResponse, requireAuth, requireAdminRole, requireMembership, serviceClient,
} from "../_shared/tenant-guard.ts";

// Rangos IPv4 de Cloudflare (https://www.cloudflare.com/ips-v4). Solo los más comunes en producción.
const CF_IP_PREFIXES = [
  "104.16.", "104.17.", "104.18.", "104.19.", "104.20.", "104.21.", "104.22.", "104.23.",
  "104.24.", "104.25.", "104.26.", "104.27.", "104.28.", "104.29.", "104.30.", "104.31.",
  "172.64.", "172.65.", "172.66.", "172.67.", "172.68.", "172.69.", "172.70.", "172.71.",
  "162.159.", "173.245.", "188.114.", "190.93.", "197.234.", "198.41.", "131.0.72.",
];
const isCloudflareIp = (ip: string) => CF_IP_PREFIXES.some((p) => ip.startsWith(p));

async function detectOrangeProxy(hostname: string, expectedCname?: string | null): Promise<{
  proxy_detected: boolean;
  cname_chain: string[];
  a_records: string[];
  reason?: string;
}> {
  try {
    const [cnameRes, aRes] = await Promise.all([
      fetch(`https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=CNAME`, { headers: { Accept: "application/dns-json" } }),
      fetch(`https://dns.google/resolve?name=${encodeURIComponent(hostname)}&type=A`, { headers: { Accept: "application/dns-json" } }),
    ]);
    const cnameJson = await cnameRes.json();
    const aJson = await aRes.json();
    // Type 5 = CNAME en respuestas DoH
    const cnameChain: string[] = (cnameJson.Answer ?? [])
      .filter((a: any) => a.type === 5)
      .map((a: any) => String(a.data).replace(/\.$/, "").toLowerCase());
    const aRecords: string[] = (aJson.Answer ?? [])
      .filter((a: any) => a.type === 1)
      .map((a: any) => String(a.data));

    const target = expectedCname?.replace(/\.$/, "").toLowerCase();
    const pointsToTarget = !!target && cnameChain.some((c) => c === target);
    const hasCfIps = aRecords.some(isCloudflareIp);

    // Si no aparece el CNAME esperado pero sí IPs de Cloudflare => zona del cliente está
    // proxeada (naranja) y CF aplanó el CNAME en el edge. SaaS no puede ver el CNAME → cf_status pending.
    if (!pointsToTarget && hasCfIps) {
      return {
        proxy_detected: true,
        cname_chain: cnameChain,
        a_records: aRecords,
        reason: "La zona del cliente parece estar proxeada por Cloudflare (orange cloud). El CNAME se aplana en el edge y Cloudflare for SaaS no lo detecta. Cambia los registros CNAME a 'DNS only' (nube gris).",
      };
    }
    return { proxy_detected: false, cname_chain: cnameChain, a_records: aRecords };
  } catch (_e) {
    return { proxy_detected: false, cname_chain: [], a_records: [] };
  }
}

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
    .select("cf_hostname_id, organization_id, cname_target").eq("hostname", hostname).maybeSingle();
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
  const ssl_validation_records = cfJson.result.ssl?.validation_records ?? null;
  // Errores explícitos que Cloudflare expone — útiles para el panel
  const verification_errors: string[] = cfJson.result.verification_errors ?? [];
  const ssl_validation_errors: Array<{ message?: string }> = cfJson.result.ssl?.validation_errors ?? [];
  const fallbackHostname = Deno.env.get("CLOUDFLARE_FALLBACK_HOSTNAME") ?? null;
  const effectiveCname = fallbackHostname ?? row.cname_target ?? null;

  // I2 — Detección de orange cloud en la zona del cliente
  const proxy = await detectOrangeProxy(hostname, effectiveCname);

  await svc.from("tenant_domains").update({
    cf_status: status,
    cf_ssl_status: ssl_status ?? null,
    cf_ownership_verification: cfJson.result.ownership_verification ?? null,
    cf_ssl_validation_records: ssl_validation_records,
    cname_target: effectiveCname,
    last_checked_at: new Date().toISOString(),
    verified_at: status === "active" ? new Date().toISOString() : null,
  }).eq("hostname", hostname);

  return jsonResponse({
    ok: true,
    hostname,
    status,
    ssl_status,
    ssl_validation_records,
    cname_target: effectiveCname,
    verification_errors,
    ssl_validation_errors: ssl_validation_errors.map((e) => e.message).filter(Boolean),
    proxy_detected: proxy.proxy_detected,
    proxy_reason: proxy.reason ?? null,
    dns_observed: { cname: proxy.cname_chain, a: proxy.a_records },
    result: cfJson.result,
  });
});
