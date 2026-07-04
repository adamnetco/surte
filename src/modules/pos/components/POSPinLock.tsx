import { useCallback, useEffect, useRef, useState } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import Numpad from "./Numpad";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

/**
 * Bloqueo local del POS por PIN de 4 dígitos.
 *
 * - PIN se guarda hasheado (SHA-256) en localStorage por userId.
 * - Auto-lock por inactividad (default 3min) — cualquier touch/click/keydown resetea.
 * - Al bloquear, el ticket, mesa y estado se conservan (overlay encima del workspace).
 * - Si no hay PIN configurado, la primera vez que se activa el lock pide configurarlo.
 *
 * Uso: montar en la raíz del POSWorkspace. Expone <button> flotante “Lock” abajo-izq.
 */
export default function POSPinLock({
  userId,
  cashierName,
  idleMs = 3 * 60 * 1000,
}: {
  userId: string;
  cashierName?: string;
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
  const timerRef = useRef<number | null>(null);

  const hashPin = async (pin: string) => {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pin));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
  };

  const resetIdle = useCallback(() => {
    if (locked) return;
    if (timerRef.current) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      setLocked(true);
      setMode(pinHash ? "unlock" : "set");
      setDraft("");
      setError(null);
    }, idleMs);
  }, [locked, idleMs, pinHash]);

  useEffect(() => {
    const events: (keyof WindowEventMap)[] = ["pointerdown", "keydown", "wheel", "touchstart"];
    events.forEach((e) => window.addEventListener(e, resetIdle, { passive: true }));
    resetIdle();
    return () => {
      events.forEach((e) => window.removeEventListener(e, resetIdle));
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [resetIdle]);

  const handleConfirm = async (pin: string) => {
    if (pin.length !== 4) return;
    setError(null);
    try { navigator.vibrate?.(8); } catch { /* noop */ }

    if (mode === "unlock") {
      const h = await hashPin(pin);
      if (h === pinHash) {
        setLocked(false);
        setDraft("");
        toast.success("Caja desbloqueada");
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

  const lockNow = () => {
    setLocked(true);
    setMode(pinHash ? "unlock" : "set");
    setDraft("");
    setError(null);
  };

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
        <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-card border rounded-2xl shadow-2xl p-6 space-y-4">
            <div className="text-center space-y-1">
              <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
                {mode === "unlock" ? <Lock className="w-7 h-7 text-primary" /> : <ShieldCheck className="w-7 h-7 text-primary" />}
              </div>
              <h2 className="text-xl font-bold">
                {mode === "unlock" ? "Caja bloqueada" : mode === "set" ? "Configura tu PIN" : "Confirma tu PIN"}
              </h2>
              <p className="text-sm text-muted-foreground">
                {mode === "unlock"
                  ? `Ingresa tu PIN, ${cashierName ?? "cajero"}`
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
