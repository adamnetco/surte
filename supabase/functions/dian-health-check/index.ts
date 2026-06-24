// Edge function: dian-health-check
// Cron 5 min. Agrega `einvoice_events` recientes y actualiza
// `einvoice_configs.dian_health_status` por organización.
// AC10 de POS-innapsis-emision-pos.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const WINDOW_MIN = 5;
const DEGRADED_ERROR_RATE = 0.2; // 20% errores en 5min
const OFFLINE_ERROR_RATE = 0.5; // 50% errores en 5min
const MIN_SAMPLE = 3;

type Health = "online" | "degraded" | "offline";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const since = new Date(Date.now() - WINDOW_MIN * 60_000).toISOString();

    // Eventos recientes agrupables por org
    const { data: events, error } = await admin
      .from("einvoice_events")
      .select("organization_id, event_type")
      .gte("created_at", since);

    if (error) throw error;

    const byOrg = new Map<string, { ok: number; err: number }>();
    for (const ev of events ?? []) {
      const orgId = (ev as any).organization_id as string | null;
      if (!orgId) continue;
      const slot = byOrg.get(orgId) ?? { ok: 0, err: 0 };
      const t = String((ev as any).event_type ?? "");
      if (
        t.includes("emit_retry_failed") ||
        t.includes("emit_retry_permanent") ||
        t.includes("dead_letter") ||
        t.includes("rejected") ||
        t.includes("error")
      ) {
        slot.err += 1;
      } else if (
        t.includes("accepted") ||
        t.includes("approved") ||
        t.includes("emit_retry_success") ||
        t.includes("sent")
      ) {
        slot.ok += 1;
      }
      byOrg.set(orgId, slot);
    }

    const updates: { organization_id: string; status: Health }[] = [];
    for (const [organization_id, { ok, err }] of byOrg) {
      const total = ok + err;
      let status: Health = "online";
      if (total >= MIN_SAMPLE) {
        const rate = err / total;
        if (rate >= OFFLINE_ERROR_RATE) status = "offline";
        else if (rate >= DEGRADED_ERROR_RATE) status = "degraded";
      }
      updates.push({ organization_id, status });
    }

    // Aplicar updates por org (uno a uno: bajo volumen)
    let touched = 0;
    for (const u of updates) {
      const { error: upErr } = await admin
        .from("einvoice_configs")
        .update({ dian_health_status: u.status })
        .eq("organization_id", u.organization_id);
      if (!upErr) touched += 1;
    }

    return new Response(
      JSON.stringify({
        ok: true,
        window_min: WINDOW_MIN,
        organizations_evaluated: byOrg.size,
        organizations_updated: touched,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(
      JSON.stringify({ error: String((e as Error)?.message ?? e) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
