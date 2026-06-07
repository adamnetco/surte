// Tab de administración de impresoras (CMS admin).
// CRUD + detección WebUSB + prueba de impresión + apertura de cajón.
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Printer, Usb, Wifi, Bluetooth, ServerCog, TestTube2, Trash2, CheckCircle2, Search } from "lucide-react";
import { toast } from "sonner";
import { EscPosBuilder } from "../lib/escpos";
import { isWebUsbSupported, requestUsbPrinter, printOnceUsb, listAuthorizedUsbPrinters } from "../drivers/webusb";
import { pingAgent, printViaAgent } from "../drivers/agent";
import { isWebBluetoothSupported, requestBluetoothPrinter, printOnceBluetooth } from "../drivers/webbluetooth";

interface PrinterRow {
  id: string;
  organization_id: string;
  name: string;
  model: string | null;
  connection: "usb" | "lan" | "bluetooth" | "agent" | "browser";
  ip_address: string | null;
  port: number | null;
  vendor_id: string | null;
  product_id: string | null;
  paper_width_mm: 48 | 58 | 80;
  characters_per_line: number;
  codepage: string;
  cuts_paper: boolean;
  bluetooth_address?: string | null;
  os_printer_name?: string | null;
  opens_drawer: boolean;
  role: "receipt" | "kitchen" | "bar" | "label" | "any";
  is_default: boolean;
  is_active: boolean;
  status: string;
  last_seen_at: string | null;
}

