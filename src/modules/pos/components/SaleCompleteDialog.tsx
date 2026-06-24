import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Printer, FileSignature, Plus, Volume2, VolumeX } from "lucide-react";
import { getPosSoundEnabled, setPosSoundEnabled, playSaleSuccessSound } from "@/lib/posSoundPrefs";
import { useState } from "react";
import { useEinvoiceLiveStatus } from "../hooks/useEinvoiceLiveStatus";
import EinvoiceStatusBadge from "./EinvoiceStatusBadge";

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
  /** Si se pasa, muestra badge Realtime con el estado DIAN de la factura emitida. */
  posOrderId?: string | null;
}

const COP = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

export default function SaleCompleteDialog({
  open, onOpenChange, total, amountPaid, change, canEmitInvoice,
  onNewSale, onPrint, onEmitInvoice, posOrderId,
}: Props) {
  const einvoice = useEinvoiceLiveStatus(open ? posOrderId ?? null : null);
  const [soundOn, setSoundOn] = useState<boolean>(() => getPosSoundEnabled());

  // Dispara animación + sonido al abrir
  useEffect(() => {
    if (open) playSaleSuccessSound();
  }, [open]);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setPosSoundEnabled(next);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <AnimatePresence>
            {open && (
              <motion.div
                key="check"
                initial={{ scale: 0, rotate: -45, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: "spring", stiffness: 260, damping: 18 }}
                className="mx-auto w-16 h-16 rounded-full bg-emerald-500/15 grid place-items-center mb-2 relative"
              >
                <motion.span
                  initial={{ scale: 0.6, opacity: 0.6 }}
                  animate={{ scale: 1.8, opacity: 0 }}
                  transition={{ duration: 0.9, ease: "easeOut" }}
                  className="absolute inset-0 rounded-full bg-emerald-500/30"
                />
                <CheckCircle2 className="w-9 h-9 text-emerald-600 relative" strokeWidth={2.2} />
              </motion.div>
            )}
          </AnimatePresence>
          <DialogTitle className="text-center text-xl">¡Venta completada!</DialogTitle>
          <DialogDescription className="text-center">
            El ticket se registró correctamente.
          </DialogDescription>
        </DialogHeader>

        <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total</span>
            <span className="tabular-nums font-semibold">{COP(total)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Recibido</span>
            <span className="tabular-nums">{COP(amountPaid)}</span>
          </div>
          {change > 0 && (
            <div className="flex justify-between text-base font-extrabold pt-1 border-t border-border">
              <span>Vuelto</span>
              <span className="text-primary tabular-nums">{COP(change)}</span>
            </div>
          )}
        </div>

        {einvoice.status !== "idle" && (
          <EinvoiceStatusBadge snap={einvoice} className="w-full justify-center" />
        )}

        <div className="space-y-2">
          <Button
            variant="cta"
            className="w-full h-12 text-base"
            onClick={() => { onOpenChange(false); onNewSale(); }}
            autoFocus
          >
            <Plus className="w-5 h-5 mr-2" />
            Nueva venta
            <kbd className="ml-2 px-1.5 py-0.5 bg-black/15 rounded text-[10px] font-mono">Enter</kbd>
          </Button>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" size="sm" onClick={onPrint}>
              <Printer className="w-4 h-4 mr-1.5" /> Imprimir
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={onEmitInvoice}
              disabled={!canEmitInvoice}
              title={canEmitInvoice ? "Emitir factura electrónica DIAN" : "Disponible al sincronizar"}
            >
              <FileSignature className="w-4 h-4 mr-1.5" /> Facturar
            </Button>
          </div>
          <button
            type="button"
            onClick={toggleSound}
            className="w-full text-xs text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5 pt-1"
            aria-label={soundOn ? "Silenciar sonido de venta" : "Activar sonido de venta"}
          >
            {soundOn ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            Sonido {soundOn ? "activado" : "silenciado"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
