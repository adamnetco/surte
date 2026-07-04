/**
 * Puente delgado con el proceso principal de Electron.
 *
 * En web (sin Electron), todas las llamadas son no-ops silenciosos.
 * El preload expone `window.surteyaDesktop` (histórico) y `window.electronWin`
 * (window controls). Ambos son opcionales.
 */

type ElectronWinBridge = {
  minimize: () => void;
  maximize: () => void;
  close: () => void;
  isMaximized: () => Promise<boolean>;
  onMaximizeChange: (cb: (max: boolean) => void) => () => void;
};

type SurteyaDesktopBridge = {
  isDesktop: true;
  licenseStatus?: () => Promise<unknown>;
  activateLicense?: (key: string) => Promise<unknown>;
};

declare global {
  interface Window {
    electronWin?: ElectronWinBridge;
    surteyaDesktop?: SurteyaDesktopBridge;
  }
}

export function isElectron(): boolean {
  return typeof window !== "undefined" && (!!window.electronWin || !!window.surteyaDesktop);
}

export function getWindowBridge(): ElectronWinBridge | null {
  return (typeof window !== "undefined" && window.electronWin) || null;
}
