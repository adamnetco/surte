// Webhook dispatcher: claims pending deliveries, POSTs with HMAC-SHA256 signature,
// records result, schedules retry with exponential backoff.
// Runs every minute via pg_cron.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BATCH = 25;
const MAX_ATTEMPTS = 8;

// Backoff in minutes: 1, 5, 15, 60, 240, 720, 1440, 2880
const BACKOFF = [1, 5, 15, 60, 240, 720, 1440, 2880];

async function hmacSha256(secret: string, body: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const sb = createClient(SUPABASE_URL, SERVICE_KEY);

  // Claim a batch
  const { data: deliveries, error } = await sb
    .from("webhook_deliveries")
    .select("id, endpoint_id, event_type, payload, attempt_count, webhook_endpoints(url, secret, is_active)")
    .eq("status", "pending")
    .lte("next_attempt_at", new Date().toISOString())
    .order("next_attempt_at", { ascending: true })
    .limit(BATCH);

  if (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: corsHeaders });
  }

  const results = { processed: 0, success: 0, failed: 0, dead: 0 };

  for (const d of deliveries ?? []) {
    const ep = (d as any).webhook_endpoints;
    if (!ep || !ep.is_active) {
      await sb.from("webhook_deliveries").update({ status: "dead", last_response: "endpoint inactive" }).eq("id", d.id);
      results.dead++;
      continue;
    }

    const body = JSON.stringify({
      event: d.event_type,
      delivery_id: d.id,
      occurred_at: new Date().toISOString(),
      data: d.payload,
    });
    const signature = await hmacSha256(ep.secret, body);

    let status = 0;
    let respText = "";
    let ok = false;
    try {
      const resp = await fetch(ep.url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-sistecpos-event": d.event_type,
          "x-sistecpos-delivery": d.id,
          "x-sistecpos-signature": `sha256=${signature}`,
          "user-agent": "SistecPOS-Webhooks/1.0",
        },
        body,
        signal: AbortSignal.timeout(15000),
      });
      status = resp.status;
      respText = (await resp.text()).slice(0, 2000);
      ok = resp.ok;
    } catch (e: any) {
      respText = `network error: ${e?.message ?? e}`;
    }

    const attempt = (d.attempt_count ?? 0) + 1;
    results.processed++;

    if (ok) {
      await sb.from("webhook_deliveries").update({
        status: "success",
        attempt_count: attempt,
        last_status_code: status,
        last_response: respText,
        last_attempt_at: new Date().toISOString(),
      }).eq("id", d.id);
      await sb.from("webhook_endpoints").update({
        last_success_at: new Date().toISOString(),
        consecutive_failures: 0,
      }).eq("id", d.endpoint_id);
      results.success++;
    } else if (attempt >= MAX_ATTEMPTS) {
      await sb.from("webhook_deliveries").update({
        status: "dead",
        attempt_count: attempt,
        last_status_code: status,
        last_response: respText,
        last_attempt_at: new Date().toISOString(),
      }).eq("id", d.id);
      results.dead++;
    } else {
      const minutes = BACKOFF[Math.min(attempt - 1, BACKOFF.length - 1)];
      const next = new Date(Date.now() + minutes * 60 * 1000).toISOString();
      await sb.from("webhook_deliveries").update({
        status: "pending",
        attempt_count: attempt,
        last_status_code: status,
        last_response: respText,
        last_attempt_at: new Date().toISOString(),
        next_attempt_at: next,
      }).eq("id", d.id);
      await sb.rpc("noop_inc_webhook_failure", { p_endpoint: d.endpoint_id }).catch(() => {});
      results.failed++;
    }
  }

  return new Response(JSON.stringify(results), {
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
});
