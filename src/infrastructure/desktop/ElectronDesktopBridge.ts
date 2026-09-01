/**
 * ElectronDesktopBridge / WebDesktopBridge — adaptadores del puerto
 * `IDesktopBridge`. Aíslan por completo el acceso a `window.electronWin`
 * y `window.surteyaDesktop` fuera de la capa de presentación.
 */
import type {
  DesktopPlatformInfo,
  DesktopWindowControls,
  IDesktopBridge,
} from "@/core/ports/IDesktopBridge";
import { APP_VERSION } from "@/lib/version";

const PRINT_AGENT_URL = "http://127.0.0.1:9101/health";

type ElectronWinBridge = {
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  isMaximized: () => Promise<boolean>;
  onMaximizeChange: (cb: (max: boolean) => void) => () => void;
};

type SurteyaDesktopBridge = {
  isDesktop: true;
  platform?: string;
  appVersion?: string;
  licenseStatus?: () => Promise<unknown>;
  activateLicense?: (key: string) => Promise<unknown>;
};

declare global {
  interface Window {
    electronWin?: ElectronWinBridge;
    surteyaDesktop?: SurteyaDesktopBridge;
  }
}

function nativeWin(): ElectronWinBridge | null {
  return (typeof window !== "undefined" && window.electronWin) || null;
}

function nativeHost(): SurteyaDesktopBridge | null {
  return (typeof window !== "undefined" && window.surteyaDesktop) || null;
}

function detectPlatform(): DesktopPlatformInfo["platform"] {
  const declared = nativeHost()?.platform;
  if (declared === "win32" || declared === "darwin" || declared === "linux") return declared;
  if (typeof navigator === "undefined") return "web";
  const ua = navigator.userAgent;
  if (!nativeWin() && !nativeHost()) return "web";
  if (/Win/i.test(ua)) return "win32";
  if (/Mac/i.test(ua)) return "darwin";
  return "linux";
}

async function probePrintAgent(timeoutMs = 1200) {
  if (typeof fetch === "undefined") return null;
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(PRINT_AGENT_URL, { signal: ctrl.signal, cache: "no-store" });
    if (!res.ok) return { ok: false };
    const body = (await res.json().catch(() => null)) as { version?: string } | null;
    return { ok: true, version: body?.version };
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

class ElectronDesktopBridge implements IDesktopBridge {
  readonly isDesktop = true;

  getPlatform(): DesktopPlatformInfo {
    return {
      kind: "electron",
      platform: detectPlatform(),
      appVersion: nativeHost()?.appVersion ?? APP_VERSION,
    };
  }

  getWindowControls(): DesktopWindowControls | null {
    const win = nativeWin();
    if (!win) return null;
    return {
      minimize: () => win.minimize(),
      toggleMaximize: () => win.maximize(),
      close: () => win.close(),
      isMaximized: () => win.isMaximized(),
      onMaximizeChange: (cb) => win.onMaximizeChange(cb),
    };
  }

  probePrintAgent(timeoutMs?: number) {
    return probePrintAgent(timeoutMs);
  }
}

class WebDesktopBridge implements IDesktopBridge {
  readonly isDesktop = false;

  getPlatform(): DesktopPlatformInfo {
    return { kind: "browser", platform: "web", appVersion: APP_VERSION };
  }

  getWindowControls(): DesktopWindowControls | null {
    return null;
  }

  /** El agente de impresión también puede correr junto al navegador. */
  probePrintAgent(timeoutMs?: number) {
    return probePrintAgent(timeoutMs);
  }
}

const electronBridge = new ElectronDesktopBridge();
const webBridge = new WebDesktopBridge();

/** Resuelve el adaptador adecuado según el host actual. */
export function getDesktopBridge(): IDesktopBridge {
  return nativeWin() || nativeHost() ? electronBridge : webBridge;
}

export { ElectronDesktopBridge, WebDesktopBridge };
