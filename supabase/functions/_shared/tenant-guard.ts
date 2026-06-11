// Tenant guard helpers compartidos (Etapa 22).
// Centraliza autenticación, role-check y membership-check para edge functions.
import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function serviceClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );
}

export function userClient(authHeader: string): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!,
    { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } },
  );
}

export type AuthResult =
  | { ok: true; userId: string; isServiceRole: boolean; authHeader: string }
  | { ok: false; response: Response };

/** Exige Bearer JWT válido. Detecta también service_role tokens. */
export async function requireAuth(req: Request): Promise<AuthResult> {
  const authHeader = req.headers.get("Authorization") || req.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) {
    return { ok: false, response: jsonResponse({ error: "unauthorized" }, 401) };
  }
  const token = authHeader.slice(7);
  // service_role rápido: payload role=service_role
  try {
    const payload = JSON.parse(atob(token.split(".")[1] ?? ""));
    if (payload?.role === "service_role") {
      return { ok: true, userId: payload.sub ?? "service", isServiceRole: true, authHeader };
    }
  } catch {/* no-op */}
  const sb = userClient(authHeader);
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) {
    return { ok: false, response: jsonResponse({ error: "unauthorized" }, 401) };
  }
  return { ok: true, userId: data.user.id, isServiceRole: false, authHeader };
}

/** Verifica que el caller sea miembro activo de la org (o service_role/superadmin). */
export async function requireMembership(
  svc: SupabaseClient,
  userId: string,
  orgId: string,
  isServiceRole = false,
): Promise<true | Response> {
  if (isServiceRole) return true;
  if (!orgId) return jsonResponse({ error: "organization_id_required" }, 400);
  // master superadmin bypass
  const { data: isMaster } = await svc.rpc("is_master_superadmin", { _user_id: userId });
  if (isMaster === true) return true;
  const { data: roles } = await svc
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (roles?.some((r: any) => r.role === "superadmin")) return true;

  const { data: mem } = await svc
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("organization_id", orgId)
    .eq("is_active", true)
    .maybeSingle();
  if (!mem) return jsonResponse({ error: "forbidden_not_member" }, 403);
  return true;
}

/** Exige rol global admin/superadmin (sin alcance org). */
export async function requireAdminRole(
  svc: SupabaseClient,
  userId: string,
  isServiceRole = false,
): Promise<true | Response> {
  if (isServiceRole) return true;
  const { data: isMaster } = await svc.rpc("is_master_superadmin", { _user_id: userId });
  if (isMaster === true) return true;
  const { data: roles } = await svc.from("user_roles").select("role").eq("user_id", userId);
  const ok = roles?.some((r: any) => r.role === "admin" || r.role === "superadmin");
  if (!ok) return jsonResponse({ error: "forbidden" }, 403);
  return true;
}

/**
 * Resuelve organization_id del caller. Prioridad:
 * 1) explicit body.organization_id (validado contra membership salvo service_role/superadmin)
 * 2) primera org activa donde el user es miembro
 * Devuelve null si no se puede resolver.
 */
export async function resolveCallerOrgId(
  svc: SupabaseClient,
  userId: string,
  isServiceRole: boolean,
  explicitOrgId?: string | null,
): Promise<string | null> {
  if (explicitOrgId) {
    if (isServiceRole) return explicitOrgId;
    const mem = await requireMembership(svc, userId, explicitOrgId, false);
    return mem === true ? explicitOrgId : null;
  }
  if (isServiceRole) return null;
  const { data } = await svc
    .from("organization_members")
    .select("organization_id")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  return (data as any)?.organization_id ?? null;
}

/**
 * Lee claves de app_settings con scope org. Si la org no tiene la clave,
 * cae a la global (organization_id IS NULL) para back-compat.
 */
export async function getOrgScopedSettings(
  svc: SupabaseClient,
  orgId: string | null,
  keys: string[],
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (orgId) {
    const { data: scoped } = await svc
      .from("app_settings")
      .select("key, value")
      .eq("organization_id", orgId)
      .in("key", keys);
    scoped?.forEach((r: any) => { out[r.key] = r.value; });
  }
  const missing = keys.filter((k) => !(k in out));
  if (missing.length) {
    const { data: global } = await svc
      .from("app_settings")
      .select("key, value")
      .is("organization_id", null)
      .in("key", missing);
    global?.forEach((r: any) => { out[r.key] = r.value; });
  }
  return out;
}

