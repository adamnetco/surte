import { useEffect, useRef } from "react";
import { toast } from "sonner";

/**
 * Hace ping cada 15s al endpoint público de auth (`/auth/v1/health`).
 * Si responde mal por >30s, muestra un toast persistente.
 * Cuando se recupera, lo cierra y muestra un toast de éxito breve.
 *
 * Montar una sola vez (App.tsx).
 */
const PING_INTERVAL_MS = 15_000;
const PING_BACKOFF_MS = 60_000;
const DOWN_THRESHOLD_MS = 30_000;
const TOAST_ID = "auth-backend-down";

export default function AuthHealthMonitor() {
  const downSinceRef = useRef<number | null>(null);
  const shownRef = useRef(false);

  useEffect(() => {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/auth/v1/health`;
    const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
    let cancelled = false;

    const dismiss = () => {
      if (shownRef.current) {
        toast.dismiss(TOAST_ID);
        toast.success("Conexión con el servidor restablecida", { duration: 3000 });
        shownRef.current = false;
      }
      downSinceRef.current = null;
    };

    const markDown = () => {
      const now = Date.now();
      if (downSinceRef.current == null) downSinceRef.current = now;
      const elapsed = now - downSinceRef.current;
      if (elapsed >= DOWN_THRESHOLD_MS && !shownRef.current) {
        shownRef.current = true;
        toast.error("El servidor de autenticación está inestable. Reintentando…", {
          id: TOAST_ID,
          duration: Infinity,
        });
      }
    };

    const ping = async () => {
      if (!navigator.onLine) return markDown();
      try {
        const controller = new AbortController();
        const t = setTimeout(() => controller.abort(), 3000);
        const res = await fetch(url, {
          method: "GET",
          headers: { apikey },
          signal: controller.signal,
          cache: "no-store",
        });
        clearTimeout(t);
        if (cancelled) return;
        if (res.ok) dismiss();
        else markDown();
      } catch {
        if (!cancelled) markDown();
      }
    };

    void ping();
    const id = window.setInterval(() => {
      const interval = downSinceRef.current ? PING_BACKOFF_MS : PING_INTERVAL_MS;
      const last = Number(sessionStorage.getItem("sps:last_auth_health_ping") || 0);
      if (Date.now() - last < interval) return;
      sessionStorage.setItem("sps:last_auth_health_ping", String(Date.now()));
      void ping();
    }, PING_INTERVAL_MS);
    const onOnline = () => void ping();
    window.addEventListener("online", onOnline);

    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener("online", onOnline);
      toast.dismiss(TOAST_ID);
    };
  }, []);

  return null;
}
