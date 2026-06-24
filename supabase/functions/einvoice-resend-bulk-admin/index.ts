// einvoice-resend-bulk-admin
// POS-einvoice-bulk-retry-admin (follow-up de POS-einvoice-retry-scoping AC5).
// Bulk retry multi-org RESTRINGIDO a superadmins.
//
// Body: {
//   organization_ids: uuid[],
//   dry_run?: boolean,
//   batch_size?: number,
//   max_retries?: number,
//   // POS-optimizar-bulk-retry-timeouts AC4 — wallclock guard + cursor
//   wallclock_ms?: number,
//   cursor?: { organization_id: string, last_processed_id?: string | null }
// }
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
  // AC4: presupuesto wallclock (ms) y cursor de reanudación.
  wallclock_ms: z.number().int().min(1000).max(55_000).optional(),
  cursor: z
    .object({
      organization_id: z.string().uuid(),
      last_processed_id: z.string().nullable().optional(),
    })
    .optional(),
  // POS-einvoice-bulk-retry-hardening AC1: clave de idempotencia por request.
  idempotency_key: z.string().uuid().optional(),
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
  // AC4: si la org se cortó por wallclock, último id procesado con éxito.
  truncated?: boolean;
  last_processed_id?: string | null;
};

export type NextCursor = {
  organization_id: string;
  last_processed_id: string | null;
};

export type BulkResponse = {
  success: true;
  dry_run: boolean;
  total_orgs: number;
  total_requeued: number;
  // AC3: true si al menos un org/lote terminó en error parcial
  partial: boolean;
  results: OrgResult[];
  // AC4: si se cortó por wallclock, cursor para reanudar.
  truncated: boolean;
  next_cursor?: NextCursor;
  elapsed_ms: number;
  // POS-einvoice-bulk-retry-hardening AC1: replay idempotente.
  idempotent_replay?: boolean;
};

const IDEM_MARKER_SERVICE = "einvoice_bulk_retry_admin_idem";
const IDEM_TTL_MS = 24 * 60 * 60 * 1000;

