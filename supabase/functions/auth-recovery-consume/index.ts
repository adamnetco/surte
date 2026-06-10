// Consume a single-use recovery code. Marks it used on success.
import { preflight, json, safeJson, corsHeaders } from "../_shared/auth-stub.ts";
import { userFromRequest, serviceClient, logAuthEvent } from "../_shared/auth-service.ts";
import { hashRecovery } from "../_shared/auth-crypto.ts";

Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const user = await userFromRequest(req);
  if (!user) return json({ error: "unauthorized" }, 401);

  const body = await safeJson<{ code?: string }>(req);
  const code = String(body?.code ?? "").trim();
  if (code.length < 8) return json({ error: "invalid_code_format" }, 400);

  const sb = serviceClient();
  const hash = await hashRecovery(code);
  const { data: row } = await sb.from("auth_recovery_codes")
    .select("id,used_at")
    .eq("user_id", user.id)
    .eq("code_hash", hash)
    .is("used_at", null)
    .maybeSingle();
  if (!row) {
    await logAuthEvent("recovery_consume_fail", user.id, req);
    return json({ error: "invalid_or_used" }, 401);
  }
  await sb.from("auth_recovery_codes").update({ used_at: new Date().toISOString() }).eq("id", row.id);
  await logAuthEvent("recovery_consume_ok", user.id, req);
  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
