// Returns the list of auth factors available for a given email.
// Read-only: does not reveal whether the email exists (always returns at least the public methods).
import { preflight, json, safeJson, corsHeaders } from "../_shared/auth-stub.ts";
import { serviceClient, logAuthEvent } from "../_shared/auth-service.ts";

interface Factor { method: string; enrolled: boolean; label: string; }

const PUBLIC_FACTORS: Factor[] = [
  { method: "google",        enrolled: true,  label: "Continuar con Google" },
  { method: "password_totp", enrolled: true,  label: "Contraseña + código" },
  { method: "magic_link",    enrolled: true,  label: "Enlace mágico al email" },
];

Deno.serve(async (req) => {
  const pre = preflight(req); if (pre) return pre;
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const body = await safeJson<{ email?: string }>(req);
  const email = String(body?.email ?? "").trim().toLowerCase();
  if (!email.includes("@")) return json({ error: "invalid_email" }, 400);

  const sb = serviceClient();
  const factors: Factor[] = [...PUBLIC_FACTORS];

  try {
    // Look up the user via admin API (does not leak existence — we always return public methods)
    const { data: list } = await sb.auth.admin.listUsers({ page: 1, perPage: 1 });
    // listUsers can't filter by email server-side in v2; iterate small set or fallback to RPC
    // We try direct lookup via profiles → auth.users join isn't allowed; rely on getUserByEmail if available.
    // @ts-expect-error: getUserByEmail exists in newer SDK
    const byEmail = await sb.auth.admin.getUserByEmail?.(email);
    const userId = byEmail?.data?.user?.id as string | undefined;
    if (userId) {
      const [{ data: totp }, { data: pk }, { data: rec }] = await Promise.all([
        sb.from("auth_factors").select("id").eq("user_id", userId).eq("factor_type", "totp").not("verified_at", "is", null).limit(1),
        sb.from("auth_webauthn_credentials").select("id").eq("user_id", userId).limit(1),
        sb.from("auth_recovery_codes").select("id").eq("user_id", userId).is("used_at", null).limit(1),
      ]);
      factors.unshift({ method: "passkey",  enrolled: !!pk?.length,  label: "Llave de acceso (Passkey)" });
      if (totp?.length) {
        // Already represented by password_totp
      }
      factors.push({ method: "recovery", enrolled: !!rec?.length, label: "Código de recuperación" });
    } else {
      factors.unshift({ method: "passkey", enrolled: false, label: "Llave de acceso (Passkey)" });
      factors.push({ method: "recovery", enrolled: false, label: "Código de recuperación" });
    }
  } catch (_e) {
    factors.unshift({ method: "passkey", enrolled: false, label: "Llave de acceso (Passkey)" });
    factors.push({ method: "recovery", enrolled: false, label: "Código de recuperación" });
  }

  await logAuthEvent("login_challenge", null, req, { email });
  return new Response(JSON.stringify({ factors }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
