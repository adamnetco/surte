// WebAuthn register verify — validates attestation, stores credential.
import { verifyRegistrationResponse } from "npm:@simplewebauthn/server@10.0.1";
import { isoBase64URL } from "npm:@simplewebauthn/server@10.0.1/helpers";
import { corsHeaders, preflight, json, safeJson } from "../_shared/auth-stub.ts";
import { userFromRequest, serviceClient, logAuthEvent } from "../_shared/auth-service.ts";
import { verifyChallenge } from "../_shared/auth-crypto.ts";

function rpFromReq(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  let host = "";
  try { host = new URL(origin).hostname; } catch { /* noop */ }
  return {
    rpID: Deno.env.get("AUTH_WEBAUTHN_RP_ID") ?? host || "localhost",
    origin,
  };
}

Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const user = await userFromRequest(req);
  if (!user || !user.email) return json({ error: "unauthorized" }, 401);

  const body = await safeJson<{ credential?: unknown; challenge_token?: string; device_label?: string }>(req);
  if (!body?.credential || !body.challenge_token) return json({ error: "invalid_body" }, 400);

  const expectedChallenge = await verifyChallenge(body.challenge_token, user.email, "register");
  if (!expectedChallenge) return json({ error: "invalid_or_expired_challenge" }, 400);

  const { rpID, origin } = rpFromReq(req);
  let verification;
  try {
    verification = await verifyRegistrationResponse({
      response: body.credential as never,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      requireUserVerification: false,
    });
  } catch (e) {
    await logAuthEvent("passkey_register_fail", user.id, req, { error: String(e) });
    return json({ error: "verification_failed", details: String(e) }, 400);
  }

  if (!verification.verified || !verification.registrationInfo) {
    return json({ error: "not_verified" }, 400);
  }

  const info = verification.registrationInfo;
  const credentialId = isoBase64URL.fromBuffer(info.credential.id);
  const publicKey = isoBase64URL.fromBuffer(info.credential.publicKey);

  const sb = serviceClient();
  const { error } = await sb.from("auth_webauthn_credentials").insert({
    user_id: user.id,
    credential_id: credentialId,
    public_key: publicKey,
    counter: info.credential.counter ?? 0,
    transports: (info.credential.transports ?? []) as unknown,
    device_label: body.device_label ?? null,
    aaguid: info.aaguid ?? null,
  });
  if (error) return json({ error: "store_failed", details: error.message }, 500);

  // Mark a webauthn factor presence row (for challenge lookup)
  await sb.from("auth_factors").upsert(
    { user_id: user.id, factor_type: "webauthn", verified_at: new Date().toISOString() },
    { onConflict: "user_id,factor_type", ignoreDuplicates: true } as never,
  );

  await logAuthEvent("passkey_register_ok", user.id, req, { credential_id: credentialId });
  return new Response(JSON.stringify({ ok: true, credential_id: credentialId }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
