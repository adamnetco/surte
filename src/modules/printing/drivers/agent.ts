// Cliente del agente de impresión local (Electron / Node) que escucha en
// http://127.0.0.1:9101. Distribuye trabajos a impresoras LAN (TCP 9100),
// USB nativo (libusb) con fallback al spooler del SO, y Bluetooth (noble).
//
// Si el agente no está disponible o no soporta la capacidad pedida, lanza un
// error capturable para que el caller haga fallback a WebUSB / WebBluetooth.

const AGENT_URL = "http://127.0.0.1:9101";

export interface AgentCapabilities {
  lan: boolean;
  usb_native: boolean;
  usb_spooler: boolean;
  bluetooth: boolean;
  usb_native_error?: string | null;
  bluetooth_error?: string | null;
}

export interface AgentPrintRequest {
  printer_id: string;
  connection: "lan" | "usb" | "bluetooth";
  escpos_b64: string;
  // LAN
  ip_address?: string | null;
  port?: number | null;
  // USB nativo / spooler
  vendor_id?: number | null;
  product_id?: number | null;
  printer_name?: string | null;
  // Bluetooth
  bluetooth_address?: string | null;
  open_drawer?: boolean;
}

export async function pingAgent(timeoutMs = 800): Promise<boolean> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`${AGENT_URL}/health`, { signal: ctrl.signal });
    return r.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

export async function getAgentCapabilities(timeoutMs = 800): Promise<AgentCapabilities | null> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const r = await fetch(`${AGENT_URL}/health`, { signal: ctrl.signal });
    if (!r.ok) return null;
    const j = await r.json();
    return j?.capabilities ?? null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

export async function printViaAgent(req: AgentPrintRequest): Promise<void> {
  const r = await fetch(`${AGENT_URL}/print`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!r.ok) throw new Error(`Agente respondió ${r.status}: ${await r.text().catch(() => "")}`);
}
