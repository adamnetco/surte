// supabase/functions/sso-consume/index.ts
// Canjea un nonce SSO. Endpoint público: el nonce ES la autorización.
// Garantía de UN-SOLO-USO: DELETE ... RETURNING es atómico en Postgres.
// Si el nonce no existe (ya usado) o expiró → 404 explícito para el UI.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  let body: { nonce?: string };
  try { body = await req.json(); } catch { return json({ error: "invalid_body" }, 400); }
  const nonce = (body.nonce || "").trim();
  if (!UUID_RE.test(nonce)) return json({ error: "invalid_nonce" }, 400);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // DELETE atómico → si otra request ya lo consumió, devuelve 0 filas.
  const { data, error } = await admin
    .from("sso_handoff_tokens")
    .delete()
    .eq("nonce", nonce)
    .gt("expires_at", new Date().toISOString())
    .select("access_token, refresh_token, user_id")
    .maybeSingle();

  if (error) {
    console.error("sso-consume error", error);
    return json({ error: "consume_failed" }, 500);
  }
  if (!data) return json({ error: "expired_or_used" }, 404);

  return json({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    user_id: data.user_id,
  });
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status, headers: { ...cors, "Content-Type": "application/json" },
  });
}
