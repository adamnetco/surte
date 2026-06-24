import { useMemo, useRef, useState } from "react";
import { Copy, Download, MessageCircle, Check, Share2 } from "lucide-react";
import { toPng } from "html-to-image";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/**
 * Ola 4 — Slice 2: Resumen del día compartible.
 * Genera snapshot en texto plano (WhatsApp-safe) y PNG descargable.
 * Sigue regla del proyecto: plain text, sin emojis para evitar issues de encoding.
 */

export type DailySnapshot = {
  ordersToday: number;
  revenueToday: number;
  pendingCount: number;
  einvoiceErrors: number;
  syncErrors: number;
  lowStockCount: number;
  lowStockSample: Array<{ id: string; name: string; stock: number }>;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: DailySnapshot | null;
  orgName: string;
  userName?: string;
  checklistDone: number;
  checklistTotal: number;
}

const COP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
});

function buildSummary(
  data: DailySnapshot,
  orgName: string,
  userName: string | undefined,
  checklistDone: number,
  checklistTotal: number,
) {
  const date = new Date().toLocaleDateString("es-CO", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const lines: string[] = [];
  lines.push(`Resumen del dia - ${orgName}`);
  lines.push(date);
  if (userName) lines.push(`Reportado por: ${userName}`);
  lines.push("");
  lines.push("--- Ventas ---");
  lines.push(`- Total facturado: ${COP.format(data.revenueToday)}`);
  lines.push(`- Pedidos del dia: ${data.ordersToday}`);
  lines.push(`- Pedidos pendientes: ${data.pendingCount}`);
  lines.push("");
  lines.push("--- Alertas operativas ---");
  lines.push(`- Errores facturacion DIAN (24h): ${data.einvoiceErrors}`);
  lines.push(`- Errores sincronizacion (24h): ${data.syncErrors}`);
  lines.push(`- Productos con bajo stock: ${data.lowStockCount}`);

  if (data.lowStockSample.length > 0) {
    lines.push("");
    lines.push("Top stock critico:");
    data.lowStockSample.slice(0, 5).forEach((p) => {
      lines.push(`  - ${p.name}: ${p.stock} unid.`);
    });
  }

  lines.push("");
  lines.push("--- Checklist del dia ---");
  lines.push(`- Progreso: ${checklistDone}/${checklistTotal}`);

  lines.push("");
  lines.push("Generado desde SistecPOS - Daily Driver");

  return lines.join("\n");
}

export default function DiarioShareDialog({
  open,
  onOpenChange,
  data,
  orgName,
  userName,
  checklistDone,
  checklistTotal,
}: Props) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const initialText = useMemo(() => {
    if (!data) return "";
    return buildSummary(data, orgName, userName, checklistDone, checklistTotal);
  }, [data, orgName, userName, checklistDone, checklistTotal]);

  const [text, setText] = useState(initialText);

  // Sync cuando cambian los datos
  useMemo(() => {
    setText(initialText);
  }, [initialText]);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success("Resumen copiado");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("No se pudo copiar");
    }
  };

  const onWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const onDownloadPng = async () => {
    if (!cardRef.current) return;
    setDownloading(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        backgroundColor: "#ffffff",
        pixelRatio: 2,
        cacheBust: true,
      });
      const link = document.createElement("a");
      link.download = `resumen-${new Date().toISOString().slice(0, 10)}.png`;
      link.href = dataUrl;
      link.click();
      toast.success("PNG descargado");
    } catch (e: any) {
      toast.error("No se pudo generar la imagen", { description: e?.message });
    } finally {
      setDownloading(false);
    }
  };

  const onNativeShare = async () => {
    if (!navigator.share) {
      onCopy();
      return;
    }
    try {
      await navigator.share({
        title: `Resumen del día - ${orgName}`,
        text,
      });
    } catch {
      // user cancelled, no-op
    }
  };

  const canShare = typeof navigator !== "undefined" && !!(navigator as any).share;

  if (!data) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Share2 size={18} className="text-primary" />
            Compartir resumen del día
          </DialogTitle>
          <DialogDescription>
            Comparte el snapshot del día por WhatsApp, copia el texto o descarga una imagen PNG.
          </DialogDescription>
        </DialogHeader>

        {/* Tarjeta visual (fuente del PNG) */}
        <div
          ref={cardRef}
          className="bg-white text-gray-900 p-6 rounded-xl border border-gray-200 space-y-3"
          style={{ fontFamily: "Inter, system-ui, sans-serif" }}
        >
          <div className="flex items-start justify-between gap-3 border-b border-gray-100 pb-3">
            <div>
              <h2 className="text-lg font-bold">Resumen del día</h2>
              <p className="text-xs text-gray-500">{orgName}</p>
              <p className="text-xs text-gray-400">
                {new Date().toLocaleDateString("es-CO", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[10px] uppercase tracking-wide text-gray-400">Ventas hoy</p>
              <p className="text-xl font-bold tabular-nums text-emerald-600">
                {COP.format(data.revenueToday)}
              </p>
              <p className="text-[11px] text-gray-500">{data.ordersToday} pedido(s)</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-gray-50 rounded-lg p-2">
              <p className="text-[10px] uppercase text-gray-500">Pendientes</p>
              <p className="text-base font-bold tabular-nums">{data.pendingCount}</p>
            </div>
            <div className="bg-red-50 rounded-lg p-2">
              <p className="text-[10px] uppercase text-red-600">Errores DIAN</p>
              <p className="text-base font-bold tabular-nums text-red-700">{data.einvoiceErrors}</p>
            </div>
            <div className="bg-amber-50 rounded-lg p-2">
              <p className="text-[10px] uppercase text-amber-700">Bajo stock</p>
              <p className="text-base font-bold tabular-nums text-amber-700">{data.lowStockCount}</p>
            </div>
          </div>

          {data.lowStockSample.length > 0 && (
            <div className="border-t border-gray-100 pt-2">
              <p className="text-[11px] font-semibold text-gray-600 mb-1">Stock crítico</p>
              <ul className="text-xs text-gray-700 space-y-0.5">
                {data.lowStockSample.slice(0, 5).map((p) => (
                  <li key={p.id} className="flex justify-between gap-2">
                    <span className="truncate">{p.name}</span>
                    <span className="tabular-nums text-gray-500 shrink-0">{p.stock} u.</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="border-t border-gray-100 pt-2 flex items-center justify-between">
            <p className="text-[11px] text-gray-500">Checklist del día</p>
            <p className="text-xs font-semibold tabular-nums">
              {checklistDone}/{checklistTotal}
            </p>
          </div>

          <p className="text-[10px] text-gray-400 text-center pt-1">
            Generado desde SistecPOS · Daily Driver
          </p>
        </div>

        {/* Texto editable */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-muted-foreground">
            Texto para WhatsApp (editable)
          </label>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            className="font-mono text-xs"
          />
        </div>

        <DialogFooter className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <Button variant="outline" onClick={onCopy}>
            {copied ? <Check size={14} className="mr-1" /> : <Copy size={14} className="mr-1" />}
            Copiar
          </Button>
          <Button variant="outline" onClick={onDownloadPng} disabled={downloading}>
            <Download size={14} className="mr-1" />
            {downloading ? "Generando…" : "PNG"}
          </Button>
          {canShare && (
            <Button variant="outline" onClick={onNativeShare}>
              <Share2 size={14} className="mr-1" />
              Compartir
            </Button>
          )}
          <Button onClick={onWhatsApp} className={canShare ? "" : "sm:col-span-2"}>
            <MessageCircle size={14} className="mr-1" />
            WhatsApp
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
