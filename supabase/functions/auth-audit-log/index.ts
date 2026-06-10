// Records a client-reported auth event. Server enriches with IP/UA.
import { preflight, json, safeJson, corsHeaders } from "../_shared/auth-stub.ts";
import { userFromRequest, logAuthEvent } from "../_shared/auth-service.ts";

Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const user = await userFromRequest(req);
  if (!user) return json({ error: "unauthorized" }, 401);
  const body = await safeJson<{ event?: string; details?: Record<string, unknown>; risk_score?: number }>(req);
  const event = String(body?.event ?? "").trim();
  if (!event || event.length > 64) return json({ error: "invalid_event" }, 400);
  await logAuthEvent(event, user.id, req, body?.details ?? {}, Number(body?.risk_score ?? 0));
  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
