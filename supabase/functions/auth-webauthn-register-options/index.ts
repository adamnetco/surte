// WebAuthn register options — emits PublicKeyCredentialCreationOptions and a signed challenge token.
import { generateRegistrationOptions } from "npm:@simplewebauthn/server@10.0.1";
import { isoBase64URL } from "npm:@simplewebauthn/server@10.0.1/helpers";
import { corsHeaders, preflight, json } from "../_shared/auth-stub.ts";
import { userFromRequest, serviceClient, logAuthEvent } from "../_shared/auth-service.ts";
import { signChallenge } from "../_shared/auth-crypto.ts";

function rpFromReq(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  let host = "";
  try { host = new URL(origin).hostname; } catch { /* noop */ }
  return {
    rpID: Deno.env.get("AUTH_WEBAUTHN_RP_ID") ?? host || "localhost",
    rpName: "SistecPOS",
    origin,
  };
}

Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const user = await userFromRequest(req);
  if (!user || !user.email) return json({ error: "unauthorized" }, 401);

  const { rpID, rpName } = rpFromReq(req);
  const sb = serviceClient();
  const { data: existing } = await sb.from("auth_webauthn_credentials")
    .select("credential_id, transports")
    .eq("user_id", user.id);

  const userIdBytes = new TextEncoder().encode(user.id);
  const options = await generateRegistrationOptions({
    rpID,
    rpName,
    userID: userIdBytes,
    userName: user.email,
    userDisplayName: user.email,
    attestationType: "none",
    authenticatorSelection: { userVerification: "preferred", residentKey: "preferred" },
    excludeCredentials: (existing ?? []).map((c) => ({
      id: c.credential_id as string,
      transports: (c.transports as string[]) ?? undefined,
    })),
  });

  const token = await signChallenge({ challenge: options.challenge, email: user.email, type: "register" });
  await logAuthEvent("passkey_register_options", user.id, req);
  return new Response(JSON.stringify({ options, challenge_token: token, rpID }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
