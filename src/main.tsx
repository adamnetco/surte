import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { wireOutboxListeners } from "@/modules/offline/lib/outbox";
import { consumeHandoff } from "./modules/auth/lib/ssoHandoff";

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

if ("serviceWorker" in navigator) {
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
