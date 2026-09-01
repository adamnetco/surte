/**
 * @deprecated Usa el puerto `IDesktopBridge` vía
 * `getDesktopBridge()` de `@/infrastructure/desktop/ElectronDesktopBridge`.
 *
 * Este módulo queda como shim de compatibilidad para llamadas existentes.
 */
import { getDesktopBridge } from "@/infrastructure/desktop/ElectronDesktopBridge";
import type { DesktopWindowControls } from "@/core/ports/IDesktopBridge";

export function isElectron(): boolean {
  return getDesktopBridge().isDesktop;
}

export function getWindowBridge(): DesktopWindowControls | null {
  return getDesktopBridge().getWindowControls();
}
