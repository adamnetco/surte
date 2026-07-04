/**
 * Preferencias del SaleCompleteDialog.
 * - Auto-cierre configurable (default 8s) para que el cajero no quede bloqueado
 *   entre ventas. Editable por admin desde localStorage (o desde un panel
 *   admin que persista el mismo key).
 */
const KEY = "sistecpos:sale-complete-autoclose-ms";
const DEFAULT_MS = 8000;
const MIN_MS = 3000;
const MAX_MS = 60000;

export function getSaleCompleteAutoCloseMs(): number {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULT_MS;
    const n = Number(raw);
    if (!Number.isFinite(n)) return DEFAULT_MS;
    return Math.min(MAX_MS, Math.max(MIN_MS, Math.round(n)));
  } catch {
    return DEFAULT_MS;
  }
}

export function setSaleCompleteAutoCloseMs(ms: number) {
  try {
    localStorage.setItem(KEY, String(Math.min(MAX_MS, Math.max(MIN_MS, Math.round(ms)))));
  } catch {
    /* noop */
  }
}

export const SALE_COMPLETE_AUTOCLOSE_BOUNDS = { min: MIN_MS, max: MAX_MS, default: DEFAULT_MS };
