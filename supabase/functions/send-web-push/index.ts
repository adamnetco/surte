// Send Web Push notifications using VAPID. Pure-Deno implementation
// (no npm:web-push needed) so it works in Supabase Edge runtime.
//
// Body:
//   { title, body, url?, icon?, segment?: 'all'|'offers'|'news'|'order_updates', sent_by?: uuid }
//
// Secrets required: VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:...)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { encode as b64urlEncode } from "https://deno.land/std@0.224.0/encoding/base64url.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ── VAPID JWT (ES256) ─────────────────────────────────────────
async function importVapidPrivateKey(b64urlPriv: string): Promise<CryptoKey> {
  // VAPID private key is the raw 32-byte 'd' scalar of P-256.
  const raw = Uint8Array.from(atob(b64urlPriv.replace(/-/g, "+").replace(/_/g, "/").padEnd(b64urlPriv.length + (4 - b64urlPriv.length % 4) % 4, "=")), c => c.charCodeAt(0));
  // Wrap as JWK (need x and y from public key for full JWK; derive from public)
  // Easier: use raw 'pkcs8' import path by constructing a minimal pkcs8 PrivateKeyInfo.
  // To keep this simple & correct, require the user to provide PRIVATE in JWK 'd'
  // and PUBLIC in uncompressed P-256 form, then construct JWK.
  const pubB64 = Deno.env.get("VAPID_PUBLIC_KEY")!;
  const pubRaw = Uint8Array.from(atob(pubB64.replace(/-/g, "+").replace(/_/g, "/").padEnd(pubB64.length + (4 - pubB64.length % 4) % 4, "=")), c => c.charCodeAt(0));
  // pubRaw is 65 bytes: 0x04 || X(32) || Y(32)
  const x = pubRaw.slice(1, 33);
  const y = pubRaw.slice(33, 65);
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    d: b64urlEncode(raw),
    x: b64urlEncode(x),
    y: b64urlEncode(y),
    ext: true,
  };
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

async function makeVapidJWT(audience: string): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const payload = {
    aud: audience,
    exp: Math.floor(Date.now() / 1000) + 12 * 3600,
    sub: Deno.env.get("VAPID_SUBJECT") || "mailto:hola@surteya.com",
  };
  const enc = (o: any) => b64urlEncode(new TextEncoder().encode(JSON.stringify(o)));
  const unsigned = `${enc(header)}.${enc(payload)}`;
  const key = await importVapidPrivateKey(Deno.env.get("VAPID_PRIVATE_KEY")!);
  const sigDer = new Uint8Array(
    await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, new TextEncoder().encode(unsigned))
  );
  return `${unsigned}.${b64urlEncode(sigDer)}`;
}

