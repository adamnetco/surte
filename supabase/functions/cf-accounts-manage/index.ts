// CRUD para tenant_cloudflare_accounts con token cifrado server-side.
// Reemplaza la persistencia localStorage usada en CloudflareAccountsTab.
//
// Acciones (POST body { action, ... }):
//  - "list":         { organization_id }
//  - "create":       { organization_id, label, cf_account_id, cf_zone_id?, api_token, is_default? }
//  - "delete":       { id }
//  - "set_default":  { id }
//
// Solo admin/superadmin de la org o master-superadmin pueden ejecutar.
// El api_token se cifra con AUTH_ENCRYPTION_KEY (AES-GCM) y nunca se devuelve.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { encryptSecret } from "../_shared/auth-crypto.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function maskToken(t: string): string {
  if (!t || t.length <= 8) return "•".repeat(t?.length ?? 0);
  return `${t.slice(0, 4)}…${t.slice(-4)}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const authz = req.headers.get("Authorization") ?? "";
  if (!authz.startsWith("Bearer ")) return json({ error: "unauthorized" }, 401);

  const userClient = createClient(SUPABASE_URL, ANON, {
    global: { headers: { Authorization: authz } },
    auth: { persistSession: false },
  });
  const { data: u } = await userClient.auth.getUser();
  if (!u?.user) return json({ error: "unauthorized" }, 401);

  const svc = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

  // Authz: master superadmin o role admin/superadmin
  const { data: isMaster } = await svc.rpc("is_master_superadmin", { _user_id: u.user.id });
  if (!isMaster) {
    const { data: roles } = await svc.from("user_roles").select("role").eq("user_id", u.user.id);
    const ok = roles?.some((r) => r.role === "admin" || r.role === "superadmin");
    if (!ok) return json({ error: "forbidden" }, 403);
  }

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400); }
  const action = String(body?.action ?? "");

  try {
    if (action === "list") {
      const orgId = String(body?.organization_id ?? "");
      if (!orgId) return json({ error: "organization_id_required" }, 400);
      const { data, error } = await svc
        .from("tenant_cloudflare_accounts")
        .select("id, organization_id, label, cf_account_id, cf_zone_id, is_default, created_at, updated_at")
        .eq("organization_id", orgId)
        .order("created_at", { ascending: false });
      if (error) return json({ error: "db_error", detail: error.message }, 500);
      return json({ accounts: data ?? [] });
    }

    if (action === "create") {
      const orgId = String(body?.organization_id ?? "");
      const label = String(body?.label ?? "").trim();
      const cfAccountId = String(body?.cf_account_id ?? "").trim();
      const cfZoneId = body?.cf_zone_id ? String(body.cf_zone_id).trim() : null;
      const apiToken = String(body?.api_token ?? "");
      const isDefault = !!body?.is_default;
      if (!orgId || !label || !cfAccountId || apiToken.length < 20) {
        return json({ error: "invalid_fields" }, 400);
      }
      const encrypted = await encryptSecret(apiToken);
      // Si es default, limpiar previo
      if (isDefault) {
        await svc.from("tenant_cloudflare_accounts").update({ is_default: false }).eq("organization_id", orgId).eq("is_default", true);
      }
      const { data, error } = await svc.from("tenant_cloudflare_accounts").insert({
        organization_id: orgId,
        label,
        cf_account_id: cfAccountId,
        cf_zone_id: cfZoneId,
        api_token_encrypted: encrypted,
        is_default: isDefault,
      }).select("id, organization_id, label, cf_account_id, cf_zone_id, is_default, created_at").single();
      if (error) return json({ error: "db_error", detail: error.message }, 500);
      return json({ ok: true, account: { ...data, api_token_masked: maskToken(apiToken) } });
    }

    if (action === "delete") {
      const id = String(body?.id ?? "");
      if (!id) return json({ error: "id_required" }, 400);
      const { error } = await svc.from("tenant_cloudflare_accounts").delete().eq("id", id);
      if (error) return json({ error: "db_error", detail: error.message }, 500);
      return json({ ok: true });
    }

    if (action === "set_default") {
      const id = String(body?.id ?? "");
      if (!id) return json({ error: "id_required" }, 400);
      const { data: row, error: rowErr } = await svc.from("tenant_cloudflare_accounts")
        .select("organization_id").eq("id", id).maybeSingle();
      if (rowErr || !row) return json({ error: "not_found" }, 404);
      await svc.from("tenant_cloudflare_accounts").update({ is_default: false })
        .eq("organization_id", row.organization_id).eq("is_default", true);
      const { error } = await svc.from("tenant_cloudflare_accounts").update({ is_default: true }).eq("id", id);
      if (error) return json({ error: "db_error", detail: error.message }, 500);
      return json({ ok: true });
    }

    return json({ error: "unknown_action" }, 400);
  } catch (e) {
    console.error("cf-accounts-manage error", e);
    return json({ error: "internal", detail: String((e as Error)?.message ?? e) }, 500);
  }
});
