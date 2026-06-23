// WebAuthn login verify — checks assertion and returns a Supabase magiclink token_hash to sign in.
import { verifyAuthenticationResponse } from "npm:@simplewebauthn/server@10.0.1";
import { isoBase64URL } from "npm:@simplewebauthn/server@10.0.1/helpers";
import { corsHeaders, preflight, json, safeJson } from "../_shared/auth-stub.ts";
import { serviceClient, logAuthEvent } from "../_shared/auth-service.ts";
import { verifyChallenge } from "../_shared/auth-crypto.ts";

Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const body = await safeJson<{ email?: string; credential?: any; challenge_token?: string }>(req);
  const email = String(body?.email ?? "").trim().toLowerCase();
  if (!email.includes("@") || !body?.credential || !body.challenge_token) {
    return json({ error: "invalid_body" }, 400);
  }

  const expectedChallenge = await verifyChallenge(body.challenge_token, email, "login");
  if (!expectedChallenge) return json({ error: "invalid_or_expired_challenge" }, 400);

  const origin = req.headers.get("origin") ?? "";
  let host = ""; try { host = new URL(origin).hostname; } catch { /* noop */ }
  const rpID = Deno.env.get("AUTH_WEBAUTHN_RP_ID") ?? host || "localhost";

  const sb = serviceClient();
  const credentialId = body.credential.id as string;
  const { data: cred } = await sb.from("auth_webauthn_credentials")
    .select("id, user_id, credential_id, public_key, counter, transports")
    .eq("credential_id", credentialId)
    .maybeSingle();
  if (!cred) {
    await logAuthEvent("passkey_login_fail", null, req, { reason: "unknown_credential", email });
    return json({ error: "unknown_credential" }, 401);
  }

  // Make sure credential belongs to the claimed email
  // @ts-expect-error
  const userLookup = await sb.auth.admin.getUserById(cred.user_id);
  if (!userLookup?.data?.user || userLookup.data.user.email?.toLowerCase() !== email) {
    return json({ error: "email_mismatch" }, 401);
  }

  let verification;
  try {
    verification = await verifyAuthenticationResponse({
      response: body.credential,
      expectedChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: cred.credential_id as string,
        publicKey: isoBase64URL.toBuffer(cred.public_key as string),
        counter: Number(cred.counter ?? 0),
        transports: (cred.transports as string[]) ?? undefined,
      },
      requireUserVerification: false,
    });
  } catch (e) {
    await logAuthEvent("passkey_login_fail", cred.user_id as string, req, { error: String(e) });
    return json({ error: "verification_failed", details: String(e) }, 401);
  }

  if (!verification.verified) {
    await logAuthEvent("passkey_login_fail", cred.user_id as string, req, { reason: "not_verified" });
    return json({ error: "not_verified" }, 401);
  }

  await sb.from("auth_webauthn_credentials").update({
    counter: verification.authenticationInfo.newCounter,
    last_used_at: new Date().toISOString(),
  }).eq("id", cred.id);

  // Issue a Supabase magiclink so the browser can establish a session
  // @ts-expect-error
  const link = await sb.auth.admin.generateLink({ type: "magiclink", email });
  const tokenHash = link?.data?.properties?.hashed_token as string | undefined;
  if (!tokenHash) {
    return json({ error: "session_issue_failed" }, 500);
  }

  await logAuthEvent("passkey_login_ok", cred.user_id as string, req);
  return new Response(JSON.stringify({ ok: true, token_hash: tokenHash, email }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
