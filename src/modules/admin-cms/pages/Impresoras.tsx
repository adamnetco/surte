import { useEffect, useState } from "react";
import { Printer, Wifi, ServerCog, TestTube2, ReceiptText, Loader2 } from "lucide-react";
import { toast } from "sonner";
import AdminHeader from "@/modules/admin-cms/components/AdminHeader";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PrintersManagerTab,
  buildReceipt,
  EscPosBuilder,
  isTauriRuntime,
  printOnceTauriTcp,
  pingAgent,
  printViaAgent,
} from "@/modules/printing";
import type { TicketData } from "@/modules/printing";

/**
 * Impresoras (Admin) — configuración previa a imprimir.
 *
 * Capa de presentación: no contiene lógica de negocio. La conexión RAW 9100 se
 * resuelve por runtime (Tauri → comando Rust; Electron/navegador → agente
 * local) y el ticket de prueba usa el mismo `buildReceipt` del POS.
 */

const LS_KEY = "sistecpos:printerQuickTest";

function demoTicket(businessName: string): TicketData {
  return {
    org: { business_name: businessName || "Mi tienda", legal_name: null, nit: null, address: null, phone: null },
    ticket_number: "PRUEBA",
    cashier_name: "Configuración",
    created_at: new Date(),
    items: [
      { name: "Producto de prueba", qty: 2, unit_price: 5000, total: 10000 },
      { name: "Servicio de prueba", qty: 1, unit_price: 3500, total: 3500 },
    ] as TicketData["items"],
    subtotal: 13500,
    discount: 0,
    tax: 0,
    tip: 0,
    total: 13500,
    amount_paid: 20000,
    change_due: 6500,
    payments: [{ method: "efectivo", amount: 20000 }],
  };
}

export default function ImpresorasAdmin() {
  const { currentOrg, loading } = useOrganization();
  const [host, setHost] = useState("192.168.1.50");
  const [port, setPort] = useState("9100");
  const [busy, setBusy] = useState<"none" | "probe" | "ticket" | "drawer">("none");
  const [agentOnline, setAgentOnline] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as { host?: string; port?: string };
        if (saved.host) setHost(saved.host);
        if (saved.port) setPort(saved.port);
      }
    } catch {
      /* preferencia opcional */
    }
    pingAgent().then(setAgentOnline);
  }, []);

  const persist = (h: string, p: string) => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify({ host: h, port: p }));
    } catch {
      /* noop */
    }
  };

  const sendRaw = async (bytes: Uint8Array) => {
    const portNum = Number(port) || 9100;
    if (isTauriRuntime()) {
      await printOnceTauriTcp(host.trim(), bytes, portNum);
      return "Tauri (RAW TCP)";
    }
    const online = await pingAgent();
    setAgentOnline(online);
    if (!online) {
      throw new Error(
        "Sin runtime de escritorio ni agente local en 127.0.0.1:9101. Abre el POS de escritorio para imprimir por red.",
      );
    }
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    await printViaAgent({
      printer_id: "quick-test",
      connection: "lan",
      escpos_b64: btoa(bin),
      ip_address: host.trim(),
      port: portNum,
    });
    return "Agente local (LAN)";
  };

  const run = async (kind: "probe" | "ticket" | "drawer") => {
    if (!host.trim()) {
      toast.error("Indica la IP de la impresora");
      return;
    }
    persist(host.trim(), port);
    setBusy(kind);
    try {
      let bytes: Uint8Array;
      if (kind === "ticket") {
        bytes = buildReceipt(demoTicket(currentOrg?.business_name ?? ""), 80).build();
      } else if (kind === "drawer") {
        bytes = new EscPosBuilder().init().openDrawer().build();
      } else {
        bytes = new EscPosBuilder()
          .init()
          .align("center")
          .bold(true)
          .line("PRUEBA DE CONEXION")
          .bold(false)
          .line(`${host.trim()}:${Number(port) || 9100}`)
          .line(new Date().toLocaleString("es-CO"))
          .feed(3)
          .cut()
          .build();
      }
      const via = await sendRaw(bytes);
      toast.success(`Enviado por ${via}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo enviar a la impresora");
    } finally {
      setBusy("none");
    }
  };

  return (
    <div className="min-h-dvh bg-background pb-24">
      <AdminHeader />
      <main className="max-w-7xl mx-auto px-3 py-4 space-y-4">
        <section aria-labelledby="quick-test-title">
          <Card className="p-4 border-border/60 rounded-lg">
            <header className="flex items-center gap-2 mb-3">
              <Wifi size={18} className="text-primary" aria-hidden="true" />
              <h2 id="quick-test-title" className="font-semibold text-sm">
                Prueba rápida por red (RAW 9100)
              </h2>
              <Badge variant={agentOnline ? "default" : "secondary"} className="ml-auto text-[10px]">
                {isTauriRuntime()
                  ? "Runtime escritorio"
                  : agentOnline === null
                    ? "Verificando agente…"
                    : agentOnline
                      ? "Agente local activo"
                      : "Sin agente local"}
              </Badge>
            </header>

            <div className="grid gap-3 sm:grid-cols-[1fr_120px]">
              <div className="space-y-1">
                <Label htmlFor="printer-host">IP de la impresora</Label>
                <Input
                  id="printer-host"
                  inputMode="decimal"
                  value={host}
                  onChange={(e) => setHost(e.target.value)}
                  placeholder="192.168.1.50"
                  className="h-11"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="printer-port">Puerto</Label>
                <Input
                  id="printer-port"
                  inputMode="numeric"
                  value={port}
                  onChange={(e) => setPort(e.target.value)}
                  placeholder="9100"
                  className="h-11"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 mt-3">
              <Button onClick={() => run("probe")} disabled={busy !== "none"} className="h-11">
                {busy === "probe" ? (
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                ) : (
                  <TestTube2 size={16} aria-hidden="true" />
                )}
                Probar conexión
              </Button>
              <Button variant="secondary" onClick={() => run("ticket")} disabled={busy !== "none"} className="h-11">
                {busy === "ticket" ? (
                  <Loader2 size={16} className="animate-spin" aria-hidden="true" />
                ) : (
                  <ReceiptText size={16} aria-hidden="true" />
                )}
                Ticket de prueba (monto y cambio)
              </Button>
              <Button variant="outline" onClick={() => run("drawer")} disabled={busy !== "none"} className="h-11">
                <ServerCog size={16} aria-hidden="true" />
                Abrir cajón
              </Button>
            </div>

            <p className="text-xs text-muted-foreground mt-3">
              La impresora debe tener IP fija y el puerto RAW 9100 habilitado. En navegador esta prueba requiere el POS
              de escritorio abierto (agente local); en el ejecutable Tauri se envía directo sin diálogo del sistema.
            </p>
          </Card>
        </section>

        <section aria-labelledby="fleet-title" className="space-y-2">
          <header className="flex items-center gap-2">
            <Printer size={18} className="text-primary" aria-hidden="true" />
            <h2 id="fleet-title" className="font-semibold text-sm">
              Impresoras de la tienda
            </h2>
          </header>
          {loading ? (
            <div className="space-y-2" aria-busy="true">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : currentOrg?.id ? (
            <PrintersManagerTab organizationId={currentOrg.id} />
          ) : (
            <p className="text-sm text-muted-foreground">Selecciona una tienda para configurar sus impresoras.</p>
          )}
        </section>
      </main>
    </div>
  );
}
