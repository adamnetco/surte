// desktop-tenant-bootstrap — devuelve el tenant manifest de la organización
// autorizada por una licencia/activación concreta.
//
// Reglas duras:
//  - Usa service role internamente, pero valida explícitamente que la pareja
//    (license_key, fingerprint) exista y esté activa.
//  - La organización SIEMPRE se deriva del registro de licencia, nunca del body.
//  - Jamás devuelve datos de otro tenant.
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { buildTenantManifest } from "../_shared/tenantManifest.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json().catch(() => ({}));
    const licenseKey = typeof body.license_key === "string" ? body.license_key.trim() : "";
    const fingerprint = typeof body.fingerprint === "string" ? body.fingerprint.trim() : "";
    if (!licenseKey || !fingerprint) return json({ error: "missing_fields" }, 400);

    const { data: lic, error: licErr } = await supa
      .from("licenses")
      .select("id, organization_id, status, expires_at")
      .eq("license_key", licenseKey)
      .maybeSingle();
    if (licErr) throw licErr;
    if (!lic) return json({ error: "license_invalid" }, 403);
    if (lic.status && !["active", "trial"].includes(String(lic.status))) {
      return json({ error: `license_${lic.status}` }, 403);
    }
    if (lic.expires_at && new Date(lic.expires_at as string).getTime() < Date.now()) {
      return json({ error: "license_expired" }, 403);
    }

    const { data: act, error: actErr } = await supa
      .from("license_activations")
      .select("id, license_id, is_active")
      .eq("license_id", lic.id)
      .eq("fingerprint", fingerprint)
      .maybeSingle();
    if (actErr) throw actErr;
    if (!act || act.is_active === false) return json({ error: "activation_invalid" }, 403);

    const manifest = await buildTenantManifest(supa, String(lic.organization_id));
    return json({
      organization_id: manifest.organization_id,
      activation_id: act.id,
      tenant_manifest: manifest,
    });
  } catch (e) {
    return json({ error: String((e as Error).message) }, 400);
  }
});
