import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Lock, Delete, ShieldCheck } from "lucide-react";
import { useAuth } from "@/modules/auth/context/AuthContext";

/**
 * Ola 6 — Slice D
 * Lock-screen PIN. Self-contained full-screen overlay that locks the app
 * after inactivity on /admin or /pos routes. PIN (4-6 digits) is stored
 * as a SHA-256 hash in localStorage scoped per user. Other components can
 * trigger a manual lock by dispatching `window.dispatchEvent(new Event("pin-lock:lock"))`
 * or set / clear the PIN via the `pin-lock:setup` / `pin-lock:clear` events.
 */

const IDLE_MS = 15 * 60 * 1000; // 15 min
const STORAGE_PREFIX = "pos:pin:";

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

type Mode = "verify" | "setup" | "confirm";

export default function PinLock() {
  const { user } = useAuth();
  const location = useLocation();
  const path = location.pathname;

  const storageKey = user ? `${STORAGE_PREFIX}${user.id}` : null;

  const [hasPin, setHasPin] = useState<boolean>(false);
  const [locked, setLocked] = useState(false);
  const [mode, setMode] = useState<Mode>("verify");
  const [entered, setEntered] = useState("");
  const [draftPin, setDraftPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  // Read existing PIN status when user changes
  useEffect(() => {
    if (!storageKey) {
      setHasPin(false);
      return;
    }
    setHasPin(!!localStorage.getItem(storageKey));
  }, [storageKey]);

  // Reset state when locked toggles off
  useEffect(() => {
    if (!locked) {
      setEntered("");
      setDraftPin("");
      setError(null);
      setMode(hasPin ? "verify" : "setup");
    }
  }, [locked, hasPin]);

  // Routes that participate in idle-lock
  const isProtectedRoute = useMemo(
    () => path.startsWith("/admin") || path.startsWith("/pos") || path.startsWith("/superadmin"),
    [path],
  );

  // Idle timer — only if user has a PIN and is on a protected route
  useEffect(() => {
    if (!user || !hasPin || !isProtectedRoute || locked) return;

    const reset = () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setLocked(true), IDLE_MS);
    };
    const events: (keyof WindowEventMap)[] = ["mousemove", "keydown", "touchstart", "click"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, [user, hasPin, isProtectedRoute, locked]);

  // External events
  useEffect(() => {
    const onLock = () => {
      if (!hasPin) {
        setMode("setup");
      }
      setLocked(true);
    };
    const onSetup = () => {
      setMode("setup");
      setLocked(true);
    };
    const onClear = () => {
      if (storageKey) localStorage.removeItem(storageKey);
      setHasPin(false);
    };
    window.addEventListener("pin-lock:lock", onLock);
    window.addEventListener("pin-lock:setup", onSetup);
    window.addEventListener("pin-lock:clear", onClear);
    return () => {
      window.removeEventListener("pin-lock:lock", onLock);
      window.removeEventListener("pin-lock:setup", onSetup);
      window.removeEventListener("pin-lock:clear", onClear);
    };
  }, [hasPin, storageKey]);

  const maxLen = 6;

  const handleDigit = useCallback(
    (d: string) => {
      setError(null);
      if (mode === "verify") {
        setEntered((p) => (p.length >= maxLen ? p : p + d));
      } else if (mode === "setup") {
        setDraftPin((p) => (p.length >= maxLen ? p : p + d));
      } else {
        setEntered((p) => (p.length >= maxLen ? p : p + d));
      }
    },
    [mode],
  );

  const handleBackspace = useCallback(() => {
    setError(null);
    if (mode === "verify" || mode === "confirm") setEntered((p) => p.slice(0, -1));
    else setDraftPin((p) => p.slice(0, -1));
  }, [mode]);

  const submit = useCallback(async () => {
    if (!storageKey) return;
    if (mode === "verify") {
      if (entered.length < 4) {
        setError("PIN debe tener al menos 4 dígitos");
        return;
      }
      const stored = localStorage.getItem(storageKey);
      const hash = await sha256(entered);
      if (stored === hash) {
        setLocked(false);
      } else {
        setError("PIN incorrecto");
        setEntered("");
      }
    } else if (mode === "setup") {
      if (draftPin.length < 4) {
        setError("PIN debe tener al menos 4 dígitos");
        return;
      }
      setMode("confirm");
      setEntered("");
    } else {
      // confirm
      if (entered !== draftPin) {
        setError("Los PIN no coinciden");
        setEntered("");
        setDraftPin("");
        setMode("setup");
        return;
      }
      const hash = await sha256(draftPin);
      localStorage.setItem(storageKey, hash);
      setHasPin(true);
      setLocked(false);
    }
  }, [mode, entered, draftPin, storageKey]);

  // Auto-submit when reaching maxLen on verify
  useEffect(() => {
    if (!locked) return;
    if ((mode === "verify" || mode === "confirm") && entered.length === maxLen) {
      submit();
    }
  }, [entered, mode, locked, submit]);

  // Keyboard input
  useEffect(() => {
    if (!locked) return;
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) {
        handleDigit(e.key);
      } else if (e.key === "Backspace") {
        handleBackspace();
      } else if (e.key === "Enter") {
        submit();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [locked, handleDigit, handleBackspace, submit]);

  if (!user || !locked) return null;

  const activeValue = mode === "setup" ? draftPin : entered;
  const title =
    mode === "verify"
      ? "Pantalla bloqueada"
      : mode === "setup"
      ? "Configura tu PIN"
      : "Confirma tu PIN";
  const subtitle =
    mode === "verify"
      ? "Ingresa tu PIN para continuar"
      : mode === "setup"
      ? "Elige un PIN de 4 a 6 dígitos"
      : "Vuelve a ingresarlo";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Pantalla de bloqueo"
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm px-4 print:hidden"
    >
      <div className="flex flex-col items-center gap-4 w-full max-w-xs">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          {mode === "verify" ? <Lock className="h-7 w-7" /> : <ShieldCheck className="h-7 w-7" />}
        </div>
        <div className="text-center">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>

        {/* Dots */}
        <div className="flex items-center gap-2 my-2" aria-label={`PIN ${activeValue.length} de ${maxLen}`}>
          {Array.from({ length: maxLen }).map((_, i) => (
            <span
              key={i}
              className={`h-3 w-3 rounded-full border ${
                i < activeValue.length ? "bg-primary border-primary" : "border-muted-foreground/40"
              }`}
            />
          ))}
        </div>

        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}

        {/* Keypad */}
        <div className="grid grid-cols-3 gap-2 w-full">
          {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => handleDigit(d)}
              className="h-14 rounded-lg border border-border bg-card text-xl font-semibold hover:bg-accent active:scale-95 transition"
              aria-label={`Dígito ${d}`}
            >
              {d}
            </button>
          ))}
          <button
            type="button"
            onClick={submit}
            className="h-14 rounded-lg border border-border bg-card text-sm font-medium hover:bg-accent active:scale-95 transition"
            aria-label="Confirmar"
          >
            OK
          </button>
          <button
            type="button"
            onClick={() => handleDigit("0")}
            className="h-14 rounded-lg border border-border bg-card text-xl font-semibold hover:bg-accent active:scale-95 transition"
            aria-label="Dígito 0"
          >
            0
          </button>
          <button
            type="button"
            onClick={handleBackspace}
            className="h-14 rounded-lg border border-border bg-card flex items-center justify-center hover:bg-accent active:scale-95 transition"
            aria-label="Borrar"
          >
            <Delete className="h-5 w-5" />
          </button>
        </div>

        {mode === "verify" && (
          <button
            type="button"
            onClick={() => {
              if (!storageKey) return;
              if (confirm("¿Restablecer PIN? Se cerrará sesión y deberás configurarlo de nuevo.")) {
                localStorage.removeItem(storageKey);
                setHasPin(false);
                setMode("setup");
                setEntered("");
              }
            }}
            className="text-xs text-muted-foreground hover:text-foreground underline mt-2"
          >
            Restablecer PIN
          </button>
        )}
      </div>
    </div>
  );
}