// ── Push payload encryption (aes128gcm) ───────────────────────
async function encryptPayload(payload: string, p256dhB64: string, authB64: string) {
  const decode = (b64: string) =>
    Uint8Array.from(atob(b64.replace(/-/g, "+").replace(/_/g, "/").padEnd(b64.length + (4 - b64.length % 4) % 4, "=")), c => c.charCodeAt(0));
  const userPubBytes = decode(p256dhB64);
  const userAuth = decode(authB64);

  const localPair = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const localPubRaw = new Uint8Array(await crypto.subtle.exportKey("raw", localPair.publicKey));

  const userPubKey = await crypto.subtle.importKey(
    "raw", userPubBytes, { name: "ECDH", namedCurve: "P-256" }, false, []
  );
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: "ECDH", public: userPubKey }, localPair.privateKey, 256)
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));

  const hkdf = async (key: Uint8Array, salt: Uint8Array, info: Uint8Array, length: number) => {
    const k = await crypto.subtle.importKey("raw", key, "HKDF", false, ["deriveBits"]);
    return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, k, length * 8));
  };

  // PRK_key = HKDF(auth, sharedSecret, "WebPush: info\0" || ua_public || as_public, 32)
  const keyInfo = new Uint8Array([
    ...new TextEncoder().encode("WebPush: info\0"),
    ...userPubBytes, ...localPubRaw,
  ]);
  const ikm = await hkdf(sharedSecret, userAuth, keyInfo, 32);

  // CEK
  const cek = await hkdf(ikm, salt, new TextEncoder().encode("Content-Encoding: aes128gcm\0"), 16);
  // Nonce
  const nonce = await hkdf(ikm, salt, new TextEncoder().encode("Content-Encoding: nonce\0"), 12);

  const aesKey = await crypto.subtle.importKey("raw", cek, { name: "AES-GCM" }, false, ["encrypt"]);
  const plaintext = new TextEncoder().encode(payload);
  const padded = new Uint8Array(plaintext.length + 1);
  padded.set(plaintext);
  padded[plaintext.length] = 0x02; // delimiter for last record

  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aesKey, padded)
  );

  // aes128gcm header: salt(16) || rs(4 BE) || idlen(1) || keyid (= localPubRaw 65)
  const rs = new Uint8Array([0, 0, 16, 0]); // 4096
  const idlen = new Uint8Array([localPubRaw.length]);
  const header = new Uint8Array(16 + 4 + 1 + localPubRaw.length);
  header.set(salt, 0);
  header.set(rs, 16);
  header.set(idlen, 20);
  header.set(localPubRaw, 21);

  const body = new Uint8Array(header.length + ciphertext.length);
  body.set(header, 0);
  body.set(ciphertext, header.length);
  return body;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabase = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    if (!Deno.env.get("VAPID_PUBLIC_KEY") || !Deno.env.get("VAPID_PRIVATE_KEY")) {
      return new Response(JSON.stringify({ error: "VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY no configurados" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));

    // Public action: return VAPID public key for the SPA to subscribe.
    if (body?.action === "public_key") {
      return new Response(JSON.stringify({ publicKey: Deno.env.get("VAPID_PUBLIC_KEY") }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── AUTH + TENANT SCOPE (Etapa 16) ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
    const userId = claims?.claims?.sub;
    if (!userId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { title, body: msg, url, icon, segment = "all", sent_by = null, organization_id } = body;
    if (!title || !msg) {
      return new Response(JSON.stringify({ error: "title y body son requeridos" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!organization_id) {
      return new Response(JSON.stringify({ error: "organization_id es requerido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Membership + role check: solo owner/admin puede hacer broadcast
    const { data: membership } = await supabase
      .from("organization_members")
      .select("role")
      .eq("organization_id", organization_id)
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();
    if (!membership || !["owner", "admin"].includes(membership.role)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Audience scoped to the organization
    let q = supabase
      .from("push_subscriptions")
      .select("*")
      .eq("is_active", true)
      .eq("organization_id", organization_id);
    if (segment === "offers") q = q.eq("notify_offers", true);
    if (segment === "news") q = q.eq("notify_news", true);
    if (segment === "order_updates") q = q.eq("notify_order_updates", true);
    const { data: subs, error } = await q;
    if (error) throw error;

    const payload = JSON.stringify({ title, body: msg, url: url || "/", icon: icon || "/icons/icon-192.png" });

    let sent = 0, failed = 0;
    const errors: any[] = [];

    for (const sub of subs || []) {
      try {
        const audience = new URL(sub.endpoint).origin;
        const jwt = await makeVapidJWT(audience);
        const encrypted = await encryptPayload(payload, sub.p256dh, sub.auth);
        const res = await fetch(sub.endpoint, {
          method: "POST",
          headers: {
            "Content-Encoding": "aes128gcm",
            "Content-Type": "application/octet-stream",
            "Authorization": `vapid t=${jwt}, k=${Deno.env.get("VAPID_PUBLIC_KEY")}`,
            "TTL": "86400",
            "Urgency": "normal",
          },
          body: encrypted,
        });
        if (res.ok || res.status === 201) {
          sent++;
        } else if (res.status === 404 || res.status === 410) {
          // Endpoint expired → mark inactive
          await supabase.from("push_subscriptions").update({ is_active: false }).eq("id", sub.id);
          failed++;
          errors.push({ endpoint: sub.endpoint.slice(-32), error: `HTTP ${res.status} (expired)` });
        } else {
          failed++;
          const txt = await res.text().catch(() => "");
          errors.push({ endpoint: sub.endpoint.slice(-32), error: `HTTP ${res.status}: ${txt.slice(0, 120)}` });
        }
      } catch (err) {
        failed++;
        errors.push({ endpoint: sub.endpoint.slice(-32), error: err instanceof Error ? err.message : String(err) });
      }
    }

    await supabase.from("push_broadcast_logs").insert({
      title, body: msg, url, icon, segment,
      total: subs?.length || 0, sent, failed,
      status: failed === (subs?.length || 0) && sent === 0 ? "failed" : "completed",
      errors: errors.slice(0, 50),
      sent_by,
    });

    return new Response(JSON.stringify({ success: true, total: subs?.length || 0, sent, failed }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-web-push error:", err);
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : "Error interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
