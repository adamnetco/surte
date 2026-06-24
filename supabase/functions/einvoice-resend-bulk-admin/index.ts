// einvoice-resend-bulk-admin
// POS-einvoice-bulk-retry-admin (follow-up de POS-einvoice-retry-scoping AC5).
// Bulk retry multi-org RESTRINGIDO a superadmins.
//
// Body: { organization_ids: uuid[], dry_run?: boolean, batch_size?: number, max_retries?: number }
// Reusa la misma lógica batch (UPDATE in + INSERT outbox) que einvoice-resend,
// pero itera por organización y aísla el blast radius con validación de visibilidad.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { z } from "https://esm.sh/zod@3.23.8";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export const BodySchema = z.object({
  organization_ids: z.array(z.string().uuid()).min(1).max(20),
  dry_run: z.boolean().optional(),
  // AC6 (UI superadmin): el front envía estos parámetros para que el worker
  // los respete cuando se implemente POS-optimizar-bulk-retry-timeouts.
  // Se persisten en el payload del outbox; no afectan el flujo actual.
  batch_size: z.number().int().min(1).max(500).optional(),
  max_retries: z.number().int().min(0).max(10).optional(),
});

export type BulkBody = z.infer<typeof BodySchema>;

export type BatchResult = {
  index: number;
  candidates: number;
  requeued: number;
  status: "success" | "error";
  error?: string;
};

export type OrgResult = {
  organization_id: string;
  candidates: number;
  requeued: number;
  status: "success" | "error" | "skipped";
  error?: string;
  // POS-optimizar-bulk-retry-timeouts AC2/AC3 — per-batch breakdown
  batches?: BatchResult[];
  partial?: boolean;
};

export type BulkResponse = {
  success: true;
  dry_run: boolean;
  total_orgs: number;
  total_requeued: number;
  // AC3: true si al menos un org/lote terminó en error parcial
  partial: boolean;
  results: OrgResult[];
};

const DEFAULT_BATCH_SIZE = 100;

function chunk<T>(arr: T[], size: number): T[][] {
  if (size <= 0) return [arr];
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Lógica pura testeable. `supabase` puede ser un fake con la misma forma.
export async function processBulkRetry(
  supabase: any,
  body: BulkBody,
  userId: string,
): Promise<BulkResponse> {
  const { organization_ids, dry_run, batch_size, max_retries } = body;
  const effectiveBatch = batch_size && batch_size > 0 ? batch_size : DEFAULT_BATCH_SIZE;

  const since = new Date();
  since.setHours(0, 0, 0, 0);

  const results: OrgResult[] = [];

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

    const rows = (pendings ?? []) as Array<{ id: string; organization_id: string }>;
    const ids = rows.map((r) => r.id);

    if (dry_run || ids.length === 0) {
      results.push({
        organization_id: orgId,
        candidates: ids.length,
        requeued: 0,
        status: dry_run ? "skipped" : "success",
      });
      continue;
    }

    // POS-optimizar-bulk-retry-timeouts AC1/AC2: procesar por lotes.
    const batches = chunk(rows, effectiveBatch);
    const batchResults: BatchResult[] = [];
    let orgRequeued = 0;

    for (let i = 0; i < batches.length; i++) {
      const lote = batches[i];
      const loteIds = lote.map((r) => r.id);

      const { error: updErr } = await supabase
        .from("electronic_invoices")
        .update({ status: "queued", retry_count: 0, next_retry_at: null, last_error: null })
        .in("id", loteIds);

      if (updErr) {
        await supabase.from("sync_logs").insert({
          organization_id: orgId,
          service_name: "einvoice_bulk_retry_admin",
          status: "error",
          error_message: `update_failed: ${updErr.message}`,
          payload: {
            action: "bulk_admin",
            requested_by: userId,
            phase: `batch_${i}`,
            candidates: loteIds.length,
          },
        });
        batchResults.push({
          index: i,
          candidates: loteIds.length,
          requeued: 0,
          status: "error",
          error: updErr.message,
        });
        continue;
      }

      const outboxRows = lote.map((r) => ({
        organization_id: r.organization_id,
        operation: "einvoice_emit",
        payload: {
          invoice_id: r.id,
          forced_retry: true,
          forced_by: userId,
          bulk: true,
          admin: true,
          ...(batch_size ? { batch_size } : {}),
          ...(typeof max_retries === "number" ? { max_retries } : {}),
        },
        status: "pending",
      }));
      const { error: outErr } = await supabase.from("sync_outbox").insert(outboxRows);

      if (outErr) {
        await supabase.from("sync_logs").insert({
          organization_id: orgId,
          service_name: "einvoice_bulk_retry_admin",
          status: "error",
          error_message: `outbox_insert_failed: ${outErr.message}`,
          payload: {
            action: "bulk_admin",
            requested_by: userId,
            phase: `batch_${i}`,
            candidates: loteIds.length,
          },
        });
        batchResults.push({
          index: i,
          candidates: loteIds.length,
          requeued: 0,
          status: "error",
          error: outErr.message,
        });
        continue;
      }

      orgRequeued += loteIds.length;
      batchResults.push({
        index: i,
        candidates: loteIds.length,
        requeued: loteIds.length,
        status: "success",
      });
    }

    const failedBatches = batchResults.filter((b) => b.status === "error").length;
    const orgPartial = failedBatches > 0 && orgRequeued > 0;
    const orgStatus: OrgResult["status"] =
      orgRequeued === 0 ? "error" : "success"; // partial se expresa con `partial:true`

    // sync_logs agregado por organización (AC5: un solo row resumen).
    await supabase.from("sync_logs").insert({
      organization_id: orgId,
      service_name: "einvoice_bulk_retry_admin",
      status: orgStatus,
      error_message: orgPartial ? `partial: ${failedBatches} batch(es) failed` : null,
      payload: {
        action: "bulk_admin",
        requeued_count: orgRequeued,
        requested_by: userId,
        since: since.toISOString(),
        batches: batchResults.length,
        failed_batches: failedBatches,
        batch_size: effectiveBatch,
        ...(typeof max_retries === "number" ? { max_retries } : {}),
      },
    });

    results.push({
      organization_id: orgId,
      candidates: ids.length,
      requeued: orgRequeued,
      status: orgStatus,
      error: orgStatus === "error" ? batchResults.find((b) => b.error)?.error : undefined,
      batches: batchResults,
      partial: orgPartial,
    });
  }

  const anyPartial = results.some((r) => r.partial || r.status === "error");

  return {
    success: true,
    dry_run: Boolean(dry_run),
    total_orgs: organization_ids.length,
    total_requeued: results.reduce((s, r) => s + r.requeued, 0),
    partial: anyPartial,
    results,
  };
}

export const handler = async (req: Request): Promise<Response> => {
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

    // AC2: solo superadmin global.
    const { data: isSuper, error: roleErr } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "superadmin",
    });
    if (roleErr) return json(500, { error: "role_check_failed", details: roleErr.message });
    if (!isSuper) return json(403, { error: "superadmin_required" });

    const result = await processBulkRetry(supabase, parsed.data, userId);
    return json(200, result);
  } catch (e: any) {
    return json(500, { error: "internal_error", details: String(e?.message ?? e) });
  }
};

Deno.serve(handler);
