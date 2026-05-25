// Shared retry + sync_logs helper for edge functions.
// Idempotent log lifecycle: start() → success()/error().
// Exponential backoff: 1s, 5s, 30s by default (3 attempts).

import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

export type SyncStatus = "pending" | "success" | "error" | "partial";

export function adminClient(): SupabaseClient {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export interface SyncLogHandle {
  id: string;
  startedAt: number;
  attempts: number;
}

export async function startSyncLog(
  sb: SupabaseClient,
  service: string,
  orgId: string | null,
  payload: Record<string, unknown> = {},
): Promise<SyncLogHandle> {
  const startedAt = Date.now();
  const { data, error } = await sb.rpc("log_sync_event", {
    _log_id: null,
    _organization_id: orgId,
    _service_name: service,
    _status: "pending" as SyncStatus,
    _error_message: null,
    _payload: payload,
    _attempts: 0,
    _duration_ms: null,
  });
  if (error) console.error("startSyncLog failed", error);
  return { id: data as string, startedAt, attempts: 0 };
}

export async function finishSyncLog(
  sb: SupabaseClient,
  handle: SyncLogHandle,
  status: SyncStatus,
  opts: { error?: string | null; payload?: Record<string, unknown> } = {},
) {
  const duration = Date.now() - handle.startedAt;
  const { error } = await sb.rpc("log_sync_event", {
    _log_id: handle.id,
    _organization_id: null,
    _service_name: "",
    _status: status,
    _error_message: opts.error ?? null,
    _payload: opts.payload ?? null,
    _attempts: handle.attempts,
    _duration_ms: duration,
  });
  if (error) console.error("finishSyncLog failed", error);
}

const DEFAULT_DELAYS_MS = [1_000, 5_000, 30_000];

/**
 * Run `fn` with exponential backoff. Returns the resolved value, or throws the last error.
 * `shouldRetry` allows opting out for non-transient errors (e.g. HTTP 4xx).
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  opts: {
    delaysMs?: number[];
    shouldRetry?: (err: unknown, attempt: number) => boolean;
    onRetry?: (err: unknown, attempt: number, nextDelay: number) => void;
  } = {},
): Promise<{ value: T; attempts: number }> {
  const delays = opts.delaysMs ?? DEFAULT_DELAYS_MS;
  let lastErr: unknown;
  for (let attempt = 1; attempt <= delays.length + 1; attempt++) {
    try {
      const value = await fn(attempt);
      return { value, attempts: attempt };
    } catch (err) {
      lastErr = err;
      const isLast = attempt > delays.length;
      const allowed = opts.shouldRetry ? opts.shouldRetry(err, attempt) : true;
      if (isLast || !allowed) break;
      const delay = delays[attempt - 1];
      opts.onRetry?.(err, attempt, delay);
      await new Promise((r) => setTimeout(r, delay));
    }
  }
  throw lastErr;
}

/** Retry only on transient errors: network, 5xx, 429. */
export function isTransientHttpError(err: unknown): boolean {
  if (err instanceof TypeError) return true; // fetch network errors
  const status = (err as any)?.status;
  if (typeof status === "number") return status >= 500 || status === 429;
  return true;
}
