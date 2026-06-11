/**
 * reseed-demo — Fase 2.5 del plan de refactor SistecPOS.
 *
 * Vincula al usuario `demo@sistecpos.com` con la organización demo
 * (`59a4032f-3eeb-4312-a84a-f6d042f019ec`) como admin:
 *  - Crea el usuario en Auth si no existe (password aleatoria → magic link).
 *  - Upsert en `organization_members` con role='admin'.
 *  - Upsert en `user_roles` con role='admin'.
 *
 * Solo invocable por un superadmin autenticado.
 */
import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const DEMO_ORG_ID = "59a4032f-3eeb-4312-a84a-f6d042f019ec";
const DEMO_EMAIL = "demo@sistecpos.com";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  // ---- Auth: requerir superadmin ----
  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ error: "missing_token" }, 401);
  }
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userRes, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userRes.user) return json({ error: "invalid_token" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY);
  // Etapa 30: solo superadmin (antes aceptaba admin global → cualquier admin de tenant podía reseed).
  const { data: isMaster } = await admin.rpc("is_master_superadmin", { _user_id: userRes.user.id });
  let allowed = !!isMaster;
  if (!allowed) {
    const { data: superRow } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userRes.user.id)
      .eq("role", "superadmin")
      .maybeSingle();
    allowed = !!superRow;
  }
  if (!allowed) return json({ error: "forbidden" }, 403);

  // ---- 1. Asegurar usuario demo en Auth ----
  let demoUserId: string | null = null;
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = list?.users.find((u) => u.email?.toLowerCase() === DEMO_EMAIL);
  if (existing) {
    demoUserId = existing.id;
  } else {
    const tempPassword = crypto.randomUUID() + "Aa1!";
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: DEMO_EMAIL,
      password: tempPassword,
      email_confirm: true,
      user_metadata: { full_name: "Demo SistecPOS", source: "reseed-demo" },
    });
    if (createErr || !created.user) {
      return json({ error: "create_user_failed", detail: createErr?.message }, 500);
    }
    demoUserId = created.user.id;
  }

  // ---- 2. Vincular a la organización demo ----
  const { error: memberErr } = await admin
    .from("organization_members")
    .upsert(
      { organization_id: DEMO_ORG_ID, user_id: demoUserId, role: "admin" },
      { onConflict: "organization_id,user_id" },
    );
  if (memberErr) return json({ error: "member_upsert_failed", detail: memberErr.message }, 500);

  // ---- 3. Otorgar rol admin global (idempotente) ----
  const { error: roleErr } = await admin
    .from("user_roles")
    .upsert({ user_id: demoUserId, role: "admin" }, { onConflict: "user_id,role" });
  if (roleErr) return json({ error: "role_upsert_failed", detail: roleErr.message }, 500);

  return json({
    ok: true,
    user_id: demoUserId,
    organization_id: DEMO_ORG_ID,
    created: !existing,
  });
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