export function PrintersManagerTab({ organizationId }: { organizationId: string }) {
  const [items, setItems] = useState<PrinterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<PrinterRow> | null>(null);
  const [agentOnline, setAgentOnline] = useState<boolean | null>(null);
  const [blePairings, setBlePairings] = useState<Array<{ address: string; name?: string; pairedAt?: string }> | null>(null);
  const [bleLoading, setBleLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("printers")
      .select("*")
      .eq("organization_id", organizationId)
      .order("created_at", { ascending: true });
    setItems((data ?? []) as PrinterRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); pingAgent().then(setAgentOnline); }, [organizationId]);

  const save = async () => {
    if (!editing?.name || !editing.connection) {
      toast.error("Nombre y tipo de conexión son obligatorios");
      return;
    }
    const payload: any = {
      organization_id: organizationId,
      name: editing.name,
      model: editing.model ?? null,
      connection: editing.connection,
      ip_address: editing.ip_address ?? null,
      port: editing.port ?? 9100,
      vendor_id: editing.vendor_id ?? null,
      product_id: editing.product_id ?? null,
      paper_width_mm: editing.paper_width_mm ?? 80,
      characters_per_line: (editing.paper_width_mm ?? 80) === 58 ? 32 : 48,
      codepage: editing.codepage ?? "CP858",
      cuts_paper: editing.cuts_paper ?? true,
      opens_drawer: editing.opens_drawer ?? false,
      bluetooth_address: editing.bluetooth_address ?? null,
      os_printer_name: editing.os_printer_name ?? null,
      role: editing.role ?? "receipt",
      is_default: editing.is_default ?? false,
      is_active: editing.is_active ?? true,
    };
    if (editing.id) {
      const { error } = await (supabase as any).from("printers").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await (supabase as any).from("printers").insert(payload);
      if (error) return toast.error(error.message);
    }
    toast.success("Impresora guardada");
    setEditing(null);
    load();
  };

  const remove = async (id: string) => {
    if (!window.confirm("¿Eliminar esta impresora?")) return;
    const { error } = await (supabase as any).from("printers").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Eliminada");
    load();
  };

  const detectUsb = async () => {
    try {
      if (!isWebUsbSupported()) throw new Error("Este navegador no soporta WebUSB. Usa Chrome o Edge.");
      const dev = await requestUsbPrinter();
      setEditing({
        connection: "usb",
        name: dev.productName ?? `USB ${dev.vendorId.toString(16)}`,
        model: dev.productName ?? null,
        vendor_id: `0x${dev.vendorId.toString(16).padStart(4, "0")}`,
        product_id: `0x${dev.productId.toString(16).padStart(4, "0")}`,
        paper_width_mm: 80,
        role: "receipt",
      });
      toast.success("Impresora detectada y autorizada");
    } catch (e: any) {
      if (e?.name !== "NotFoundError") toast.error(e?.message ?? "No se pudo detectar");
    }
  };

  const testPrint = async (p: PrinterRow) => {
    try {
      const b = new EscPosBuilder({ width: p.paper_width_mm === 58 ? 32 : 48 });
      b.init().align("center").bold(true).size(2).line("PRUEBA")
        .size(1).bold(false).line("SistecPOS")
        .line(p.name)
        .line(new Date().toLocaleString("es-CO"))
        .separator()
        .align("left").line("¡La impresora funciona!")
        .line("Ñoño niño: tildes áéíóú")
        .feed(2).cut(true);
      const bytes = b.build();

      if (p.connection === "lan" || p.connection === "agent") {
        if (!(await pingAgent())) throw new Error("Agente de impresión local no disponible (puerto 9101)");
        await printViaAgent({
          printer_id: p.id,
          ip_address: p.ip_address,
          port: p.port ?? 9100,
          connection: p.connection === "agent" ? "usb" : "lan",
          escpos_b64: bytesToB64(bytes),
        });
      } else if (p.connection === "usb" || p.connection === "browser") {
        const devs = await listAuthorizedUsbPrinters();
        if (!devs.length) throw new Error("Conecta y autoriza la impresora USB primero");
        await printOnceUsb(devs[0], bytes);
      } else if (p.connection === "bluetooth") {
        if (!isWebBluetoothSupported()) throw new Error("Web Bluetooth no soportado. Usa Chrome o Edge.");
        const dev = await requestBluetoothPrinter();
        await printOnceBluetooth(dev, bytes);
      } else {
        throw new Error(`Conexión no soportada: ${p.connection}`);
      }
      toast.success("Prueba enviada");
    } catch (e: any) {
      toast.error(e?.message ?? "Falló la prueba");
    }
  };

  const openDrawer = async (p: PrinterRow) => {
    try {
      const b = new EscPosBuilder().init().openDrawer(2);
      const devs = await listAuthorizedUsbPrinters();
      if (devs.length) await printOnceUsb(devs[0], b.build());
      else throw new Error("Sin impresora USB autorizada");
      toast.success("Cajón abierto");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo");
    }
  };

  const scanBle = async () => {
    setBleLoading(true);
    try {
      if (!(await pingAgent())) throw new Error("Agente local offline. Inicia el agente para escanear BLE.");
      const r = await fetch("http://127.0.0.1:9101/ble/pairings");
      if (!r.ok) throw new Error(`Agente respondió ${r.status}`);
      const j = await r.json();
      const list = (j?.pairings ?? []) as Array<{ address: string; name?: string; pairedAt?: string }>;
      setBlePairings(list);
      if (!list.length) toast.info("Sin dispositivos BLE pareados. Empareja la impresora desde el SO primero.");
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo consultar BLE");
      setBlePairings([]);
    } finally {
      setBleLoading(false);
    }
  };

  const pickBlePairing = (p: { address: string; name?: string }) => {
    setEditing((cur) => ({
      ...(cur ?? { paper_width_mm: 80, role: "receipt" }),
      connection: "bluetooth",
      bluetooth_address: p.address,
      name: cur?.name || p.name || `BLE ${p.address}`,
      model: cur?.model || p.name || null,
    }));
    setBlePairings(null);
    toast.success("Dispositivo BLE seleccionado");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h3 className="text-lg font-bold">Impresoras térmicas</h3>
          <p className="text-sm text-muted-foreground">Recibos 58/80mm, cocina, cajón monedero, red LAN o USB.</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={agentOnline ? "default" : "secondary"} className="gap-1">
            <ServerCog className="h-3 w-3" />
            Agente local: {agentOnline === null ? "…" : agentOnline ? "ONLINE" : "offline"}
          </Badge>
          <Button variant="outline" onClick={detectUsb}><Usb className="h-4 w-4 mr-1" />Detectar USB</Button>
          <Button onClick={() => setEditing({ paper_width_mm: 80, connection: "usb", role: "receipt" })}>
            <Plus className="h-4 w-4 mr-1" />Nueva
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-muted-foreground">Cargando…</div>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          Aún no hay impresoras. Conecta una vía USB con "Detectar" o agrega una de red.
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map((p) => (
            <Card key={p.id} className="p-4 flex items-start gap-3">
              <div className="rounded-lg bg-muted p-2">
                {p.connection === "usb" ? <Usb className="h-5 w-5" />
                  : p.connection === "lan" ? <Wifi className="h-5 w-5" />
                  : p.connection === "bluetooth" ? <Bluetooth className="h-5 w-5" />
                  : <Printer className="h-5 w-5" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold truncate">{p.name}</span>
                  {p.is_default && <Badge variant="default" className="gap-1"><CheckCircle2 className="h-3 w-3" />Default</Badge>}
                  <Badge variant="outline">{p.paper_width_mm}mm</Badge>
                  <Badge variant="secondary">{p.role}</Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-1 truncate">
                  {p.connection.toUpperCase()}{p.ip_address ? ` · ${p.ip_address}:${p.port}` : ""}
                  {p.vendor_id ? ` · vid=${p.vendor_id}` : ""}
                </div>
                <div className="mt-2 flex gap-1 flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => testPrint(p)}>
                    <TestTube2 className="h-3 w-3 mr-1" />Probar
                  </Button>
                  {p.opens_drawer && (
                    <Button size="sm" variant="outline" onClick={() => openDrawer(p)}>Abrir cajón</Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>Editar</Button>
                  <Button size="sm" variant="ghost" onClick={() => remove(p.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Editor */}
      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Editar impresora" : "Nueva impresora"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <Label>Nombre</Label>
                <Input value={editing.name ?? ""} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="Caja principal" />
              </div>
              <div>
                <Label>Conexión</Label>
                <Select value={editing.connection} onValueChange={(v: any) => setEditing({ ...editing, connection: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="usb">USB (WebUSB)</SelectItem>
                    <SelectItem value="lan">Red LAN (TCP 9100)</SelectItem>
                    <SelectItem value="bluetooth">Bluetooth</SelectItem>
                    <SelectItem value="agent">Agente local (USB nativo)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Rol</Label>
                <Select value={editing.role ?? "receipt"} onValueChange={(v: any) => setEditing({ ...editing, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="receipt">Recibo cliente</SelectItem>
                    <SelectItem value="kitchen">Cocina</SelectItem>
                    <SelectItem value="bar">Bar</SelectItem>
                    <SelectItem value="label">Etiquetas</SelectItem>
                    <SelectItem value="any">Cualquiera</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Ancho papel</Label>
                <Select value={String(editing.paper_width_mm ?? 80)} onValueChange={(v) => setEditing({ ...editing, paper_width_mm: Number(v) as any })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="48">48mm</SelectItem>
                    <SelectItem value="58">58mm</SelectItem>
                    <SelectItem value="80">80mm</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Modelo</Label>
                <Input value={editing.model ?? ""} onChange={(e) => setEditing({ ...editing, model: e.target.value })} placeholder="Xprinter XP-80" />
              </div>
              {(editing.connection === "lan") && (
                <>
                  <div>
                    <Label>IP</Label>
                    <Input value={editing.ip_address ?? ""} onChange={(e) => setEditing({ ...editing, ip_address: e.target.value })} placeholder="192.168.1.50" />
                  </div>
                  <div>
                    <Label>Puerto</Label>
                    <Input type="number" value={editing.port ?? 9100} onChange={(e) => setEditing({ ...editing, port: Number(e.target.value) })} />
                  </div>
                </>
              )}
              <label className="flex items-center gap-2 text-sm col-span-2">
                <input type="checkbox" checked={!!editing.cuts_paper} onChange={(e) => setEditing({ ...editing, cuts_paper: e.target.checked })} />
                Corta papel automáticamente
              </label>
              <label className="flex items-center gap-2 text-sm col-span-2">
                <input type="checkbox" checked={!!editing.opens_drawer} onChange={(e) => setEditing({ ...editing, opens_drawer: e.target.checked })} />
                Tiene cajón monedero conectado
              </label>
              <label className="flex items-center gap-2 text-sm col-span-2">
                <input type="checkbox" checked={!!editing.is_default} onChange={(e) => setEditing({ ...editing, is_default: e.target.checked })} />
                Impresora por defecto para recibos
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
            <Button onClick={save}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function bytesToB64(u8: Uint8Array): string {
  let s = "";
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
}
