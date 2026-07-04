import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Lock, ShieldCheck } from "lucide-react";

import Numpad from "./Numpad";
import { toast } from "sonner";
import { getAutoLockMinutes } from "@/lib/posPinPrefs";
import { logPosSecurityEvent } from "@/lib/posSecurityAudit";

/**
 * Bloqueo local del POS por PIN de 4 dígitos.
 *
 * - PIN se guarda hasheado (SHA-256) en localStorage por userId.
 * - Auto-lock por inactividad, configurable por usuario (0 = nunca).
 * - Al bloquear, el ticket, mesa y estado se conservan (overlay encima del workspace).
 * - Si no hay PIN configurado, la primera vez que se activa el lock pide configurarlo.
 * - Expone `window.__posPinRequest(reason)` para exigir PIN antes de acciones críticas
 *   (ej. COBRAR). Resuelve `true` si el usuario desbloqueó, `false` si canceló.
 */
export default function POSPinLock({
  userId,
  cashierName,
  idleMs,
}: {
  userId: string;
  cashierName?: string;
  /** Override manual; si no se pasa, se lee la preferencia por usuario. */
  idleMs?: number;
}) {
  const storageKey = `pos:pin:${userId}`;
  const [pinHash, setPinHash] = useState<string | null>(() => {
    try { return localStorage.getItem(storageKey); } catch { return null; }
  });
  const [locked, setLocked] = useState(false);
  const [mode, setMode] = useState<"unlock" | "set" | "confirm">("unlock");
  const [draft, setDraft] = useState("");
  const [firstPin, setFirstPin] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const pendingResolveRef = useRef<((ok: boolean) => void) | null>(null);
  const [effectiveIdleMs, setEffectiveIdleMs] = useState<number>(() => {
    if (typeof idleMs === "number") return idleMs;
    const m = getAutoLockMinutes(userId);
    return m > 0 ? m * 60 * 1000 : 0;
  });

  // Reacciona a cambios de preferencias (auto-lock configurable desde ajustes).
  useEffect(() => {
    const sync = () => {
      if (typeof idleMs === "number") { setEffectiveIdleMs(idleMs); return; }
      const m = getAutoLockMinutes(userId);
      setEffectiveIdleMs(m > 0 ? m * 60 * 1000 : 0);
    };
    window.addEventListener("pos:pin:prefs-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("pos:pin:prefs-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, [idleMs, userId]);

  // Bloqueo de scroll del body mientras el overlay está activo.
  // Evita que el ticket se desplace o reciba toques por debajo del backdrop.
  useEffect(() => {
    if (!locked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Focus inicial en el modal (el Numpad captura los siguientes eventos).
    dialogRef.current?.focus();
    return () => { document.body.style.overflow = prev; };
  }, [locked]);


  const hashPin = async (pin: string) => {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pin));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  };

  const resetIdle = useCallback(() => {
    if (locked) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    if (effectiveIdleMs <= 0) return; // "Nunca"
    timerRef.current = window.setTimeout(() => {
      setLocked(true);
      setMode(pinHash ? "unlock" : "set");
      setDraft("");
      setError(null);
      setReason(null);
      logPosSecurityEvent("pin_lock", { trigger: "idle", meta: { idleMs: effectiveIdleMs } });
    }, effectiveIdleMs);
  }, [locked, effectiveIdleMs, pinHash]);

  useEffect(() => {
    const events: (keyof WindowEventMap)[] = ["pointerdown", "keydown", "wheel", "touchstart"];
    events.forEach((e) => window.addEventListener(e, resetIdle, { passive: true }));
    resetIdle();
    return () => {
      events.forEach((e) => window.removeEventListener(e, resetIdle));
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [resetIdle]);

  // Handler imperativo — se registra en window para que POSWorkspace pueda exigir PIN
  // antes de acciones críticas (COBRAR, cierre de caja, etc.).
  useEffect(() => {
    (window as unknown as { __posPinRequest?: (r?: string) => Promise<boolean> }).__posPinRequest =
      (r?: string) => new Promise<boolean>((resolve) => {
        // Si no hay PIN configurado, la acción se permite (no bloquear al usuario que aún no ha activado seguridad).
        if (!pinHash) { resolve(true); return; }
        pendingResolveRef.current = resolve;
        setReason(r ?? null);
        setLocked(true);
        setMode("unlock");
        setDraft("");
        setError(null);
      });
    return () => {
      delete (window as unknown as { __posPinRequest?: unknown }).__posPinRequest;
    };
  }, [pinHash]);

  const handleConfirm = async (pin: string) => {
    if (pin.length !== 4) return;
    setError(null);
    try { navigator.vibrate?.(8); } catch { /* noop */ }

    if (mode === "unlock") {
      const h = await hashPin(pin);
      if (h === pinHash) {
        setLocked(false);
        setDraft("");
        setReason(null);
        if (pendingResolveRef.current) { pendingResolveRef.current(true); pendingResolveRef.current = null; }
        else toast.success("Caja desbloqueada");
      } else {
        setError("PIN incorrecto");
        setDraft("");
        try { navigator.vibrate?.([30, 60, 30]); } catch { /* noop */ }
      }
      return;
    }

    if (mode === "set") {
      setFirstPin(pin);
      setMode("confirm");
      setDraft("");
      return;
    }

    if (mode === "confirm") {
      if (pin === firstPin) {
        const h = await hashPin(pin);
        try { localStorage.setItem(storageKey, h); } catch { /* noop */ }
        setPinHash(h);
        setLocked(false);
        setDraft("");
        setFirstPin(null);
        setMode("unlock");
        toast.success("PIN configurado");
      } else {
        setError("Los PIN no coinciden");
        setFirstPin(null);
        setMode("set");
        setDraft("");
      }
    }
  };

  const lockNow = useCallback(() => {
    setLocked(true);
    setMode(pinHash ? "unlock" : "set");
    setDraft("");
    setError(null);
    setReason(null);
  }, [pinHash]);

  // Ctrl+L / Cmd+L → bloquear caja al instante. Ignora si el foco está en un input
  // (Ctrl+L en algunos navegadores selecciona la URL; preventDefault en el POS es OK).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.shiftKey || e.altKey) return;
      if (e.key !== "l" && e.key !== "L") return;
      const t = e.target as HTMLElement | null;
      if (t?.tagName === "INPUT" || t?.tagName === "TEXTAREA" || t?.isContentEditable) return;
      e.preventDefault();
      lockNow();
    };
    window.addEventListener("keydown", handler);
    // Evento global disparado desde AppDesktopBar → "Bloquear pantalla".
    const onGlobalLock = () => lockNow();
    window.addEventListener("pin-lock:lock", onGlobalLock);
    return () => {
      window.removeEventListener("keydown", handler);
      window.removeEventListener("pin-lock:lock", onGlobalLock);
    };
  }, [lockNow]);

  return (
    <>
      {/* Botón flotante de bloqueo — thumb-zone abajo-izquierda */}
      {!locked && (
        <button
          onClick={lockNow}
          aria-label="Bloquear caja"
          className="fixed bottom-4 left-4 z-40 h-12 w-12 rounded-full bg-background border-2 border-border shadow-lg flex items-center justify-center [touch-action:manipulation] active:scale-95 hover:bg-muted"
          title="Bloquear caja (Ctrl+L)"
        >
          <Lock className="w-5 h-5 text-muted-foreground" />
        </button>
      )}

      {locked && (
        <div
          className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          ref={dialogRef}
          tabIndex={-1}
          onKeyDown={(e) => { if (e.key === "Tab") e.preventDefault(); /* trap focus dentro del modal */ }}
        >
          <div className="w-full max-w-sm bg-card border rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="text-center space-y-1">
              <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                {mode === "unlock" ? <Lock className="w-7 h-7 text-primary" /> : <ShieldCheck className="w-7 h-7 text-primary" />}
              </div>
              <h2 id={titleId} className="text-xl font-bold">

                {mode === "unlock" ? "Caja bloqueada" : mode === "set" ? "Configura tu PIN" : "Confirma tu PIN"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {mode === "unlock"
                  ? (reason ?? `Ingresa tu PIN, ${cashierName ?? "cajero"}`)
                  : mode === "set"
                    ? "4 dígitos — se guarda solo en este dispositivo"
                    : "Repite el PIN para confirmarlo"}
              </p>
            </div>

            {/* Display de puntos */}
            <div className="flex justify-center gap-3 py-2">
              {[0, 1, 2, 3].map((i) => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full border-2 transition-colors ${
                    draft.length > i ? "bg-primary border-primary" : "border-muted-foreground/30"
                  }`}
                />
              ))}
            </div>

            {error && (
              <p className="text-center text-sm text-destructive font-medium">{error}</p>
            )}

            <Numpad
              value={draft}
              onChange={(v) => { setDraft(v); if (error) setError(null); }}
              onConfirm={() => handleConfirm(draft)}
              confirmDisabled={draft.length !== 4}
              maxDigits={4}
              confirmLabel={mode === "unlock" ? "Desbloquear" : mode === "set" ? "Siguiente" : "Confirmar"}
            />

            {mode === "unlock" && (
              <button
                onClick={() => {
                  if (confirm("¿Restablecer PIN? Se te pedirá configurar uno nuevo.")) {
                    try { localStorage.removeItem(storageKey); } catch { /* noop */ }
                    setPinHash(null);
                    setMode("set");
                    setDraft("");
                    setError(null);
                    if (pendingResolveRef.current) { pendingResolveRef.current(false); pendingResolveRef.current = null; }
                  }
                }}
                className="w-full text-xs text-muted-foreground hover:text-foreground py-2 [touch-action:manipulation]"
              >
                ¿Olvidaste tu PIN?
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
