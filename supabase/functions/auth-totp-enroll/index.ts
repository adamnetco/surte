// TOTP enrollment: generates a secret, stores encrypted (unverified) and returns otpauth URI.
import { corsHeaders, preflight, json, safeJson } from "../_shared/auth-stub.ts";
import { userFromRequest, serviceClient, logAuthEvent } from "../_shared/auth-service.ts";
import { encryptSecret, generateTotpSecret, otpauthUri } from "../_shared/auth-crypto.ts";

Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const user = await userFromRequest(req);
  if (!user) return json({ error: "unauthorized" }, 401);

  const sb = serviceClient();
  const secret = generateTotpSecret();
  const enc = await encryptSecret(secret);

  // Remove any previous unverified TOTP factor
  await sb.from("auth_factors")
    .delete()
    .eq("user_id", user.id)
    .eq("factor_type", "totp")
    .is("verified_at", null);

  const { error } = await sb.from("auth_factors").insert({
    user_id: user.id,
    factor_type: "totp",
    secret_encrypted: enc,
  });
  if (error) return json({ error: "insert_failed", details: error.message }, 500);

  await logAuthEvent("totp_enroll_start", user.id, req);
  const uri = otpauthUri(user.email ?? user.id, secret);
  return new Response(
    JSON.stringify({ otpauth_uri: uri, secret }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