const DEFAULT_BATCH_SIZE = 100;
const DEFAULT_WALLCLOCK_MS = 45_000;

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
// `nowFn` permite inyectar reloj determinista en tests (AC4).
export async function processBulkRetry(
  supabase: any,
  body: BulkBody,
  userId: string,
  nowFn: () => number = () => Date.now(),
): Promise<BulkResponse> {
  const { organization_ids, dry_run, batch_size, max_retries, wallclock_ms, cursor, idempotency_key } = body;
  const effectiveBatch = batch_size && batch_size > 0 ? batch_size : DEFAULT_BATCH_SIZE;
  const budgetMs = wallclock_ms && wallclock_ms > 0 ? wallclock_ms : DEFAULT_WALLCLOCK_MS;
  const startedAt = nowFn();
  const deadlineAt = startedAt + budgetMs;

  // POS-einvoice-bulk-retry-hardening AC1: short-circuit por idempotency_key.
  if (idempotency_key) {
    try {
      const sinceIdem = new Date(Date.now() - IDEM_TTL_MS).toISOString();
      const { data: cached } = await supabase
        .from("sync_logs")
        .select("payload, created_at")
        .eq("service_name", IDEM_MARKER_SERVICE)
        .gte("created_at", sinceIdem)
        .order("created_at", { ascending: false })
        .limit(50);
      const hit = (cached ?? []).find(
        (r: any) => r?.payload?.idempotency_key === idempotency_key,
      );
      if (hit?.payload?.cached_response) {
        return {
          ...(hit.payload.cached_response as BulkResponse),
          idempotent_replay: true,
          elapsed_ms: nowFn() - startedAt,
        };
      }
    } catch {
      // fail-open: si el lookup falla, seguimos con la ejecución normal.
    }
  }

  const since = new Date();
  since.setHours(0, 0, 0, 0);

  // AC4: si llega cursor, saltamos orgs anteriores en el array de entrada.
  const cursorOrgIdx = cursor
    ? organization_ids.indexOf(cursor.organization_id)
    : -1;
  const startIdx = cursorOrgIdx >= 0 ? cursorOrgIdx : 0;

  const results: OrgResult[] = [];
  let truncated = false;
  let nextCursor: NextCursor | undefined;

  outer: for (let oi = startIdx; oi < organization_ids.length; oi++) {
    const orgId = organization_ids[oi];

    // Si nos quedamos sin presupuesto antes de tocar la org, cortamos.
    if (nowFn() >= deadlineAt) {
      truncated = true;
      nextCursor = { organization_id: orgId, last_processed_id: null };
      break;
    }

    let query = supabase
      .from("electronic_invoices")
      .select("id, organization_id")
      .eq("organization_id", orgId)
      .gte("created_at", since.toISOString());

    // AC4: reanudación dentro de la org del cursor.
    if (cursor && oi === cursorOrgIdx && cursor.last_processed_id) {
      query = query.gt("id", cursor.last_processed_id);
    }
    // Orden estable para que el cursor (last id) sea reanudable.
    query = query.order("id", { ascending: true });

    const { data: pendings, error: queryErr } = await query.in(
      "status",
      ["retrying", "rejected", "error", "dead_letter", "queued", "pending"],
    );

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
    let lastProcessedId: string | null = null;
    let orgTruncated = false;

    for (let i = 0; i < batches.length; i++) {
      // AC4: chequeo wallclock antes de cada lote.
      if (nowFn() >= deadlineAt) {
        orgTruncated = true;
        truncated = true;
        nextCursor = {
          organization_id: orgId,
          last_processed_id: lastProcessedId,
        };
        break;
      }

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

      // POS-einvoice-bulk-retry-hardening AC2: usar target='einvoice_emit_retry'
      // + attempts/max_attempts/next_attempt_at para integrar con sync-outbox-flush
      // (backoff exponencial 1/5/30/120/720 min con jitter ±20%).
      const nextAt = new Date(nowFn()).toISOString();
      const effectiveMaxAttempts = typeof max_retries === "number" ? max_retries : 5;
      const outboxRows = lote.map((r) => ({
        organization_id: r.organization_id,
        target: "einvoice_emit_retry",
        payload: {
          invoice_id: r.id,
          organization_id: r.organization_id,
          forced_retry: true,
          forced_by: userId,
          bulk: true,
          admin: true,
          ...(batch_size ? { batch_size } : {}),
          ...(typeof max_retries === "number" ? { max_retries } : {}),
          ...(idempotency_key ? { idempotency_key } : {}),
        },
        status: "pending",
        attempts: 0,
        max_attempts: effectiveMaxAttempts,
        next_attempt_at: nextAt,
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
      lastProcessedId = loteIds[loteIds.length - 1];
      batchResults.push({
        index: i,
        candidates: loteIds.length,
        requeued: loteIds.length,
        status: "success",
      });
    }

    const failedBatches = batchResults.filter((b) => b.status === "error").length;
    const orgPartial = (failedBatches > 0 && orgRequeued > 0) || orgTruncated;
    const orgStatus: OrgResult["status"] =
      orgRequeued === 0 && batchResults.length > 0 ? "error" : "success";

    // sync_logs agregado por organización (AC5: un solo row resumen).
    await supabase.from("sync_logs").insert({
      organization_id: orgId,
      service_name: "einvoice_bulk_retry_admin",
      status: orgStatus,
      error_message: orgTruncated
        ? `truncated: wallclock budget exhausted after batch ${batchResults.length}/${batches.length}`
        : orgPartial
          ? `partial: ${failedBatches} batch(es) failed`
          : null,
      payload: {
        action: "bulk_admin",
        requeued_count: orgRequeued,
        requested_by: userId,
        since: since.toISOString(),
        batches: batchResults.length,
        total_batches: batches.length,
        failed_batches: failedBatches,
        batch_size: effectiveBatch,
        truncated: orgTruncated,
        last_processed_id: lastProcessedId,
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
      ...(orgTruncated
        ? { truncated: true, last_processed_id: lastProcessedId }
        : {}),
    });

    if (orgTruncated) break outer;
  }

  const anyPartial = truncated || results.some((r) => r.partial || r.status === "error");

  const response: BulkResponse = {
    success: true,
    dry_run: Boolean(dry_run),
    total_orgs: organization_ids.length,
    total_requeued: results.reduce((s, r) => s + r.requeued, 0),
    partial: anyPartial,
    results,
    truncated,
    ...(nextCursor ? { next_cursor: nextCursor } : {}),
    elapsed_ms: nowFn() - startedAt,
  };

  // POS-einvoice-bulk-retry-hardening AC1: persistir marker idempotente
  // sólo en corridas terminadas (no truncadas) para que el cursor permita reanudar.
  if (idempotency_key && !truncated) {
    try {
      await supabase.from("sync_logs").insert({
        service_name: IDEM_MARKER_SERVICE,
        status: "success",
        payload: {
          idempotency_key,
          requested_by: userId,
          cached_response: response,
        },
      });
    } catch {
      // best-effort
    }
  }

  return response;
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
