/**
 * Preferencias locales por-usuario para el bloqueo PIN del POS.
 * Se persisten en localStorage; no viajan al backend (privacidad + funciona offline).
 */

export const AUTO_LOCK_OPTIONS = [
  { value: 1, label: "1 min" },
  { value: 3, label: "3 min" },
  { value: 5, label: "5 min" },
  { value: 10, label: "10 min" },
  { value: 15, label: "15 min" },
  { value: 30, label: "30 min" },
  { value: 0, label: "Nunca" },
] as const;

const AUTO_LOCK_KEY = (uid: string) => `pos:pin:autolock:${uid}`;
const REQUIRE_CHARGE_KEY = (uid: string) => `pos:pin:requireCharge:${uid}`;

export function getAutoLockMinutes(userId: string): number {
  try {
    const raw = localStorage.getItem(AUTO_LOCK_KEY(userId));
    if (raw == null) return 3;
    const n = Number(raw);
    return Number.isFinite(n) && n >= 0 ? n : 3;
  } catch { return 3; }
}
export function setAutoLockMinutes(userId: string, minutes: number) {
  try {
    localStorage.setItem(AUTO_LOCK_KEY(userId), String(minutes));
    window.dispatchEvent(new CustomEvent("pos:pin:prefs-changed"));
  } catch { /* noop */ }
}

export function getRequirePinForCharge(userId: string): boolean {
  try { return localStorage.getItem(REQUIRE_CHARGE_KEY(userId)) === "1"; }
  catch { return false; }
}
export function setRequirePinForCharge(userId: string, on: boolean) {
  try {
    localStorage.setItem(REQUIRE_CHARGE_KEY(userId), on ? "1" : "0");
    window.dispatchEvent(new CustomEvent("pos:pin:prefs-changed"));
  } catch { /* noop */ }
}

export function hasPinConfigured(userId: string): boolean {
  try { return !!localStorage.getItem(`pos:pin:${userId}`); }
  catch { return false; }
}

/**
 * Solicita verificación PIN imperativa. La monta POSPinLock vía window.__posPinRequest.
 * Devuelve `true` si el usuario desbloqueó, `false` si canceló o no hay handler.
 */
export function requirePinVerification(reason?: string): Promise<boolean> {
  const fn = (window as unknown as { __posPinRequest?: (r?: string) => Promise<boolean> }).__posPinRequest;
  if (typeof fn !== "function") return Promise.resolve(true);
  return fn(reason);
}
