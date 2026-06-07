// Vista previa HTML del ticket (58/80mm) con botón "Imprimir" como fallback
// universal vía window.print(). Incluye también compartir por WhatsApp
// y descargar como PNG (inspirado en el flujo de On Taz Stock).
import { useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Share2, Download, Loader2 } from "lucide-react";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import type { TicketData } from "../lib/ticketBuilder";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  data: TicketData | null;
  paperMm?: 58 | 80;
  kind?: "receipt" | "kitchen";
  stationName?: string;
}

const COP = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
const m = (n: number) => COP.format(n).replace("COP", "$").trim();

export function TicketPreviewDialog({ open, onOpenChange, data, paperMm = 80, kind = "receipt", stationName }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const widthMm = paperMm;
  const storeUrl = typeof window !== "undefined" ? window.location.origin : "";
  const [busy, setBusy] = useState<"png" | "share" | null>(null);

  const captureBlob = async (): Promise<Blob | null> => {
    const node = ref.current;
    if (!node) return null;
    const dataUrl = await toPng(node, { pixelRatio: 2, backgroundColor: "#ffffff", cacheBust: true });
    const res = await fetch(dataUrl);
    return await res.blob();
  };

  const filename = () => {
    const n = data?.ticket_number ?? Date.now();
    return `ticket-${n}.png`;
  };

  const handleDownload = async () => {
    try {
      setBusy("png");
      const blob = await captureBlob();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = filename(); a.click();
      URL.revokeObjectURL(url);
      toast.success("Imagen descargada");
    } catch (e: any) {
      toast.error("No se pudo generar la imagen");
    } finally { setBusy(null); }
  };

  const buildShareText = () => {
    if (!data) return "";
    const total = m(data.total);
    const num = data.ticket_number ? `Ticket #${data.ticket_number}\n` : "";
    return [
      `${data.org.business_name}`,
      num + `Total: ${total}`,
      "",
      "Gracias por tu compra.",
      `Haz tu próximo pedido aquí: ${storeUrl}`,
    ].join("\n");
  };

  const handleShareWhatsApp = async () => {
    try {
      setBusy("share");
      const text = buildShareText();
      const blob = await captureBlob();
      const nav: any = navigator;
      if (blob && nav.canShare && nav.canShare({ files: [new File([blob], filename(), { type: "image/png" })] })) {
        const file = new File([blob], filename(), { type: "image/png" });
        await nav.share({ files: [file], text, title: "Ticket de venta" });
      } else {
        // Fallback: descarga PNG + abre WhatsApp con texto
        if (blob) {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url; a.download = filename(); a.click();
          URL.revokeObjectURL(url);
        }
        const wa = `https://wa.me/?text=${encodeURIComponent(text)}`;
        window.open(wa, "_blank", "noopener,noreferrer");
        toast.info("Imagen lista. Adjúntala en WhatsApp.");
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") toast.error("No se pudo compartir");
    } finally { setBusy(null); }
  };

  const handlePrint = () => {
    const node = ref.current;
    if (!node) return;
    const w = window.open("", "_blank", "width=420,height=720");
    if (!w) return;
    w.document.write(`<html><head><title>Ticket</title>
<style>
  @page { size: ${widthMm}mm auto; margin: 0; }
  body { margin: 0; font-family: 'Courier New', monospace; font-size: 11px; width: ${widthMm}mm; }
  .ticket { padding: 4mm 3mm; }
  .center { text-align: center; }
  .bold { font-weight: 700; }
  .big { font-size: 16px; font-weight: 700; }
  .row { display: flex; justify-content: space-between; gap: 8px; }
  hr { border: none; border-top: 1px dashed #000; margin: 4px 0; }
  .item { margin: 2px 0; }
  .mod { padding-left: 12px; font-size: 10px; }
</style></head><body><div class="ticket">${node.innerHTML}</div>
<script>window.onload=()=>{window.print();setTimeout(()=>window.close(),300)}</script>
</body></html>`);
    w.document.close();
  };

  useEffect(() => { if (!open) return; }, [open]);

  const content = useMemo(() => {
    if (!data) return null;
    if (kind === "kitchen") {
      return (
        <>
          <div className="center big">{(stationName ?? "COCINA").toUpperCase()}</div>
          <hr />
          {data.ticket_number != null && <div className="big">Ticket #{data.ticket_number}</div>}
          <div>{new Date(data.created_at).toLocaleString("es-CO")}</div>
          {data.sale_mode && <div>Modo: {data.sale_mode}</div>}
          {data.customer_name && <div>Cliente: {data.customer_name}</div>}
          <hr />
          {data.items.map((it, i) => (
            <div key={i} className="item">
              <div className="bold">{it.quantity} x {it.name}</div>
              {it.modifiers?.map((m, j) => <div key={j} className="mod">+ {m.name}</div>)}
              {it.notes && <div className="mod">* {it.notes}</div>}
            </div>
          ))}
        </>
      );
    }
    return (
      <>
        <div className="center bold big">{data.org.business_name}</div>
        {data.org.legal_name && <div className="center">{data.org.legal_name}</div>}
        {data.org.nit && <div className="center">NIT {data.org.nit}</div>}
        {data.org.address && <div className="center">{data.org.address}</div>}
        {data.org.phone && <div className="center">Tel: {data.org.phone}</div>}
        <hr />
        {data.ticket_number != null && <div>Ticket #{data.ticket_number}</div>}
        <div>Fecha: {new Date(data.created_at).toLocaleString("es-CO")}</div>
        {data.cashier_name && <div>Cajero: {data.cashier_name}</div>}
        {data.customer_name && <div>Cliente: {data.customer_name}</div>}
        <hr />
        {data.items.map((it, i) => (
          <div key={i} className="item">
            <div className="row"><span>{it.quantity} x {it.name}</span><span>{m(it.total)}</span></div>
            {it.modifiers?.map((mod, j) => <div key={j} className="mod">+ {mod.name}</div>)}
            {it.notes && <div className="mod">* {it.notes}</div>}
          </div>
        ))}
        <hr />
        <div className="row"><span>Subtotal</span><span>{m(data.subtotal)}</span></div>
        {data.discount > 0 && <div className="row"><span>Descuento</span><span>-{m(data.discount)}</span></div>}
        {data.tax > 0 && <div className="row"><span>IVA</span><span>{m(data.tax)}</span></div>}
        {data.tip > 0 && <div className="row"><span>Propina</span><span>{m(data.tip)}</span></div>}
        <div className="row big"><span>TOTAL</span><span>{m(data.total)}</span></div>
        <hr />
        {data.payments?.map((p, i) => <div key={i} className="row"><span>{p.method.toUpperCase()}</span><span>{m(p.amount)}</span></div>)}
        {data.amount_paid > 0 && <div className="row"><span>Recibido</span><span>{m(data.amount_paid)}</span></div>}
        {data.change_due > 0 && <div className="row"><span>Cambio</span><span>{m(data.change_due)}</span></div>}
        <hr />
        <div className="center">{data.org.footer ?? "Gracias por su compra"}</div>
        {storeUrl && <div className="center bold">Pide en línea: {storeUrl.replace(/^https?:\/\//, "")}</div>}
        <div className="center">Powered by SistecPOS</div>
      </>
    );
  }, [data, kind, stationName]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Vista previa · {paperMm}mm</DialogTitle>
        </DialogHeader>
        <div className="border rounded-md p-3 bg-white max-h-[60vh] overflow-y-auto">
          <div
            ref={ref}
            style={{ width: `${widthMm}mm`, fontFamily: "'Courier New', monospace", fontSize: 11 }}
            className="mx-auto"
          >
            <style>{`.center{text-align:center}.bold{font-weight:700}.big{font-size:16px;font-weight:700}.row{display:flex;justify-content:space-between;gap:8px}hr{border:none;border-top:1px dashed #000;margin:4px 0}.item{margin:2px 0}.mod{padding-left:12px;font-size:10px}`}</style>
            {content}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cerrar</Button>
          <Button onClick={handlePrint}><Printer className="h-4 w-4 mr-1" /> Imprimir</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
