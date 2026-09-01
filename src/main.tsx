import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { wireOutboxListeners } from "@/modules/offline/lib/outbox";
import { consumeHandoff } from "./modules/auth/lib/ssoHandoff";

// Guard de arranque: si el build se generó sin .env / .env.local, el cliente de
// Supabase queda con URL undefined y la app muere en blanco/negro sin mensaje.
// Mostramos el motivo real en pantalla en vez de dejar la ventana vacía.
if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML = `
      <main style="min-height:100dvh;display:flex;align-items:center;justify-content:center;background:#0F172A;color:#E2E8F0;font-family:system-ui,sans-serif;padding:24px">
        <div style="max-width:560px;border:1px solid #1E293B;border-radius:12px;padding:24px;background:#111C2E">
          <h1 style="font-size:18px;margin:0 0 8px">Configuración incompleta</h1>
          <p style="font-size:14px;line-height:1.5;margin:0 0 12px;color:#94A3B8">
            Este build se generó sin las variables de entorno de la base de datos,
            por eso no carga ninguna pantalla ni datos.
          </p>
          <p style="font-size:13px;line-height:1.6;margin:0;color:#94A3B8">
            Crea <code>.env.local</code> en la raíz del proyecto (copia
            <code>.env.local.example</code>) con <code>VITE_SUPABASE_URL</code> y
            <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>, y vuelve a ejecutar
            <code>npm run build</code> antes de abrir el cliente de escritorio.
          </p>
        </div>
      </main>`;
  }
  throw new Error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY at build time");
}

wireOutboxListeners();

// CSP violation telemetry — POSTea cada violación a la edge function csp-report.
// Sin bloqueo: si falla, ignoramos. Throttle simple para evitar inundación.
(() => {
  if (typeof window === "undefined") return;
  const sent = new Set<string>();
  const endpoint = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/csp-report`;
  window.addEventListener("securitypolicyviolation", (e) => {
    try {
      const key = `${e.effectiveDirective}|${e.blockedURI}|${e.sourceFile}:${e.lineNumber}`;
      if (sent.has(key)) return;
      sent.add(key);
      if (sent.size > 200) sent.clear();
      const payload = {
        documentURI: e.documentURI,
        violatedDirective: e.violatedDirective,
        effectiveDirective: e.effectiveDirective,
        blockedURI: e.blockedURI,
        sourceFile: e.sourceFile,
        lineNumber: e.lineNumber,
        columnNumber: e.columnNumber,
        disposition: e.disposition,
        statusCode: e.statusCode,
      };
      const body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        navigator.sendBeacon(endpoint, new Blob([body], { type: "application/json" }));
      } else {
        fetch(endpoint, { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
      }
    } catch { /* noop */ }
  });
})();

// SSO cross-subdomain: si la URL trae #sps_sso=..., instala la sesión
// ANTES de montar React para que AuthContext arranque ya autenticado.
void consumeHandoff().finally(() => {
  createRoot(document.getElementById("root")!).render(<App />);
});


// ── PWA registration with iframe + preview-host guard ────────────
const isInIframe = (() => {
  try { return window.self !== window.top; } catch { return true; }
})();
const isPreviewHost =
  typeof window !== "undefined" &&
  (window.location.hostname.includes("id-preview--") ||
   window.location.hostname.includes("lovableproject.com") ||
   window.location.hostname.includes("lovable.app"));

// Bajo file:// (Electron) el service worker no está permitido: registrarlo lanza
// una excepción que puede dejar la ventana en negro.
const isFileProtocol = typeof window !== "undefined" && window.location.protocol === "file:";

if ("serviceWorker" in navigator && !isFileProtocol) {
  if (isInIframe || isPreviewHost) {
    // Cleanup any previously-registered SW so preview never serves stale code
    navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()));
  } else {
    // Lazy-import the auto-generated SW registration on production hosts only
    import("virtual:pwa-register")
      .then(({ registerSW }) => {
        registerSW({ immediate: true });
      })
      .catch(() => {/* no-op */});
    // Register the push companion SW (handles push + notificationclick)
    navigator.serviceWorker.register("/sw-push.js", { scope: "/" }).catch(() => {/* no-op */});
  }
}
