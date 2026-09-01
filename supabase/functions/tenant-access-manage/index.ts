// supabase/functions/tenant-access-manage/index.ts
//
// Gestión unificada de accesos de un tenant. Una sola función para evitar la
// inconsistencia que había entre "crear tienda", "invitar usuario" y "resetear
// contraseña" (cada uno hacía cosas distintas en sitios distintos).
//
// Acciones:
//   create_member  -> crea (o reutiliza) la cuenta auth y la asocia a la org
//   set_password   -> define una contraseña explícita para un miembro
//   change_role    -> cambia el rol dentro de la organización
//   deactivate/reactivate -> suspende o restaura la membresía
//
// Autorización: superadmin global, u owner/admin activo de la organización.
// El owner sólo puede ser modificado por el propio owner o por un superadmin.
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";

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

const ORG_ROLES = ["owner", "admin", "manager", "cashier", "waiter", "kitchen", "agent", "member"] as const;
type OrgRole = (typeof ORG_ROLES)[number];

// Rol global (user_roles) derivado del rol dentro de la tienda.
const GLOBAL_ROLE_BY_ORG_ROLE: Record<OrgRole, string> = {
  owner: "admin",
  admin: "admin",
  manager: "editor",
  cashier: "cashier",
  waiter: "user",
  kitchen: "user",
  agent: "agente",
  member: "user",
};

function randomPassword(len = 10) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const buf = new Uint8Array(len);
  crypto.getRandomValues(buf);
  let out = "";
  for (let i = 0; i < len; i++) out += chars[buf[i] % chars.length];
  return `${out}!${Math.floor(Math.random() * 90 + 10)}`;
}

function validatePassword(pw: string): string | null {
  if (pw.length < 8) return "La contraseña debe tener al menos 8 caracteres.";
  if (pw.length > 72) return "La contraseña no puede exceder 72 caracteres.";
  if (!/[a-zA-Z]/.test(pw) || !/[0-9]/.test(pw)) return "Debe incluir al menos una letra y un número.";
  return null;
}

const maskEmail = (email: string) => email.replace(/^(.).*(@.*)$/, "$1***$2");

async function findUserByEmail(admin: SupabaseClient, email: string) {
  // listUsers paginado: suficiente para tenants reales y evita depender de RPCs privadas.
  for (let page = 1; page <= 20; page++) {
    const { data } = await admin.auth.admin.listUsers({ page, perPage: 200 });
    const users = data?.users ?? [];
    const hit = users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (hit) return hit;
    if (users.length < 200) break;
  }
  return null;
}

