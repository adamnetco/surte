// Hook que suscribe el terminal actual a print_jobs vía Realtime y los ejecuta.
// Lee la impresora destino, materializa los bytes (si vienen en escpos_b64 los usa,
// si no los regenera consultando pos_orders + items) y los envía por WebUSB o agente.
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { buildReceipt, buildKitchen, type TicketData } from "../lib/ticketBuilder";
import { buildReceiptForChannel } from "../lib/printWithTemplate";
import type { ReceiptChannel } from "@/modules/admin-cms/lib/receiptLayoutSchema";
import { listAuthorizedUsbPrinters, printOnceUsb } from "../drivers/webusb";
import { pingAgent, printViaAgent, getAgentCapabilities } from "../drivers/agent";
import { isWebBluetoothSupported, requestBluetoothPrinter, printOnceBluetooth } from "../drivers/webbluetooth";
import { toast } from "sonner";

interface UsePrintQueueOpts {
  organizationId: string | null | undefined;
  /** ids de impresoras gestionadas por este terminal. Si undefined, gestiona todas. */
  managedPrinterIds?: string[];
  enabled?: boolean;
}

interface PrintJobRow {
  id: string;
  organization_id: string;
  printer_id: string | null;
  pos_order_id: string | null;
  kind: string;
  copies: number;
  payload: any;
  escpos_b64: string | null;
  status: string;
  attempts: number;
  channel?: string | null;
}

