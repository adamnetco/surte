// supabase/functions/sso-issue/index.ts
// Emite un NONCE de un solo uso para handoff SSO entre subdominios.
// El cliente envía sus tokens (access via Authorization, refresh en body);
// se guardan server-side con TTL corto. Solo el nonce viaja en la URL.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const TTL_SECONDS = 60;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return json({ error: "method_not_allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);
  const access_token = authHeader.replace("Bearer ", "");

  let body: { refresh_token?: string; target_tenant?: string };
  try { body = await req.json(); } catch { return json({ error: "invalid_body" }, 400); }
  const refresh_token = (body.refresh_token || "").trim();
  const target_tenant = (body.target_tenant || "").trim().slice(0, 16);
  if (!refresh_token || refresh_token.length < 16) return json({ error: "missing_refresh" }, 400);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Validar JWT
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claimsData, error: claimsErr } = await userClient.auth.getClaims(access_token);
  if (claimsErr || !claimsData?.claims?.sub) return json({ error: "invalid_token" }, 401);
  const user_id = claimsData.claims.sub as string;

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // Best-effort cleanup de tokens vencidos
  await admin.from("sso_handoff_tokens").delete().lt("expires_at", new Date().toISOString());

  const expires_at = new Date(Date.now() + TTL_SECONDS * 1000).toISOString();
  const { data, error } = await admin
    .from("sso_handoff_tokens")
    .insert({
      user_id,
      access_token,
      refresh_token,
      target_tenant: target_tenant || null,
      issuer_ip: req.headers.get("x-forwarded-for") ?? null,
      issuer_ua: req.headers.get("user-agent")?.slice(0, 255) ?? null,
      expires_at,
    })
    .select("nonce")
    .single();

  if (error || !data) {
    console.error("sso-issue insert failed", error);
    return json({ error: "issue_failed" }, 500);
  }
  return json({ nonce: data.nonce, expires_at, ttl: TTL_SECONDS });
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status, headers: { ...cors, "Content-Type": "application/json" },
  });
}
