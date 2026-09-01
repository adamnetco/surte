// supabase/functions/admin-reset-password/index.ts
//
// Envía un correo de restablecimiento de contraseña a un miembro de un tenant,
// disparado por un superadmin o por un admin/owner de la misma organización.
//
// Nunca devuelve ni expone la contraseña: sólo dispara el flujo de recuperación
// estándar (correo con enlace de un solo uso hacia /reset-password).
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  let body: { target_user_id?: string; organization_id?: string; redirect_to?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const targetUserId = body.target_user_id?.trim();
  const organizationId = body.organization_id?.trim();
  if (!targetUserId) return json({ error: "target_user_id_required" }, 400);

  // 1. Validar caller
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  const caller = userData?.user;
  if (userErr || !caller) return json({ error: "invalid_token" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // 2. Autorización: superadmin global, o admin/owner activo de la org destino
  const { data: superRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", caller.id)
    .eq("role", "superadmin")
    .maybeSingle();
  const isSuperadmin = !!superRow;

  let orgId = organizationId ?? null;

  if (!isSuperadmin) {
    if (!orgId) return json({ error: "organization_id_required" }, 400);

    const { data: callerMem } = await admin
      .from("organization_members")
      .select("role")
      .eq("organization_id", orgId)
      .eq("user_id", caller.id)
      .eq("is_active", true)
      .maybeSingle();
    if (!callerMem || !["owner", "admin"].includes(callerMem.role)) {
      return json({ error: "forbidden" }, 403);
    }

    // El destino debe pertenecer a la misma organización
    const { data: targetMem } = await admin
      .from("organization_members")
      .select("id, role")
      .eq("organization_id", orgId)
      .eq("user_id", targetUserId)
      .maybeSingle();
    if (!targetMem) return json({ error: "target_not_in_org" }, 403);
    // Un admin no puede restablecer la contraseña del owner
    if (targetMem.role === "owner" && callerMem.role !== "owner") {
      return json({ error: "forbidden_owner_target" }, 403);
    }
  }

  // 3. Email del usuario destino
  const { data: targetUser, error: targetErr } = await admin.auth.admin.getUserById(targetUserId);
  const email = targetUser?.user?.email;
  if (targetErr || !email) return json({ error: "target_email_not_found" }, 404);
  if (email.endsWith("@app.local")) {
    return json({ error: "synthetic_email_no_reset" }, 422);
  }

  // 4. Disparar el correo de recuperación (pipeline de auth estándar)
  const origin = req.headers.get("origin") ?? "";
  const redirectTo =
    body.redirect_to && body.redirect_to.startsWith("http")
      ? body.redirect_to
      : origin
        ? `${origin}/reset-password`
        : undefined;

  const publicClient = createClient(SUPABASE_URL, ANON_KEY, { auth: { persistSession: false } });
  const { error: resetErr } = await publicClient.auth.resetPasswordForEmail(
    email,
    redirectTo ? { redirectTo } : undefined,
  );
  if (resetErr) {
    return json({ error: resetErr.message, code: "reset_send_failed" }, 502);
  }

  // 5. Auditoría (best-effort)
  try {
    let slug: string | null = null;
    if (orgId) {
      const { data: org } = await admin.from("organizations").select("slug").eq("id", orgId).maybeSingle();
      slug = org?.slug ?? null;
    }
    await admin.from("tenant_audit_log").insert({
      organization_id: orgId,
      organization_slug: slug,
      actor_id: caller.id,
      actor_email: caller.email ?? null,
      action: "password_reset_requested",
      payload: {
        target_user_id: targetUserId,
        target_email_masked: email.replace(/^(.).*(@.*)$/, "$1***$2"),
        by_superadmin: isSuperadmin,
      },
    });
  } catch (_) { /* best-effort */ }

  return json({
    ok: true,
    masked_email: email.replace(/^(.).*(@.*)$/, "$1***$2"),
  });
});
