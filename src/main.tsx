import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { wireOutboxListeners } from "./lib/offline/outbox";
import { consumeHandoff } from "./modules/auth/lib/ssoHandoff";

wireOutboxListeners();

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
