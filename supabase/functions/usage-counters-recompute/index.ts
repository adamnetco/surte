import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const t0 = Date.now();
  const { data: total, error } = await supa.rpc("recompute_all_usage_counters");
  if (error) {
    await supa.from("health_events").insert({
      source: "usage_counters",
      status: "failed",
      message: error.message,
    });
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Check divergence after recompute
  const { data: drift } = await supa
    .from("v_usage_counter_divergence")
    .select("organization_id,limit_key,drift")
    .limit(50);

  await supa.from("health_events").insert({
    source: "usage_counters",
    status: (drift?.length ?? 0) > 0 ? "warning" : "ok",
    message: `recomputed=${total} drift_rows=${drift?.length ?? 0}`,
    latency_ms: Date.now() - t0,
    metadata: { drift: drift?.slice(0, 10) ?? [] },
  });

  return new Response(
    JSON.stringify({ ok: true, recomputed: total, drift_rows: drift?.length ?? 0 }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
