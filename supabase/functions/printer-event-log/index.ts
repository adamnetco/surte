// Logs a printer health event from the client (POSStatusBar).
// Best-effort persistence; never blocks UI on failure.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-correlation-id",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

const ALLOWED = new Set(["ok", "warn", "off", "error", "idle"]);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authz = req.headers.get("Authorization") ?? "";
  if (!authz.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  let body: {
    organization_id?: string;
    status?: string;
    prev_status?: string;
    latency_ms?: number;
    message?: string;
    metadata?: Record<string, unknown>;
  };
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }

  const orgId = String(body.organization_id ?? "").trim();
  const status = String(body.status ?? "").trim();
  if (!orgId) return json({ error: "organization_id_required" }, 400);
  if (!ALLOWED.has(status)) return json({ error: "invalid_status" }, 400);

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authz } }, auth: { persistSession: false } },
  );
  const { data: u } = await sb.auth.getUser();
  if (!u?.user) return json({ error: "unauthorized" }, 401);

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // Membership check (admin/superadmin/owner/cashier writes printer events)
  const { data: member } = await admin
    .from("organization_members")
    .select("user_id, role")
    .eq("organization_id", orgId)
    .eq("user_id", u.user.id)
    .maybeSingle();
  if (!member) {
    const { data: isSuper } = await admin.rpc("has_role", { _user_id: u.user.id, _role: "superadmin" });
    if (!isSuper) return json({ error: "forbidden" }, 403);
  }

  const correlationId = req.headers.get("x-correlation-id") ?? crypto.randomUUID();
  const { error } = await admin.from("health_events").insert({
    organization_id: orgId,
    source: "printer",
    status,
    prev_status: body.prev_status ?? null,
    latency_ms: typeof body.latency_ms === "number" ? body.latency_ms : null,
    message: body.message ?? null,
    correlation_id: correlationId,
    metadata: body.metadata ?? {},
  });
  if (error) return json({ error: "insert_failed", detail: error.message }, 500);

  return json({ ok: true, correlation_id: correlationId });
});
