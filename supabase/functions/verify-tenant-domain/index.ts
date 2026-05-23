// Verifica el registro TXT _lovable-tenant.<dominio> usando Google DNS-over-HTTPS.
// Si encuentra el verification_token, marca el dominio como verificado.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: u } = await supabase.auth.getUser();
    if (!u?.user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { domain_id } = await req.json();
    if (!domain_id) return new Response(JSON.stringify({ error: "domain_id required" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: d } = await supabase.from("tenant_domains").select("*").eq("id", domain_id).maybeSingle();
    if (!d) return new Response(JSON.stringify({ error: "not_found" }), { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } });

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

    return new Response(JSON.stringify({ verified: found, txt: records, a: aRecords }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
