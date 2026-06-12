// Etapa 2 SaaS refactor — Provisión atómica de licencia/organización.
// Crea: auth.user (owner) → Ed25519 keypair → RPC provision_organization → magic link.
// Idempotente por payment_reference. Solo superadmin o service_role.
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3.23.8";

const BodySchema = z.object({
  owner_email: z.string().email(),
  org_name: z.string().min(2).max(120),
  org_slug: z.string().min(2).max(60).optional(),
  business_type: z.string().default("minimercado"),
  plan: z.string().default("desktop_standard"),
  max_terminals: z.number().int().min(1).max(50).default(1),
  expires_at: z.string().datetime().optional(),
  modules: z.array(z.string()).default(["pos", "inventory", "catalog"]),
  payment_reference: z.string().optional(),
  full_name: z.string().optional(),
  phone: z.string().optional(),
  metadata: z.record(z.any()).default({}),
  redirect_to: z.string().url().optional(),
});

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

async function generateEd25519Keypair() {
  const kp = await crypto.subtle.generateKey("Ed25519", true, ["sign", "verify"]) as CryptoKeyPair;
  const pubRaw = new Uint8Array(await crypto.subtle.exportKey("raw", kp.publicKey));
  const pubB64 = btoa(String.fromCharCode(...pubRaw));
  const keyId = "k_" + crypto.randomUUID().slice(0, 8);
  return { public_key: pubB64, signing_key_id: keyId };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const json = (data: unknown, status = 200) =>
    new Response(JSON.stringify(data), {
      status, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return json({ error: "invalid_body", details: parsed.error.flatten() }, 400);
    }
    const body = parsed.data;

    // Authz: requiere caller superadmin con JWT de usuario válido (no anon, no vacío).
    const authHeader = req.headers.get("Authorization") ?? "";
    const callerToken = authHeader.replace(/^Bearer\s+/i, "").trim();

    if (!callerToken || callerToken === ANON_KEY) {
      return json({ error: "unauthenticated" }, 401);
    }

    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${callerToken}` } },
    });
    const { data: u, error: userErr } = await userClient.auth.getUser();
    if (userErr || !u?.user) return json({ error: "unauthenticated" }, 401);
    const { data: isSuper } = await userClient.rpc("is_master_superadmin", { _user_id: u.user.id });
    if (!isSuper) {
      const { data: hasRole } = await userClient.rpc("has_role", { _user_id: u.user.id, _role: "superadmin" });
      if (!hasRole) return json({ error: "forbidden" }, 403);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1) Idempotencia temprana
    if (body.payment_reference) {
      const { data: existing } = await admin
        .from("licenses")
        .select("id, organization_id, license_key")
        .eq("payment_reference", body.payment_reference)
        .maybeSingle();
      if (existing) {
        return json({ idempotent: true, ...existing });
      }
    }

    // 2) Crear / recuperar usuario owner
    let ownerUserId: string | null = null;
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: body.owner_email,
      email_confirm: false,
      user_metadata: {
        full_name: body.full_name,
        phone: body.phone,
        provisioned_for: body.org_name,
      },
    });
    if (createErr && !/already.*registered|exists/i.test(createErr.message)) {
      return json({ error: "user_create_failed", message: createErr.message }, 500);
    }
    if (created?.user) {
      ownerUserId = created.user.id;
    } else {
      // ya existía → buscar por email
      const { data: list } = await admin.auth.admin.listUsers();
      const found = list?.users?.find((u) => u.email?.toLowerCase() === body.owner_email.toLowerCase());
      if (!found) return json({ error: "owner_lookup_failed" }, 500);
      ownerUserId = found.id;
    }

    // 3) Ed25519 keypair (publica solo la pública; privada se queda en el cliente desktop al activar)
    const { public_key, signing_key_id } = await generateEd25519Keypair();

    // 4) RPC atómico
    const { data: rpcResult, error: rpcErr } = await admin.rpc("provision_organization", {
      _owner_user_id: ownerUserId,
      _owner_email: body.owner_email,
      _org_name: body.org_name,
      _org_slug: body.org_slug ?? null,
      _business_type: body.business_type,
      _plan: body.plan,
      _max_terminals: body.max_terminals,
      _public_key: public_key,
      _signing_key_id: signing_key_id,
      _expires_at: body.expires_at ?? null,
      _modules: body.modules,
      _payment_reference: body.payment_reference ?? null,
      _phone: body.phone ?? null,
      _full_name: body.full_name ?? null,
      _metadata: body.metadata,
    });

    if (rpcErr) {
      return json({ error: "provision_failed", message: rpcErr.message }, 500);
    }

    // 5) Magic link de invitación para el owner
    let inviteLink: string | null = null;
    const { data: link } = await admin.auth.admin.generateLink({
      type: "magiclink",
      email: body.owner_email,
      options: { redirectTo: body.redirect_to ?? `${SUPABASE_URL.replace(/\/$/, "")}/onboarding` },
    });
    inviteLink = link?.properties?.action_link ?? null;

    return json({
      ok: true,
      ...rpcResult,
      invite_link: inviteLink,
    });
  } catch (e) {
    return json({ error: "internal", message: e instanceof Error ? e.message : String(e) }, 500);
  }
});
