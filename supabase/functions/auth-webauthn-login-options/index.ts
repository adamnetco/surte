// WebAuthn login options — issues PublicKeyCredentialRequestOptions for an email.
import { generateAuthenticationOptions } from "npm:@simplewebauthn/server@10.0.1";
import { corsHeaders, preflight, json, safeJson } from "../_shared/auth-stub.ts";
import { serviceClient, logAuthEvent } from "../_shared/auth-service.ts";
import { signChallenge } from "../_shared/auth-crypto.ts";

async function findUserIdByEmail(sb: ReturnType<typeof serviceClient>, email: string): Promise<string | null> {
  try {
    // @ts-expect-error newer SDK
    const r = await sb.auth.admin.getUserByEmail?.(email);
    return r?.data?.user?.id ?? null;
  } catch { return null; }
}

Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const body = await safeJson<{ email?: string }>(req);
  const email = String(body?.email ?? "").trim().toLowerCase();
  if (!email.includes("@")) return json({ error: "invalid_email" }, 400);

  const origin = req.headers.get("origin") ?? "";
  let host = ""; try { host = new URL(origin).hostname; } catch { /* noop */ }
  const rpID = Deno.env.get("AUTH_WEBAUTHN_RP_ID") ?? host || "localhost";

  const sb = serviceClient();
  const userId = await findUserIdByEmail(sb, email);
  let allowCredentials: { id: string; transports?: string[] }[] = [];
  if (userId) {
    const { data: creds } = await sb.from("auth_webauthn_credentials")
      .select("credential_id, transports")
      .eq("user_id", userId);
    allowCredentials = (creds ?? []).map((c) => ({
      id: c.credential_id as string,
      transports: (c.transports as string[]) ?? undefined,
    }));
  }

  const options = await generateAuthenticationOptions({
    rpID,
    allowCredentials,
    userVerification: "preferred",
  });

  const token = await signChallenge({ challenge: options.challenge, email, type: "login" });
  await logAuthEvent("passkey_login_options", userId, req, { email });
  return new Response(JSON.stringify({ options, challenge_token: token, rpID }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
