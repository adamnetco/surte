/**
 * IDesktopBridge — contrato de la capa `core` con el host de escritorio.
 *
 * La UI nunca debe tocar `window.electronWin` / `window.surteyaDesktop`
 * directamente: consume este puerto y la infraestructura decide si el
 * adaptador es Electron o un no-op web.
 *
 * Fase 4 · Slice 4 (Desacoplamiento del host nativo).
 */

export type DesktopHostKind = "electron" | "browser";

export interface DesktopPlatformInfo {
  /** Tipo de host donde corre la app. */
  kind: DesktopHostKind;
  /** Plataforma normalizada del SO (`win32` | `darwin` | `linux` | `web`). */
  platform: "win32" | "darwin" | "linux" | "web";
  /** Versión del cliente instalado, cuando el host la expone. */
  appVersion: string | null;
}

export interface DesktopWindowControls {
  minimize(): void;
  toggleMaximize(): void;
  close(): void;
  isMaximized(): Promise<boolean>;
  /** Suscripción a cambios de maximizado; retorna la función de baja. */
  onMaximizeChange(cb: (maximized: boolean) => void): () => void;
}

export interface IDesktopBridge {
  /** `true` solo cuando existe un host nativo real. */
  readonly isDesktop: boolean;
  /** Información de host/SO/versión (nunca lanza). */
  getPlatform(): DesktopPlatformInfo;
  /** Controles de ventana nativos, o `null` en web. */
  getWindowControls(): DesktopWindowControls | null;
  /** Estado del agente local de impresión (`null` si no aplica/no responde). */
  probePrintAgent(timeoutMs?: number): Promise<{ ok: boolean; version?: string } | null>;
}