export function usePrintQueue({ organizationId, managedPrinterIds, enabled = true }: UsePrintQueueOpts) {
  const processing = useRef(new Set<string>());

  useEffect(() => {
    if (!enabled || !organizationId) return;

    let cancelled = false;

    const process = async (job: PrintJobRow) => {
      if (processing.current.has(job.id)) return;
      if (job.status !== "queued") return;
      if (managedPrinterIds && job.printer_id && !managedPrinterIds.includes(job.printer_id)) return;
      processing.current.add(job.id);

      try {
        await supabase.from("print_jobs").update({ status: "printing", attempts: job.attempts + 1 }).eq("id", job.id);

        // Cargar config impresora
        const { data: printer } = await supabase
          .from("printers" as any)
          .select("*")
          .eq("id", job.printer_id!)
          .maybeSingle();
        if (!printer) throw new Error("Impresora no configurada");

        // Materializar bytes
        let bytes: Uint8Array;
        if (job.escpos_b64) {
          bytes = b64ToBytes(job.escpos_b64);
        } else {
          bytes = await renderJobFromOrder(job, printer);
        }

        await dispatchToPrinter(printer, bytes);

        await supabase.from("print_jobs").update({ status: "done", processed_at: new Date().toISOString() }).eq("id", job.id);
      } catch (e: any) {
        const failed = job.attempts >= 4;
        await supabase.from("print_jobs").update({
          status: failed ? "failed" : "queued",
          last_error: String(e?.message ?? e).slice(0, 500),
        }).eq("id", job.id);
        if (failed) toast.error(`Impresión fallida: ${e?.message ?? e}`);
      } finally {
        processing.current.delete(job.id);
      }
    };

    // Procesar trabajos pendientes existentes
    (async () => {
      const { data } = await (supabase as any)
        .from("print_jobs")
        .select("*")
        .eq("organization_id", organizationId)
        .eq("status", "queued")
        .order("created_at", { ascending: true })
        .limit(20);
      if (cancelled) return;
      for (const row of (data ?? []) as PrintJobRow[]) await process(row);
    })();

    const channel = supabase
      .channel(`print_jobs_${organizationId}`)
      .on("postgres_changes" as any, {
        event: "INSERT",
        schema: "public",
        table: "print_jobs",
        filter: `organization_id=eq.${organizationId}`,
      }, (payload: any) => {
        process(payload.new as PrintJobRow);
      })
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [enabled, organizationId, JSON.stringify(managedPrinterIds)]);
}

async function renderJobFromOrder(job: PrintJobRow, printer: any): Promise<Uint8Array> {
  if (!job.pos_order_id) throw new Error("Job sin pos_order_id");
  const { data: orderRaw } = await (supabase as any)
    .from("pos_orders")
    .select("*")
    .eq("id", job.pos_order_id)
    .single();
  const order = orderRaw as any;
  const { data: items } = await (supabase as any)
    .from("pos_order_items")
    .select("*")
    .eq("pos_order_id", job.pos_order_id);
  const { data: orgRaw } = await (supabase as any)
    .from("organizations")
    .select("name, legal_name, nit, address, phone")
    .eq("id", order.organization_id)
    .single();
  const org = orgRaw as any;

  const td: TicketData = {
    org: {
      business_name: org?.name ?? "SistecPOS",
      legal_name: org?.legal_name ?? null,
      nit: org?.nit ?? null,
      address: org?.address ?? null,
      phone: org?.phone ?? null,
    },
    ticket_number: order.ticket_number,
    customer_name: order.customer_name,
    customer_phone: order.customer_phone,
    customer_document: order.customer_document,
    sale_mode: order.sale_mode,
    created_at: order.paid_at ?? order.created_at,
    items: (items ?? []).map((it: any) => ({
      name: it.product_name,
      quantity: Number(it.quantity),
      unit_price: Number(it.unit_price),
      total: Number(it.total),
      modifiers: Array.isArray(it.modifiers) ? it.modifiers : [],
      notes: it.notes,
    })),
    subtotal: Number(order.subtotal),
    discount: Number(order.discount),
    tax: Number(order.tax),
    tip: Number(order.tip),
    total: Number(order.total),
    amount_paid: Number(order.amount_paid),
    change_due: Number(order.change_due),
  };

  const mm = printer.paper_width_mm === 58 || printer.paper_width_mm === 48 ? 58 : 80;
  if (job.kind === "kitchen") {
    const stationName = job.payload?.station_name ?? "COCINA";
    return buildKitchen(td, stationName, mm).build();
  }
  // Resolver canal: explícito en print_jobs.channel, o derivado de sale_mode/kind.
  const channel: ReceiptChannel =
    (job.channel as ReceiptChannel) ??
    inferChannel(order.sale_mode, job.kind);
  const { builder } = await buildReceiptForChannel({
    orgId: order.organization_id,
    channel,
    ticket: td,
    paperMm: mm,
  });
  return builder.build();
}

function inferChannel(saleMode: string | null | undefined, kind: string): ReceiptChannel {
  if (kind === "void") return "void";
  const m = (saleMode ?? "").toLowerCase();
  if (m.includes("domic") || m.includes("delivery")) return "delivery";
  if (m.includes("plataforma") || m.includes("platform")) return "platform";
  if (m.includes("mesa") || m.includes("table")) return "table";
  if (m.includes("llevar") || m.includes("takeaway") || m.includes("take")) return "takeaway";
  return "counter";
}

async function dispatchToPrinter(printer: any, bytes: Uint8Array) {
  const caps = await getAgentCapabilities().catch(() => null);
  const agentUp = !!caps;
  const escpos_b64 = bytesToB64(bytes);

  // ---- LAN ----
  if (printer.connection === "lan") {
    if (!agentUp) throw new Error("Agente local no disponible para impresora LAN");
    await printViaAgent({
      printer_id: printer.id,
      connection: "lan",
      ip_address: printer.ip_address,
      port: printer.port,
      escpos_b64,
    });
    return;
  }

  // ---- USB ----
  if (printer.connection === "usb" || printer.connection === "agent" || printer.connection === "browser") {
    // 1) Preferir agente nativo (libusb o spooler RAW) cuando esté disponible.
    if (agentUp && (caps?.usb_native || caps?.usb_spooler)) {
      try {
        await printViaAgent({
          printer_id: printer.id,
          connection: "usb",
          vendor_id: printer.vendor_id,
          product_id: printer.product_id,
          printer_name: printer.os_printer_name ?? printer.name,
          escpos_b64,
        });
        return;
      } catch (e) {
        console.warn("[printing] agente USB falló, intentando WebUSB:", e);
      }
    }
    // 2) Fallback WebUSB directo desde el navegador.
    const devices = await listAuthorizedUsbPrinters();
    if (!devices.length) throw new Error("Conecta y autoriza la impresora USB en Configuración → Impresoras (o instala el agente de SURTÉ YA Desktop para impresión en background).");
    await printOnceUsb(devices[0], bytes);
    return;
  }

  // ---- Bluetooth ----
  if (printer.connection === "bluetooth") {
    // 1) Preferir agente nativo (noble) — sí puede imprimir desde cola en background.
    if (agentUp && caps?.bluetooth) {
      await printViaAgent({
        printer_id: printer.id,
        connection: "bluetooth",
        bluetooth_address: printer.bluetooth_address,
        escpos_b64,
      });
      return;
    }
    // 2) Fallback: requiere gesto del usuario — no podemos imprimir silenciosamente desde Realtime.
    if (!isWebBluetoothSupported()) throw new Error("Bluetooth no soportado: instala SURTÉ YA Desktop para imprimir en background.");
    throw new Error("Sin agente Bluetooth: usa el botón 'Imprimir' en POS (Web Bluetooth requiere gesto del usuario).");
  }

  throw new Error(`Conexión no soportada en este terminal: ${printer.connection}`);
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}
function bytesToB64(u8: Uint8Array): string {
  let s = "";
  for (let i = 0; i < u8.length; i++) s += String.fromCharCode(u8[i]);
  return btoa(s);
}
