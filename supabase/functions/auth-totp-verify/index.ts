// TOTP verify: validates a 6-digit code against the user's stored secret.
import { preflight, json, safeJson, corsHeaders } from "../_shared/auth-stub.ts";
import { userFromRequest, serviceClient, logAuthEvent } from "../_shared/auth-service.ts";
import { decryptSecret, totpVerify } from "../_shared/auth-crypto.ts";

Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const user = await userFromRequest(req);
  if (!user) return json({ error: "unauthorized" }, 401);
  const body = await safeJson<{ code?: string }>(req);
  const code = String(body?.code ?? "").trim();
  if (!/^\d{6}$/.test(code)) return json({ error: "invalid_code_format" }, 400);

  const sb = serviceClient();
  const { data: factors } = await sb.from("auth_factors")
    .select("id,secret_encrypted,verified_at")
    .eq("user_id", user.id)
    .eq("factor_type", "totp")
    .order("created_at", { ascending: false })
    .limit(1);
  const factor = factors?.[0];
  if (!factor) return json({ error: "no_factor" }, 404);

  let secret: string;
  try { secret = await decryptSecret(factor.secret_encrypted as string); }
  catch { return json({ error: "decrypt_failed" }, 500); }

  const ok = await totpVerify(secret, code, 1);
  if (!ok) {
    await logAuthEvent("totp_verify_fail", user.id, req);
    return json({ error: "invalid_code" }, 401);
  }
  await sb.from("auth_factors").update({
    verified_at: factor.verified_at ?? new Date().toISOString(),
    last_used_at: new Date().toISOString(),
  }).eq("id", factor.id);
  await logAuthEvent("totp_verify_ok", user.id, req);
  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
