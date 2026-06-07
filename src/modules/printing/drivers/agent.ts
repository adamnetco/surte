// Cliente del agente de impresión local (Electron / Node) que escucha en
// http://127.0.0.1:9101. Distribuye trabajos a impresoras LAN (TCP 9100) o USB.
//
// Si el agente no está disponible, lanza un error capturable para que el caller
// haga fallback a WebUSB o vista previa HTML.

const AGENT_URL = "http://127.0.0.1:9101";

export interface AgentPrintRequest {
  printer_id: string;
  ip_address?: string | null;
  port?: number | null;
  connection: "lan" | "usb" | "bluetooth";
  escpos_b64: string;
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

export async function printViaAgent(req: AgentPrintRequest): Promise<void> {
  const r = await fetch(`${AGENT_URL}/print`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(req),
  });
  if (!r.ok) throw new Error(`Agente respondió ${r.status}: ${await r.text().catch(() => "")}`);
}
