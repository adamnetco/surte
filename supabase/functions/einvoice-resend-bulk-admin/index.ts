// einvoice-resend-bulk-admin
// POS-einvoice-bulk-retry-admin (follow-up de POS-einvoice-retry-scoping AC5).
// Bulk retry multi-org RESTRINGIDO a superadmins.
//
// Body: { organization_ids: uuid[], dry_run?: boolean }
// Reusa la misma lógica batch (UPDATE in + INSERT outbox) que einvoice-resend,
// pero itera por organización y aísla el blast radius con validación de visibilidad.
//
// Diferencias vs einvoice-resend retry_all_today:
//   - Solo superadmin (user_roles.role='superadmin' vía has_role).
//   - Acepta N orgs; loguea 1 row por org en sync_logs.
//   - Rate-limit suave: máx 20 orgs por request.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { z } from "https://esm.sh/zod@3.23.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BodySchema = z.object({
  organization_ids: z.array(z.string().uuid()).min(1).max(20),
  dry_run: z.boolean().optional(),
});

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) return json(401, { error: "Unauthorized" });
    const token = authHeader.replace("Bearer ", "");
    const sbUser = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userRes, error: userErr } = await sbUser.auth.getUser(token);
    if (userErr || !userRes?.user) return json(401, { error: "Unauthorized" });
    const userId = userRes.user.id;

    const raw = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(raw);
    if (!parsed.success) {
      return json(400, { error: "invalid_payload", details: parsed.error.flatten() });
    }
    const { organization_ids, dry_run } = parsed.data;

    // AC2: solo superadmin global.
    const { data: isSuper, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "superadmin",
    });
    if (roleErr) return json(500, { error: "role_check_failed", details: roleErr.message });
    if (!isSuper) return json(403, { error: "superadmin_required" });

    const since = new Date();
    since.setHours(0, 0, 0, 0);

    const results: Array<{
      organization_id: string;
      candidates: number;
      requeued: number;
      status: "success" | "error" | "skipped";
      error?: string;
    }> = [];

    for (const orgId of organization_ids) {
      const { data: pendings, error: queryErr } = await supabase
        .from("electronic_invoices")
        .select("id, organization_id")
        .eq("organization_id", orgId)
        .gte("created_at", since.toISOString())
        .in("status", ["retrying", "rejected", "error", "dead_letter", "queued", "pending"]);

      if (queryErr) {
        await supabase.from("sync_logs").insert({
          organization_id: orgId,
          service_name: "einvoice_bulk_retry_admin",
          status: "error",
          error_message: queryErr.message,
          payload: { action: "bulk_admin", requested_by: userId, phase: "query" },
        });
        results.push({
          organization_id: orgId,
          candidates: 0,
          requeued: 0,
          status: "error",
          error: queryErr.message,
        });
        continue;
      }

      const rows = pendings ?? [];
      const ids = rows.map((r: any) => r.id);

      if (dry_run || ids.length === 0) {
        results.push({
          organization_id: orgId,
          candidates: ids.length,
          requeued: 0,
          status: dry_run ? "skipped" : "success",
        });
        continue;
      }

      const { error: updErr } = await supabase
        .from("electronic_invoices")
        .update({ status: "queued", retry_count: 0, next_retry_at: null, last_error: null })
        .in("id", ids);

      if (updErr) {
        await supabase.from("sync_logs").insert({
          organization_id: orgId,
          service_name: "einvoice_bulk_retry_admin",
          status: "error",
          error_message: `update_failed: ${updErr.message}`,
          payload: { action: "bulk_admin", requested_by: userId, candidates: ids.length },
        });
        results.push({
          organization_id: orgId,
          candidates: ids.length,
          requeued: 0,
          status: "error",
          error: updErr.message,
        });
        continue;
      }

      const outboxRows = rows.map((r: any) => ({
        organization_id: r.organization_id,
        operation: "einvoice_emit",
        payload: { invoice_id: r.id, forced_retry: true, forced_by: userId, bulk: true, admin: true },
        status: "pending",
      }));
      const { error: outErr } = await supabase.from("sync_outbox").insert(outboxRows);

      if (outErr) {
        await supabase.from("sync_logs").insert({
          organization_id: orgId,
          service_name: "einvoice_bulk_retry_admin",
          status: "error",
          error_message: `outbox_insert_failed: ${outErr.message}`,
          payload: { action: "bulk_admin", requested_by: userId, candidates: ids.length },
        });
        results.push({
          organization_id: orgId,
          candidates: ids.length,
          requeued: 0,
          status: "error",
          error: outErr.message,
        });
        continue;
      }

      await supabase.from("sync_logs").insert({
        organization_id: orgId,
        service_name: "einvoice_bulk_retry_admin",
        status: "success",
        payload: {
          action: "bulk_admin",
          requeued_count: ids.length,
          requested_by: userId,
          since: since.toISOString(),
        },
      });
      results.push({
        organization_id: orgId,
        candidates: ids.length,
        requeued: ids.length,
        status: "success",
      });
    }

    return json(200, {
      success: true,
      dry_run: Boolean(dry_run),
      total_orgs: organization_ids.length,
      total_requeued: results.reduce((s, r) => s + r.requeued, 0),
      results,
    });
  } catch (e: any) {
    return json(500, { error: "internal_error", details: String(e?.message ?? e) });
  }
});
