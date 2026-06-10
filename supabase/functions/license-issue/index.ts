// Emite una licencia Ed25519 reforzada. Solo superadmin.
// Genera keypair Ed25519, guarda la privada cifrada en metadata.signing_key (AES-GCM con LICENSE_MASTER_KEY),
// devuelve license_key UUID que el cliente embebe en el instalador.
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const MASTER = Deno.env.get("LICENSE_MASTER_KEY") ?? "";

async function getMasterKey() {
  if (!MASTER || MASTER.length < 32) throw new Error("LICENSE_MASTER_KEY missing or <32 chars");
  const raw = new TextEncoder().encode(MASTER).slice(0, 32);
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptPrivate(privRaw: Uint8Array): Promise<string> {
  const key = await getMasterKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, privRaw));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv); out.set(ct, iv.length);
  return btoa(String.fromCharCode(...out));
}

function b64u(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      global: { headers: { Authorization: auth } },
    });
    const { data: userRes } = await supa.auth.getUser();
    if (!userRes?.user) return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { data: isSuper } = await supa.rpc("has_role", { _user_id: userRes.user.id, _role: "superadmin" });
    if (!isSuper) return new Response(JSON.stringify({ error: "forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const body = await req.json();
    const { organization_id, plan = "desktop_standard", max_terminals = 1, expires_at = null, notes = null } = body;
    if (!organization_id) throw new Error("organization_id required");

    // Genera keypair Ed25519
    const kp = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]) as CryptoKeyPair;
    const pubRaw = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
    const privPkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", kp.privateKey));
    const publicKey = b64u(pubRaw);
    const encPriv = await encryptPrivate(privPkcs8);
    const signing_key_id = crypto.randomUUID();

    const { data, error } = await supa.rpc("create_license", {
      _org_id: organization_id, _plan: plan, _max_terminals: max_terminals,
      _public_key: publicKey, _signing_key_id: signing_key_id,
      _expires_at: expires_at, _notes: notes,
    });
    if (error) throw error;

    // Guarda la privada cifrada en metadata
    await supa.from("licenses")
      .update({ metadata: { signing_key: encPriv } })
      .eq("id", (data as any).license_id);

    return new Response(JSON.stringify({
      license_id: (data as any).license_id,
      license_key: (data as any).license_key,
      public_key: publicKey,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message) }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
