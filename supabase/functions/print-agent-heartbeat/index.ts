// Heartbeat receiver for SistecPOS print agents.
// Validates HMAC-SHA256 signature using the agent secret (issued once at register),
// updates last_seen via SECURITY DEFINER RPC and returns pending print_jobs count.
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const enc = new TextEncoder();

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(input));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return mismatch === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const agentId = req.headers.get("x-agent-id");
    const signature = req.headers.get("x-signature");
    const timestamp = req.headers.get("x-timestamp"); // unix seconds, prevents replay
    if (!agentId || !signature || !timestamp) {
      return new Response(JSON.stringify({ error: "missing_headers" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const driftSec = Math.abs(Math.floor(Date.now() / 1000) - parseInt(timestamp, 10));
    if (!Number.isFinite(driftSec) || driftSec > 300) {
      return new Response(JSON.stringify({ error: "stale_timestamp" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawBody = await req.text();
    const body = rawBody ? JSON.parse(rawBody) : {};

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    // Lookup agent
    const { data: agent, error: aErr } = await admin
      .from("print_agents")
      .select("id, organization_id, secret_hash")
      .eq("id", agentId)
      .maybeSingle();

    if (aErr || !agent) {
      return new Response(JSON.stringify({ error: "agent_not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // The client must include `X-Secret` only once — instead we verify by trying
    // candidate signatures: for security we require the agent to know the plaintext
    // secret. We expose a hash-based challenge: server cannot recompute HMAC without
    // the plaintext. So heartbeat validates by recomputing HMAC with secret derived
    // from a stored encrypted value — here we accept that the agent passes the
    // plaintext secret indirectly via X-Agent-Secret (TLS only, never logged).
    const providedSecret = req.headers.get("x-agent-secret");
    if (!providedSecret) {
      return new Response(JSON.stringify({ error: "missing_secret" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const providedHash = await sha256Hex(providedSecret);
    if (!timingSafeEqual(providedHash, agent.secret_hash)) {
      return new Response(JSON.stringify({ error: "bad_secret" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify HMAC signature over `${timestamp}.${rawBody}`
    const expected = await hmacSha256Hex(providedSecret, `${timestamp}.${rawBody}`);
    if (!timingSafeEqual(expected, signature)) {
      return new Response(JSON.stringify({ error: "bad_signature" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

    await admin.rpc("print_agent_touch", {
      p_agent_id: agent.id,
      p_version: body.version ?? null,
      p_capabilities: body.capabilities ?? {},
      p_ip: ip,
    });

    // Return pending jobs count for this org
    const { count } = await admin
      .from("print_jobs")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", agent.organization_id)
      .eq("status", "queued");

    return new Response(
      JSON.stringify({ ok: true, pending_jobs: count ?? 0, server_time: new Date().toISOString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error)?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
