// einvoice-contingency-flush
// Cron 2 min. Para cada organización con dian_health_status != 'offline'
// que tenga facturas en is_contingency=true AND transmitted_at IS NULL,
// invoca innapsis-emit con transmit_invoice_id para retransmitirlas
// en orden cronológico (FIFO). AC12 de POS-innapsis-emision-pos.
//
// Service-role only — Lovable-managed: verify_jwt = false por defecto.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Tope por corrida para no saturar Innapsis ni DIAN tras una caída larga.
const MAX_PER_RUN = 25;
// Throttle por org para respetar rate-limit (ms entre invocaciones de la misma org).
const ORG_THROTTLE_MS = 300;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // 1) Orgs candidatas: salud != offline y tienen contingencias pendientes.
    const { data: candidates, error: cErr } = await admin
      .from("electronic_invoices")
      .select("id, organization_id, contingency_emitted_at")
      .eq("is_contingency", true)
      .is("transmitted_at", null)
      .order("contingency_emitted_at", { ascending: true })
      .limit(MAX_PER_RUN);
    if (cErr) throw cErr;

    if (!candidates || candidates.length === 0) {
      return new Response(JSON.stringify({ ok: true, scanned: 0, transmitted: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Map org -> health (un fetch por org única)
    const orgIds = Array.from(new Set(candidates.map((c) => c.organization_id)));
    const { data: cfgs } = await admin
      .from("einvoice_configs")
      .select("organization_id, dian_health_status, is_active")
      .in("organization_id", orgIds);
    const healthByOrg = new Map<string, string>();
    for (const c of cfgs ?? []) {
      if ((c as any).is_active) healthByOrg.set((c as any).organization_id, (c as any).dian_health_status ?? "online");
    }

    // 3) Transmitir las que tengan salud OK (online o degraded)
    let transmitted = 0;
    let skipped = 0;
    const errors: { invoice_id: string; error: string }[] = [];
    const lastCallByOrg = new Map<string, number>();

    for (const inv of candidates) {
      const health = healthByOrg.get(inv.organization_id);
      if (!health || health === "offline") {
        skipped += 1;
        continue;
      }

      // throttle
      const last = lastCallByOrg.get(inv.organization_id) ?? 0;
      const wait = Math.max(0, ORG_THROTTLE_MS - (Date.now() - last));
      if (wait) await new Promise((r) => setTimeout(r, wait));

      // Llamada interna con service-role (la función valida via service-role short-circuit)
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/innapsis-emit`, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${SERVICE_KEY}`,
            "Content-Type": "application/json",
            "apikey": SERVICE_KEY,
          },
          body: JSON.stringify({ transmit_invoice_id: inv.id }),
        });
        const json = await res.json().catch(() => ({}));
        if (res.ok && (json as any)?.success !== false) {
          transmitted += 1;
        } else {
          errors.push({ invoice_id: inv.id, error: `HTTP ${res.status} ${JSON.stringify(json)}` });
        }
      } catch (e: any) {
        errors.push({ invoice_id: inv.id, error: String(e?.message ?? e) });
      } finally {
        lastCallByOrg.set(inv.organization_id, Date.now());
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      scanned: candidates.length,
      transmitted,
      skipped_offline: skipped,
      errors: errors.slice(0, 10),
      error_count: errors.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("contingency-flush error", e);
    return new Response(
      JSON.stringify({ error: String((e as Error)?.message ?? e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
