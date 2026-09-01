/**
 * IDesktopBridge — contrato de la capa `core` con el host de escritorio.
 *
 * La UI nunca debe tocar `window.electronWin` / `window.sistecposDesktop`
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

/**
 * Paquete de identidad del tenant entregado por el host nativo tras activar la
 * licencia. El runtime desktop es genérico: sin este manifiesto no sabe a qué
 * organización pertenece.
 */
export interface TenantManifest {
  organization_id: string;
  slug: string | null;
  name: string | null;
  logo_url: string | null;
  primary_color: string | null;
  accent_color: string | null;
  enabled_modules: string[];
  plan: string | null;
  offline_bootstrap_version: string;
  [key: string]: unknown;
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
  /** Manifiesto del tenant activado en este equipo (`null` en web o sin activar). */
  getTenantManifest(): Promise<TenantManifest | null>;
}
