// POS-einvoice-bulk-retry-hardening — helper puro extraído de index.ts para
// permitir pruebas unitarias del scheduler de reintentos sin tocar Postgres.
// Mantiene paridad con la ventana 1/5/30/120/720 min + jitter ±20%.
export const BACKOFF_MIN = [1, 5, 30, 120, 720];

export type OutboxRowLike = {
  attempts: number;
  max_attempts: number;
};

export type RetryDecision =
  | { kind: "succeeded"; attempts: number }
  | { kind: "dead"; attempts: number; reason: string }
  | { kind: "retry"; attempts: number; next_attempt_at: string; delay_min: number };

export function scheduleNextAttempt(
  row: OutboxRowLike,
  result: { ok: boolean; error?: string; permanent?: boolean },
  opts: { now?: () => number; rand?: () => number } = {},
): RetryDecision {
  const now = opts.now ?? Date.now;
  const rand = opts.rand ?? Math.random;
  const nextAttempts = (row.attempts ?? 0) + 1;

  if (result.ok) return { kind: "succeeded", attempts: nextAttempts };

  if (nextAttempts >= (row.max_attempts ?? 5) || result.permanent) {
    return { kind: "dead", attempts: nextAttempts, reason: result.error ?? "unknown" };
  }

  const delayMin = BACKOFF_MIN[Math.min(nextAttempts - 1, BACKOFF_MIN.length - 1)];
  const jitter = 1 + (rand() * 0.4 - 0.2);
  const next = new Date(now() + delayMin * 60_000 * jitter).toISOString();
  return { kind: "retry", attempts: nextAttempts, next_attempt_at: next, delay_min: delayMin };
}
