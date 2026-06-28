/**
 * Captura del parámetro ?ref=CODE en cualquier landing/login/signup.
 * Lo persiste 30 días en localStorage para asociarlo al tenant cuando termine onboarding.
 */
const KEY = "sistecpos.referral_ref";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

interface Stored { code: string; ts: number; }

export function captureReferralFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const url = new URL(window.location.href);
    const code = (url.searchParams.get("ref") || "").trim().toUpperCase();
    if (!code) return getStoredReferral();
    if (!/^REF-[A-Z0-9]{4,12}$/.test(code)) return getStoredReferral();
    const payload: Stored = { code, ts: Date.now() };
    window.localStorage.setItem(KEY, JSON.stringify(payload));
    return code;
  } catch {
    return null;
  }
}

export function getStoredReferral(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Stored;
    if (!parsed?.code || Date.now() - parsed.ts > TTL_MS) {
      window.localStorage.removeItem(KEY);
      return null;
    }
    return parsed.code;
  } catch {
    return null;
  }
}

export function clearStoredReferral() {
  if (typeof window === "undefined") return;
  try { window.localStorage.removeItem(KEY); } catch { /* noop */ }
}
