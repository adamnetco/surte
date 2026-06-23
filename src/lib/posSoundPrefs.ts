/**
 * Preferencias de sonido del POS (Daily Driver UX AC13).
 * Persiste en localStorage. Sin dependencias de DB.
 */
const KEY = "sistecpos:sound-enabled";

export function getPosSoundEnabled(): boolean {
  try {
    return localStorage.getItem(KEY) !== "false"; // default ON
  } catch {
    return true;
  }
}

export function setPosSoundEnabled(enabled: boolean) {
  try {
    localStorage.setItem(KEY, String(enabled));
  } catch {
    /* noop */
  }
}

let cachedCtx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (cachedCtx) return cachedCtx;
  const AC =
    (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext })
      .AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  try {
    cachedCtx = new AC();
    return cachedCtx;
  } catch {
    return null;
  }
}

/** Beep corto y agradable de éxito (sale completed). */
export function playSaleSuccessSound() {
  if (!getPosSoundEnabled()) return;
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const now = ctx.currentTime;
    const notes = [
      { freq: 880, t: 0 },
      { freq: 1318.5, t: 0.09 },
    ];
    notes.forEach(({ freq, t }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, now + t);
      gain.gain.exponentialRampToValueAtTime(0.18, now + t + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.18);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + t);
      osc.stop(now + t + 0.2);
    });
  } catch {
    /* noop */
  }
}
