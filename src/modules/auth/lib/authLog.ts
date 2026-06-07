/**
 * Lightweight auth event log persisted in sessionStorage.
 * Used by LoginRouter (magic link, password sign-in) and the
 * /auth-status diagnostic page to explain why a sign-in failed.
 *
 * Intentionally NOT persisted to localStorage to avoid leaking
 * emails / tenant slugs across browser sessions.
 */

export type AuthLogLevel = "info" | "warn" | "error" | "success";

export interface AuthLogEntry {
  ts: number;
  level: AuthLogLevel;
  event: string;
  detail?: string;
  tenant?: string | null;
  email?: string | null;
}

const KEY = "sps_auth_log";
const MAX_ENTRIES = 80;

function safeRead(): AuthLogEntry[] {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function logAuth(entry: Omit<AuthLogEntry, "ts">) {
  const next: AuthLogEntry = { ts: Date.now(), ...entry };
  const all = [next, ...safeRead()].slice(0, MAX_ENTRIES);
  try { sessionStorage.setItem(KEY, JSON.stringify(all)); } catch { /* noop */ }
  // Also echo to console so devs can grep in real time.
  const prefix = `[auth:${entry.level}] ${entry.event}`;
  // eslint-disable-next-line no-console
  (entry.level === "error" ? console.error : entry.level === "warn" ? console.warn : console.log)(
    prefix,
    { detail: entry.detail, tenant: entry.tenant, email: entry.email },
  );
}

export function readAuthLog(): AuthLogEntry[] {
  return safeRead();
}

export function clearAuthLog() {
  try { sessionStorage.removeItem(KEY); } catch { /* noop */ }
}

// ---------- Magic-link rate limiting ----------

const RL_KEY = "sps_magiclink_attempts";
export const MAGIC_LINK_MAX_ATTEMPTS = 5;
export const MAGIC_LINK_COOLDOWN_MS = 30_000;
export const MAGIC_LINK_WINDOW_MS = 15 * 60_000; // 15 min rolling window

interface RateState {
  attempts: number[]; // timestamps
  lastSentAt: number | null;
}

function readRate(): RateState {
  try {
    const raw = sessionStorage.getItem(RL_KEY);
    if (!raw) return { attempts: [], lastSentAt: null };
    const parsed = JSON.parse(raw);
    return {
      attempts: Array.isArray(parsed?.attempts) ? parsed.attempts : [],
      lastSentAt: typeof parsed?.lastSentAt === "number" ? parsed.lastSentAt : null,
    };
  } catch {
    return { attempts: [], lastSentAt: null };
  }
}

function writeRate(s: RateState) {
  try { sessionStorage.setItem(RL_KEY, JSON.stringify(s)); } catch { /* noop */ }
}

export interface MagicLinkGate {
  allowed: boolean;
  reason?: "cooldown" | "max_attempts";
  remainingMs?: number;
  attemptsUsed: number;
  attemptsMax: number;
}

export function checkMagicLinkGate(): MagicLinkGate {
  const now = Date.now();
  const state = readRate();
  const recent = state.attempts.filter((t) => now - t < MAGIC_LINK_WINDOW_MS);
  if (state.lastSentAt && now - state.lastSentAt < MAGIC_LINK_COOLDOWN_MS) {
    return {
      allowed: false,
      reason: "cooldown",
      remainingMs: MAGIC_LINK_COOLDOWN_MS - (now - state.lastSentAt),
      attemptsUsed: recent.length,
      attemptsMax: MAGIC_LINK_MAX_ATTEMPTS,
    };
  }
  if (recent.length >= MAGIC_LINK_MAX_ATTEMPTS) {
    const oldest = Math.min(...recent);
    return {
      allowed: false,
      reason: "max_attempts",
      remainingMs: MAGIC_LINK_WINDOW_MS - (now - oldest),
      attemptsUsed: recent.length,
      attemptsMax: MAGIC_LINK_MAX_ATTEMPTS,
    };
  }
  return { allowed: true, attemptsUsed: recent.length, attemptsMax: MAGIC_LINK_MAX_ATTEMPTS };
}

export function recordMagicLinkAttempt() {
  const now = Date.now();
  const state = readRate();
  const recent = state.attempts.filter((t) => now - t < MAGIC_LINK_WINDOW_MS);
  recent.push(now);
  writeRate({ attempts: recent, lastSentAt: now });
}

export function resetMagicLinkAttempts() {
  writeRate({ attempts: [], lastSentAt: null });
}
