// Elimina un dominio tenant: purga Cloudflare (custom_hostname + dns_record)
// y luego borra la fila de tenant_domains. Auditado en tenant_audit_log.
// Fallback: si Cloudflare falla (≠404), NO borra la fila.
import {
  corsHeaders, jsonResponse, requireAuth, requireAdminRole, serviceClient,
} from "../_shared/tenant-guard.ts";

interface ReqBody {
  domain_id: string;
  /** Confirmación: hostname exacto tipeado por el usuario. */
  confirm_hostname: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405);

  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;
    const svc = serviceClient();

    // Sólo admin/superadmin (el caller puede estar operando un tenant foráneo).
    const roleGate = await requireAdminRole(svc, auth.userId, auth.isServiceRole);
    if (roleGate !== true) return roleGate;

    let body: ReqBody;
    try { body = await req.json(); } catch { return jsonResponse({ error: "invalid_json" }, 400); }
    if (!body?.domain_id) return jsonResponse({ error: "domain_id_required" }, 400);
    if (!body?.confirm_hostname) return jsonResponse({ error: "confirm_hostname_required" }, 400);

    const { data: d } = await svc.from("tenant_domains").select("*").eq("id", body.domain_id).maybeSingle();
    if (!d) return jsonResponse({ error: "not_found" }, 404);

    if (d.hostname !== body.confirm_hostname.trim().toLowerCase()) {
      return jsonResponse({ error: "hostname_mismatch", expected: d.hostname }, 400);
    }

    // Resolver email del actor para audit.
    const { data: actor } = await svc.from("profiles").select("email").eq("id", auth.userId).maybeSingle();

    // 1) Cloudflare cleanup (idempotente).
    const cfToken = Deno.env.get("CLOUDFLARE_API_TOKEN");
    const cfErrors: Array<{ kind: string; status: number; body: unknown }> = [];

    if (cfToken && d.cf_hostname_id && d.cf_zone_id) {
      const r = await fetch(
        `https://api.cloudflare.com/client/v4/zones/${d.cf_zone_id}/custom_hostnames/${d.cf_hostname_id}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${cfToken}` } },
      );
      if (!r.ok && r.status !== 404) {
        cfErrors.push({ kind: "custom_hostname", status: r.status, body: await r.json().catch(() => ({})) });
      }
    }

    if (cfErrors.length > 0) {
      return jsonResponse({
        error: "cloudflare_delete_failed",
        cf_errors: cfErrors,
        message: "La fila NO fue borrada. Reintenta cuando Cloudflare responda.",
      }, 502);
    }

    // 2) Borrar fila DB.
    const { error: delErr } = await svc.from("tenant_domains").delete().eq("id", body.domain_id);
    if (delErr) return jsonResponse({ error: "db_delete_failed", detail: delErr.message }, 500);

    // 3) Audit log.
    await svc.from("tenant_audit_log").insert({
      organization_id: d.organization_id,
      actor_id: auth.userId,
      actor_email: actor?.email ?? null,
      action: "domain.deleted",
      payload: {
        hostname: d.hostname,
        site_id: d.site_id,
        cf_hostname_id: d.cf_hostname_id,
        cf_zone_id: d.cf_zone_id,
        was_primary: d.is_primary,
        was_verified: !!d.verified_at,
      },
    });

    return jsonResponse({
      ok: true,
      deleted: { id: body.domain_id, hostname: d.hostname },
      cloudflare_purged: !!(cfToken && d.cf_hostname_id),
    });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
});
