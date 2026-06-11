// Verifica el registro TXT _lovable-tenant.<dominio> usando Google DNS-over-HTTPS.
// Etapa 22: usa anon client para auth, service_role solo para escritura, + membership check.
import {
  corsHeaders, jsonResponse, requireAuth, requireMembership, serviceClient,
} from "../_shared/tenant-guard.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.response;
    const supabase = serviceClient();

    const { domain_id } = await req.json();
    if (!domain_id) return jsonResponse({ error: "domain_id required" }, 400);

    const { data: d } = await supabase.from("tenant_domains").select("*").eq("id", domain_id).maybeSingle();
    if (!d) return jsonResponse({ error: "not_found" }, 404);

    const memGate = await requireMembership(supabase, auth.userId, d.organization_id, auth.isServiceRole);
    if (memGate !== true) return memGate;

    const txtName = `_lovable-tenant.${d.hostname}`;
    const dohRes = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(txtName)}&type=TXT`, {
      headers: { Accept: "application/dns-json" },
    });
    const doh = await dohRes.json();
    const records: string[] = (doh.Answer ?? []).map((a: any) => (a.data ?? "").replace(/^"|"$/g, ""));
    const found = records.some((r) => r.includes(d.verification_token));

    // Bonus: chequea que el CNAME/A apunte a algo Lovable/Vercel
    const aRes = await fetch(`https://dns.google/resolve?name=${encodeURIComponent(d.hostname)}&type=A`, { headers: { Accept: "application/dns-json" } });
    const aJson = await aRes.json();
    const aRecords: string[] = (aJson.Answer ?? []).map((a: any) => a.data);

    if (found) {
      await supabase.from("tenant_domains").update({
        verified_at: new Date().toISOString(),
        ssl_status: "provisioning",
        dns_records: { txt: records, a: aRecords },
      }).eq("id", domain_id);
    }

    await supabase.from("tenant_sync_log").insert({
      site_id: d.site_id, organization_id: d.organization_id, kind: "dns_verify",
      status: found ? "ok" : "failed",
      payload: { txt: records, a: aRecords, expected_token: d.verification_token },
      error: found ? null : "TXT record not found",
    });

    return jsonResponse({ verified: found, txt: records, a: aRecords });
  } catch (e) {
    return jsonResponse({ error: String(e) }, 500);
  }
});
