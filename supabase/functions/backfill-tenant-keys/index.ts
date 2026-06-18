// POS-tenant-keypair-parity — backfill keypair for tenants that miss one.
// Superadmin-only. Iterates organizations where signing_public_key IS NULL
// and calls ensureTenantKeypair for each. Returns a summary.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";
import { ensureTenantKeypair } from "../_shared/tenant-keys.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: isSuper } = await admin.rpc("is_master_superadmin", { _user_id: userData.user.id });
    let allowed = !!isSuper;
    if (!allowed) {
      const { data: roleRow } = await admin
        .from("user_roles").select("role")
        .eq("user_id", userData.user.id).eq("role", "superadmin").maybeSingle();
      allowed = !!roleRow;
    }
    if (!allowed) {
      return new Response(JSON.stringify({ error: "forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const dry_run = !!body.dry_run;
    const only_org_id = body.organization_id ? String(body.organization_id) : null;

    let q = admin.from("organizations")
      .select("id, slug, name")
      .is("signing_public_key", null);
    if (only_org_id) q = q.eq("id", only_org_id);
    const { data: pending, error: listErr } = await q;
    if (listErr) {
      return new Response(JSON.stringify({ error: "list_failed", detail: listErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: Array<{ id: string; slug: string; status: "ok" | "skipped" | "error"; detail?: string }> = [];
    if (dry_run) {
      for (const o of pending ?? []) results.push({ id: o.id, slug: o.slug, status: "skipped", detail: "dry_run" });
    } else {
      for (const o of pending ?? []) {
        try {
          const r = await ensureTenantKeypair(admin, o.id);
          if (r.error) results.push({ id: o.id, slug: o.slug, status: "error", detail: r.error });
          else results.push({ id: o.id, slug: o.slug, status: r.created ? "ok" : "skipped" });
        } catch (e) {
          results.push({ id: o.id, slug: o.slug, status: "error", detail: String((e as Error)?.message ?? e) });
        }
      }
    }

    const summary = {
      total_pending: pending?.length ?? 0,
      created: results.filter((r) => r.status === "ok").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      errors: results.filter((r) => r.status === "error").length,
    };

    return new Response(JSON.stringify({ ok: true, dry_run, summary, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("backfill-tenant-keys error", e);
    return new Response(JSON.stringify({ error: "internal", detail: String((e as Error)?.message ?? e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
