// Activa un terminal: valida cupo, firma un token Ed25519 con expiración corta.
// El desktop guarda el token y lo revalida en cada heartbeat.
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MASTER = Deno.env.get("LICENSE_MASTER_KEY") ?? "";

async function decryptPrivate(b64: string): Promise<Uint8Array> {
  const raw = new TextEncoder().encode(MASTER).slice(0, 32);
  const key = await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["decrypt"]);
  const buf = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  const iv = buf.slice(0, 12); const ct = buf.slice(12);
  return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct));
}
function b64u(b: Uint8Array) { return btoa(String.fromCharCode(...b)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_"); }

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { license_key, fingerprint, hostname, platform, app_version } = await req.json();
    if (!license_key || !fingerprint) throw new Error("missing fields");

    const { data: act, error } = await supa.rpc("register_activation", {
      _license_key: license_key, _fingerprint: fingerprint,
      _hostname: hostname, _platform: platform, _app_version: app_version,
    });
    if (error) throw error;

    const { data: lic } = await supa.from("licenses").select("metadata, public_key, expires_at").eq("id", (act as any).license_id).single();
    const enc = (lic?.metadata as any)?.signing_key;
    if (!enc) throw new Error("signing_key_missing");

    const privRaw = await decryptPrivate(enc);
    const privKey = await crypto.subtle.importKey("pkcs8", privRaw, { name: "Ed25519" }, false, ["sign"]);

    const payload = {
      sub: (act as any).activation_id,
      lic: (act as any).license_id,
      org: (act as any).organization_id,
      fp: fingerprint,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 7 * 24 * 3600, // 7 días
    };
    const header = { alg: "EdDSA", typ: "JWT" };
    const enc1 = (o: any) => b64u(new TextEncoder().encode(JSON.stringify(o)));
    const signingInput = `${enc1(header)}.${enc1(payload)}`;
    const sig = new Uint8Array(await crypto.subtle.sign({ name: "Ed25519" }, privKey, new TextEncoder().encode(signingInput)));
    const token = `${signingInput}.${b64u(sig)}`;

    return new Response(JSON.stringify({
      token, public_key: lic?.public_key, expires_at: lic?.expires_at,
      activation_id: (act as any).activation_id,
      max_terminals: (act as any).max_terminals,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message) }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
