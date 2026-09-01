/**
 * Driver ESC/POS para el runtime Tauri.
 *
 * En Tauri no existe WebUSB, así que los bytes crudos se envían por comandos
 * Rust (`escpos_print_tcp` / `escpos_print_device`). Esto evita el diálogo de
 * impresión del sistema operativo y mantiene el flujo del POS instantáneo.
 *
 * El driver es opcional: si la app corre en navegador o Electron, `isTauriRuntime()`
 * devuelve false y el POS sigue usando WebUSB / agente local sin cambios.
 */

type Invoke = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>;

function getInvoke(): Invoke | null {
  const g = globalThis as unknown as { __TAURI__?: { core?: { invoke?: Invoke } } };
  return g.__TAURI__?.core?.invoke ?? null;
}

export function isTauriRuntime(): boolean {
  return getInvoke() !== null;
}

export interface TauriRuntimeInfo {
  runtime: string;
  platform: string;
  version: string;
}

export async function getTauriRuntimeInfo(): Promise<TauriRuntimeInfo | null> {
  const invoke = getInvoke();
  if (!invoke) return null;
  try {
    return await invoke<TauriRuntimeInfo>("desktop_runtime_info");
  } catch {
    return null;
  }
}

/** Imprime en una térmica de red por puerto RAW (9100 por defecto). */
export async function printOnceTauriTcp(
  host: string,
  data: Uint8Array,
  port = 9100,
): Promise<number> {
  const invoke = getInvoke();
  if (!invoke) throw new Error("Runtime Tauri no disponible");
  return invoke<number>("escpos_print_tcp", {
    host,
    port,
    bytes: Array.from(data),
  });
}

/**
 * Imprime en un dispositivo o recurso compartido:
 * - Windows: `\\\\SERVIDOR\\TICKETERA`
 * - Linux:   `/dev/usb/lp0`
 */
export async function printOnceTauriDevice(path: string, data: Uint8Array): Promise<number> {
  const invoke = getInvoke();
  if (!invoke) throw new Error("Runtime Tauri no disponible");
  return invoke<number>("escpos_print_device", {
    path,
    bytes: Array.from(data),
  });
}