async function audit(
  admin: SupabaseClient,
  orgId: string,
  callerId: string,
  callerEmail: string | null,
  action: string,
  payload: Record<string, unknown>,
) {
  try {
    const { data: org } = await admin.from("organizations").select("slug").eq("id", orgId).maybeSingle();
    await admin.from("tenant_audit_log").insert({
      organization_id: orgId,
      organization_slug: org?.slug ?? null,
      actor_id: callerId,
      actor_email: callerEmail,
      action,
      payload,
    });
  } catch (_) {
    /* best-effort */
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const action = String(body.action ?? "");
  const organizationId = typeof body.organization_id === "string" ? body.organization_id.trim() : "";
  if (!organizationId) return json({ error: "organization_id_required" }, 400);

  // 1. Identidad del llamante validada contra el servidor de auth.
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  const caller = userData?.user;
  if (userErr || !caller) return json({ error: "invalid_token" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

  // 2. Autorización.
  const { data: superRow } = await admin
    .from("user_roles")
    .select("role")
    .eq("user_id", caller.id)
    .eq("role", "superadmin")
    .maybeSingle();
  const isSuperadmin = !!superRow;

  let callerOrgRole: string | null = null;
  if (!isSuperadmin) {
    const { data: mem } = await admin
      .from("organization_members")
      .select("role")
      .eq("organization_id", organizationId)
      .eq("user_id", caller.id)
      .eq("is_active", true)
      .maybeSingle();
    callerOrgRole = mem?.role ?? null;
    if (!callerOrgRole || !["owner", "admin"].includes(callerOrgRole)) {
      return json({ error: "forbidden" }, 403);
    }
  }

  const canTouchOwner = isSuperadmin || callerOrgRole === "owner";

  try {
    // ------------------------------------------------------------------ list
    if (action === "list_members") {
      const { data: memberships, error: listErr } = await admin.from("organization_members")
        .select("id,user_id,role,is_active,created_at,location_ids")
        .eq("organization_id", organizationId).order("created_at");
      if (listErr) return json({ error: listErr.message, code: "list_failed" }, 502);
      const members = await Promise.all((memberships ?? []).map(async (membership) => {
        const [{ data: authData }, { data: profile }] = await Promise.all([
          admin.auth.admin.getUserById(membership.user_id),
          admin.from("profiles").select("full_name,business_name").eq("user_id", membership.user_id).maybeSingle(),
        ]);
        return { ...membership, email: authData.user?.email ?? null, profile: profile ?? null };
      }));
      return json({ ok: true, members });
    }

    // ---------------------------------------------------------------- create
    if (action === "create_member") {
      const email = String(body.email ?? "").trim().toLowerCase();
      const fullName = String(body.full_name ?? "").trim();
      const role = String(body.role ?? "cashier") as OrgRole;
      const rawPassword = typeof body.password === "string" ? body.password : "";

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "invalid_email" }, 400);
      if (!ORG_ROLES.includes(role)) return json({ error: "invalid_role" }, 400);
      if (role === "owner" && !canTouchOwner) return json({ error: "forbidden_owner_target" }, 403);

      let password = rawPassword;
      let generated = false;
      if (!password) {
        password = randomPassword();
        generated = true;
      } else {
        const problem = validatePassword(password);
        if (problem) return json({ error: problem, code: "weak_password" }, 400);
      }

      const existing = await findUserByEmail(admin, email);
      let userId: string;
      let reused = false;
      let passwordApplied = false;

      if (existing) {
        userId = existing.id;
        reused = true;
        // Sólo sobreescribimos la contraseña si el llamante la envió explícitamente.
        if (!generated) {
          const { error: pwErr } = await admin.auth.admin.updateUserById(userId, { password });
          if (pwErr) return json({ error: pwErr.message, code: "set_password_failed" }, 502);
          passwordApplied = true;
        }
      } else {
        const { data: created, error: createErr } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
          user_metadata: { full_name: fullName || email.split("@")[0] },
        });
        if (createErr || !created.user) {
          return json({ error: createErr?.message ?? "create_user_failed", code: "create_user_failed" }, 502);
        }
        userId = created.user.id;
        passwordApplied = true;
      }

      const { error: memErr } = await admin.from("organization_members").upsert(
        {
          organization_id: organizationId,
          user_id: userId,
          role,
          is_active: true,
          invited_by: caller.id,
        },
        { onConflict: "organization_id,user_id" },
      );
      if (memErr) return json({ error: memErr.message, code: "membership_failed" }, 502);

      // El rol global es una compatibilidad interna y nunca se acepta desde el cliente.
      await admin.from("user_roles").delete().eq("user_id", userId).neq("role", "superadmin");
      await admin.from("user_roles").upsert({ user_id: userId, role: GLOBAL_ROLE_BY_ORG_ROLE[role] }, { onConflict: "user_id,role" });

      if (fullName) {
        await admin
          .from("profiles")
          .upsert({ user_id: userId, full_name: fullName }, { onConflict: "user_id" });
      }

      await audit(admin, organizationId, caller.id, caller.email ?? null, "tenant_member_created", {
        target_user_id: userId,
        target_email_masked: maskEmail(email),
        role,
        reused_existing_account: reused,
        password_set: passwordApplied,
        by_superadmin: isSuperadmin,
      });

      return json({
        ok: true,
        user_id: userId,
        email,
        role,
        reused_existing_account: reused,
        // Sólo devolvemos la contraseña cuando la generamos nosotros: el admin
        // necesita comunicarla. Si la envió el llamante, ya la conoce.
        generated_password: generated && passwordApplied ? password : null,
      });
    }

    // ------------------------------------------------------------ set_password
    if (action === "set_password") {
      const targetUserId = String(body.target_user_id ?? "").trim();
      const password = String(body.password ?? "");
      if (!targetUserId) return json({ error: "target_user_id_required" }, 400);

      const problem = validatePassword(password);
      if (problem) return json({ error: problem, code: "weak_password" }, 400);

      const { data: targetMem } = await admin
        .from("organization_members")
        .select("role, is_active")
        .eq("organization_id", organizationId)
        .eq("user_id", targetUserId)
        .maybeSingle();
      if (!targetMem) return json({ error: "target_not_in_org" }, 403);
      if (targetMem.role === "owner" && !canTouchOwner) return json({ error: "forbidden_owner_target" }, 403);

      // Nunca permitir degradar la cuenta del master superadmin desde aquí.
      const { data: targetIsMaster } = await admin.rpc("is_master_superadmin", { _user_id: targetUserId });
      if (targetIsMaster && !isSuperadmin) return json({ error: "forbidden" }, 403);

      const { data: targetUser } = await admin.auth.admin.getUserById(targetUserId);
      const email = targetUser?.user?.email ?? null;

      const { error: pwErr } = await admin.auth.admin.updateUserById(targetUserId, { password });
      if (pwErr) return json({ error: pwErr.message, code: "set_password_failed" }, 502);

      await audit(admin, organizationId, caller.id, caller.email ?? null, "tenant_member_password_set", {
        target_user_id: targetUserId,
        target_email_masked: email ? maskEmail(email) : null,
        by_superadmin: isSuperadmin,
      });

      return json({ ok: true, email, masked_email: email ? maskEmail(email) : null });
    }

    // ------------------------------------------------------------ change_role
    if (action === "change_role") {
      const targetUserId = String(body.target_user_id ?? "").trim();
      const role = String(body.role ?? "") as OrgRole;
      if (!targetUserId) return json({ error: "target_user_id_required" }, 400);
      if (!ORG_ROLES.includes(role)) return json({ error: "invalid_role" }, 400);
      const { data: targetMem } = await admin.from("organization_members")
        .select("id, role").eq("organization_id", organizationId).eq("user_id", targetUserId).maybeSingle();
      if (!targetMem) return json({ error: "target_not_in_org" }, 403);
      if ((targetMem.role === "owner" || role === "owner") && !canTouchOwner) return json({ error: "forbidden_owner_target" }, 403);
      const { data: targetIsMaster } = await admin.rpc("is_master_superadmin", { _user_id: targetUserId });
      if (targetIsMaster) return json({ error: "forbidden" }, 403);
      const { error: roleErr } = await admin.from("organization_members").update({ role }).eq("id", targetMem.id);
      if (roleErr) return json({ error: roleErr.message, code: "role_change_failed" }, 502);
      await admin.from("user_roles").delete().eq("user_id", targetUserId).neq("role", "superadmin");
      await admin.from("user_roles").upsert({ user_id: targetUserId, role: GLOBAL_ROLE_BY_ORG_ROLE[role] }, { onConflict: "user_id,role" });
      await audit(admin, organizationId, caller.id, caller.email ?? null, "tenant_member_role_changed", {
        target_user_id: targetUserId, previous_role: targetMem.role, role, by_superadmin: isSuperadmin,
      });
      return json({ ok: true, role });
    }

    // ------------------------------------------------ deactivate / reactivate
    if (action === "deactivate" || action === "reactivate") {
      const targetUserId = String(body.target_user_id ?? "").trim();
      if (!targetUserId) return json({ error: "target_user_id_required" }, 400);
      if (action === "deactivate" && targetUserId === caller.id) return json({ error: "cannot_deactivate_self" }, 400);

      const { data: targetMem } = await admin
        .from("organization_members")
        .select("id, role")
        .eq("organization_id", organizationId)
        .eq("user_id", targetUserId)
        .maybeSingle();
      if (!targetMem) return json({ error: "target_not_in_org" }, 403);
      if (targetMem.role === "owner" && !canTouchOwner) return json({ error: "forbidden_owner_target" }, 403);

      const { error: upErr } = await admin
        .from("organization_members")
        .update({ is_active: action === "reactivate" })
        .eq("id", targetMem.id);
      if (upErr) return json({ error: upErr.message, code: "deactivate_failed" }, 502);

      await audit(admin, organizationId, caller.id, caller.email ?? null, action === "reactivate" ? "tenant_member_reactivated" : "tenant_member_deactivated", {
        target_user_id: targetUserId,
        role: targetMem.role,
        by_superadmin: isSuperadmin,
      });

      return json({ ok: true });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error("tenant-access-manage error", e);
    return json({ error: String((e as Error)?.message ?? e), code: "internal" }, 500);
  }
});
