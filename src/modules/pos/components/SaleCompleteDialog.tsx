import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, Plus, Volume2, VolumeX, FileSignature, X } from "lucide-react";
import { getPosSoundEnabled, setPosSoundEnabled, playSaleSuccessSound } from "@/lib/posSoundPrefs";
import { useEinvoiceLiveStatus } from "../hooks/useEinvoiceLiveStatus";
import EinvoiceStatusBadge from "./EinvoiceStatusBadge";
import EinvoiceActions from "./EinvoiceActions";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  total: number;
  amountPaid: number;
  change: number;
  canEmitInvoice: boolean;
  onNewSale: () => void;
  onPrint: () => void;
  onEmitInvoice: () => void;
  posOrderId?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  isAdmin?: boolean;
}

// Formato $ 123.456 (COP)
const COP = (n: number) => "$ " + Math.round(n).toLocaleString("es-CO");

/**
 * SaleCompleteDialog — Estilo "caja registradora" con tipografía 7-segmentos.
 * Inspirado en POS colombianos tradicionales (VectorPOS, SitricPOS): 3 cifras
 * XXL leíbles a 2 metros, colores semánticos (azul = total, verde = recibido,
 * rojo = cambio a devolver). Hotkeys: Enter = Imprimir SÍ · Esc = NO.
 */
export default function SaleCompleteDialog({
  open, onOpenChange, total, amountPaid, change, canEmitInvoice,
  onNewSale, onPrint, onEmitInvoice, posOrderId,
  customerEmail, customerPhone, isAdmin = false,
}: Props) {
  const einvoice = useEinvoiceLiveStatus(open ? posOrderId ?? null : null);
  const [soundOn, setSoundOn] = useState<boolean>(() => getPosSoundEnabled());

  useEffect(() => {
    if (open) playSaleSuccessSound();
  }, [open]);

  // Hotkeys: Enter imprime + nueva venta · Esc solo nueva venta.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onPrint();
        onOpenChange(false);
        onNewSale();
      } else if (e.key === "Escape") {
        e.preventDefault();
        onOpenChange(false);
        onNewSale();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onPrint, onNewSale, onOpenChange]);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setPosSoundEnabled(next);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-[min(92vw,880px)] p-0 gap-0 border-4 border-foreground/10 bg-[#f7f5ee] dark:bg-[#0e1220] overflow-hidden"
        hideCloseButton
      >
        {/* Header discreto — el protagonista son las cifras */}
        <div className="flex items-center justify-between px-5 py-2.5 border-b border-foreground/10 bg-background/60">
          <div className="flex items-center gap-2">
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 320, damping: 18 }}
              className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 shadow-[0_0_8px_hsl(142_71%_45%)]"
              aria-hidden
            />
            <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
              Venta completada
            </span>
          </div>
          <button
            type="button"
            onClick={toggleSound}
            className="text-muted-foreground hover:text-foreground transition"
            aria-label={soundOn ? "Silenciar sonido" : "Activar sonido"}
          >
            {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>

        {/* CIFRAS XXL — 7-segmentos, estilo caja registradora */}
        <div className="px-6 sm:px-10 py-6 sm:py-8 space-y-5">
          {/* Total */}
          <AnimatePresence>
            {open && (
              <motion.div
                key="total"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
              >
                <div className="text-[11px] sm:text-xs font-heading font-bold uppercase tracking-[0.22em] text-foreground/70 mb-0.5">
                  Valor Total Venta
                </div>
                <div
                  className="font-seg7 tabular-nums text-primary leading-none text-[clamp(3rem,9vw,6.5rem)] drop-shadow-[0_1px_0_rgba(0,0,0,0.05)]"
                  aria-label={`Total: ${COP(total)}`}
                >
                  {COP(total)}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Recibido */}
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="pl-4 sm:pl-8"
          >
            <div className="text-[11px] sm:text-xs font-heading font-bold uppercase tracking-[0.22em] text-foreground/70 mb-0.5">
              Valor Recibido
            </div>
            <div
              className="font-seg7 tabular-nums text-emerald-600 leading-none text-[clamp(2.2rem,7vw,5rem)]"
              aria-label={`Recibido: ${COP(amountPaid)}`}
            >
              {COP(amountPaid)}
            </div>
          </motion.div>

          {/* Cambio — el dato crítico para el cajero */}
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.32 }}
            className={change > 0 ? "" : "opacity-50"}
          >
            <div className="text-[11px] sm:text-xs font-heading font-bold uppercase tracking-[0.22em] text-foreground/70 mb-0.5">
              Cambio
            </div>
            <div
              className={`font-seg7 tabular-nums leading-none text-[clamp(3rem,9vw,6.5rem)] ${
                change > 0 ? "text-red-600 dark:text-red-500" : "text-muted-foreground/60"
              }`}
              aria-label={`Cambio: ${COP(change)}`}
            >
              {COP(change)}
            </div>
          </motion.div>
        </div>

        {/* Estado factura electrónica (compacto) */}
        {einvoice.status !== "idle" && (
          <div className="px-6 sm:px-10 pb-3">
            <EinvoiceStatusBadge snap={einvoice} className="w-full justify-center" />
          </div>
        )}

        {/* Footer XXL — ¿Imprimir? SÍ / NO estilo caja */}
        <div className="border-t border-foreground/10 bg-background/60 px-5 sm:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm sm:text-base font-heading font-bold uppercase tracking-wider text-foreground/80">
              Imprimir recibo
            </div>
            <div className="flex gap-2">
              <Button
                variant="cta"
                className="h-16 min-w-[110px] text-xl font-heading font-extrabold uppercase tracking-wider gap-2 shadow-md"
                onClick={() => { onPrint(); onOpenChange(false); onNewSale(); }}
                autoFocus
              >
                <Printer className="w-5 h-5" />
                Sí
                <kbd className="ml-1 px-1.5 py-0.5 bg-black/20 rounded text-[10px] font-mono">↵</kbd>
              </Button>
              <Button
                variant="outline"
                className="h-16 min-w-[110px] text-xl font-heading font-extrabold uppercase tracking-wider gap-2 border-2"
                onClick={() => { onOpenChange(false); onNewSale(); }}
              >
                <X className="w-5 h-5" />
                No
                <kbd className="ml-1 px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Esc</kbd>
              </Button>
            </div>
          </div>

          {/* Acciones secundarias — nueva venta / factura electrónica */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => { onOpenChange(false); onNewSale(); }}
              className="h-10 font-heading font-semibold"
            >
              <Plus className="w-4 h-4 mr-1.5" /> Nueva venta
            </Button>
            {einvoice.status !== "idle" ? (
              <EinvoiceActions
                snap={einvoice}
                posOrderId={posOrderId}
                customerEmail={customerEmail}
                customerPhone={customerPhone}
                isAdmin={isAdmin}
                onReprintPos={onPrint}
              />
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={onEmitInvoice}
                disabled={!canEmitInvoice}
                className="h-10 font-heading font-semibold"
                title={canEmitInvoice ? "Emitir factura electrónica DIAN" : "Disponible al sincronizar"}
              >
                <FileSignature className="w-4 h-4 mr-1.5" /> Facturar DIAN
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
