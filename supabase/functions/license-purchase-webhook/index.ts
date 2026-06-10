// Webhook llamado por SistecPOS Lovable cuando se confirma compra de licencia.
// 1. Valida shared secret (header x-purchase-secret)
// 2. Crea organization (si no existe por slug)
// 3. Inserta org_signup_request (auditoría) y license vía RPC create_license
// 4. Activa módulos solicitados
// 5. Envía invitación al owner (magic link via supabase admin)
// 6. Responde con organization_id, license_key, invite_link
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-purchase-secret",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SECRET = Deno.env.get("LICENSE_PURCHASE_SECRET") ?? "";
const MASTER = Deno.env.get("LICENSE_MASTER_KEY") ?? "";

async function encryptPrivate(privRaw: Uint8Array): Promise<string> {
  const raw = new TextEncoder().encode(MASTER).slice(0, 32);
  const key = await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, privRaw));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv); out.set(ct, iv.length);
  return btoa(String.fromCharCode(...out));
}
const b64u = (b: Uint8Array) => btoa(String.fromCharCode(...b)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
const slugify = (s: string) => s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    if (!SECRET || req.headers.get("x-purchase-secret") !== SECRET) {
      return new Response(JSON.stringify({ error: "unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (!MASTER || MASTER.length < 32) throw new Error("LICENSE_MASTER_KEY missing");

    const body = await req.json();
    const {
      email, full_name, phone, business_name, nit,
      plan = "desktop_standard", modules = [], max_terminals = 1,
      amount_cop, payment_provider, payment_reference,
      business_type = "retail", raw = {},
    } = body;
    if (!email || !business_name) throw new Error("email & business_name required");

    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 1. Crear/obtener organization
    let slug = slugify(business_name);
    let { data: org } = await supa.from("organizations").select("id, slug").eq("slug", slug).maybeSingle();
    if (!org) {
      let unique = slug;
      for (let i = 2; i < 20; i++) {
        const { data: hit } = await supa.from("organizations").select("id").eq("slug", unique).maybeSingle();
        if (!hit) break;
        unique = `${slug}-${i}`;
      }
      const { data: created, error: orgErr } = await supa.from("organizations")
        .insert({ slug: unique, name: business_name, business_type, tax_id: nit ?? null })
        .select("id, slug").single();
      if (orgErr) throw orgErr;
      org = created;
    }

    // 2. Activar módulos
    if (Array.isArray(modules) && modules.length) {
      const rows = modules.map((m: string) => ({ organization_id: org!.id, module_key: m, enabled: true }));
      await supa.from("organization_modules").upsert(rows, { onConflict: "organization_id,module_key" });
    }

    // 3. Generar licencia Ed25519
    const kp = await crypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]) as CryptoKeyPair;
    const pubRaw = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
    const privPkcs8 = new Uint8Array(await crypto.subtle.exportKey("pkcs8", kp.privateKey));
    const publicKey = b64u(pubRaw);
    const encPriv = await encryptPrivate(privPkcs8);
    const signing_key_id = crypto.randomUUID();

    const { data: lic, error: licErr } = await supa.rpc("create_license", {
      _org_id: org.id, _plan: plan, _max_terminals: max_terminals,
      _public_key: publicKey, _signing_key_id: signing_key_id,
      _expires_at: null, _notes: `auto: ${payment_provider ?? "n/a"} ${payment_reference ?? ""}`.trim(),
    });
    if (licErr) throw licErr;
    await supa.from("licenses").update({ metadata: { signing_key: encPriv } }).eq("id", (lic as any).license_id);

    // 4. Registrar signup_request fulfilled
    await supa.from("org_signup_requests").insert({
      email, full_name: full_name ?? business_name, phone: phone ?? null,
      business_name, business_slug: org.slug, nit: nit ?? null,
      plan, modules, max_terminals,
      amount_cop: amount_cop ?? null, payment_provider: payment_provider ?? null,
      payment_reference: payment_reference ?? null,
      status: "fulfilled",
      fulfilled_organization_id: org.id, fulfilled_license_id: (lic as any).license_id,
      raw_payload: raw, fulfilled_at: new Date().toISOString(),
    });

    // 5. Invitar owner (magic link)
    const adminUrl = Deno.env.get("ADMIN_INVITE_REDIRECT") ?? "https://admin.sistecpos.com/auth/accept-invite";
    const { data: invite } = await supa.auth.admin.generateLink({
      type: "invite", email,
      options: { redirectTo: `${adminUrl}?org=${org.slug}`, data: { organization_id: org.id, business_name } },
    });

    return new Response(JSON.stringify({
      organization_id: org.id,
      organization_slug: org.slug,
      license_id: (lic as any).license_id,
      license_key: (lic as any).license_key,
      public_key: publicKey,
      invite_link: invite?.properties?.action_link ?? null,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String((e as Error).message) }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
