import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Printer, Plus, Volume2, VolumeX, FileSignature, X,
  CheckCircle2, AlertTriangle, Loader2, RotateCcw,
} from "lucide-react";
import { getPosSoundEnabled, setPosSoundEnabled, playSaleSuccessSound } from "@/lib/posSoundPrefs";
import { getSaleCompleteAutoCloseMs } from "@/lib/posSaleCompletePrefs";
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
  /** Puede devolver Promise; si rechaza, el modal muestra estado de error con "Reintentar". */
  onPrint: () => void | Promise<void>;
  onEmitInvoice: () => void;
  posOrderId?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  isAdmin?: boolean;
  /** Ms para autocerrar tras venta completada / impresión exitosa. Default: prefs. */
  autoCloseMs?: number;
}

// Formato $ 123.456 (COP)
const COP = (n: number) => "$ " + Math.round(n).toLocaleString("es-CO");

type PrintState = "idle" | "printing" | "success" | "error";

/**
 * SaleCompleteDialog — Estilo "caja registradora" con tipografía 7-segmentos.
 * - Cifras XXL (azul total · verde recibido · rojo cambio) legibles a 2 m.
 * - Verificación de impresión: idle → printing → success | error (con retry).
 * - Auto-cierre configurable (default 8s), pausado si hay error de impresión.
 * - Hotkeys: Enter = imprimir (o reintentar) · Esc = cerrar sin imprimir.
 * - Autofocus en el botón SÍ (ref) sin interferir con el numpad (solo captura
 *   Enter/Esc cuando el foco no está en un input/textarea editable).
 */
export default function SaleCompleteDialog({
  open, onOpenChange, total, amountPaid, change, canEmitInvoice,
  onNewSale, onPrint, onEmitInvoice, posOrderId,
  customerEmail, customerPhone, isAdmin = false,
  autoCloseMs,
}: Props) {
  const einvoice = useEinvoiceLiveStatus(open ? posOrderId ?? null : null);
  const [soundOn, setSoundOn] = useState<boolean>(() => getPosSoundEnabled());
  const [printState, setPrintState] = useState<PrintState>("idle");
  const [printError, setPrintError] = useState<string | null>(null);
  const [remainingMs, setRemainingMs] = useState<number | null>(null);
  const yesBtnRef = useRef<HTMLButtonElement>(null);
  const closedRef = useRef(false);

  const closeAndReset = useCallback(() => {
    if (closedRef.current) return;
    closedRef.current = true;
    onOpenChange(false);
    onNewSale();
  }, [onOpenChange, onNewSale]);

  // Reset al abrir
  useEffect(() => {
    if (open) {
      closedRef.current = false;
      setPrintState("idle");
      setPrintError(null);
      playSaleSuccessSound();
      // autofocus estable en SÍ
      const t = setTimeout(() => yesBtnRef.current?.focus(), 60);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Lanza impresión con verificación
  const runPrint = useCallback(async () => {
    setPrintState("printing");
    setPrintError(null);
    try {
      await Promise.resolve(onPrint());
      setPrintState("success");
    } catch (err) {
      setPrintState("error");
      setPrintError(err instanceof Error ? err.message : "No se pudo enviar a la impresora.");
    }
  }, [onPrint]);

  // Auto-cierre — solo en idle (usuario no decidió) o success. Nunca en error.
  useEffect(() => {
    if (!open) return;
    if (printState === "printing" || printState === "error") {
      setRemainingMs(null);
      return;
    }
    const totalMs = autoCloseMs ?? getSaleCompleteAutoCloseMs();
    const start = Date.now();
    setRemainingMs(totalMs);
    const iv = window.setInterval(() => {
      const left = totalMs - (Date.now() - start);
      if (left <= 0) {
        window.clearInterval(iv);
        closeAndReset();
      } else {
        setRemainingMs(left);
      }
    }, 250);
    return () => window.clearInterval(iv);
  }, [open, printState, autoCloseMs, closeAndReset]);

  // Hotkeys globales — captura en fase capture y stopImmediatePropagation para
  // no colisionar con los F-keys del workspace (usePOSHotkeys). Ignora eventos
  // desde campos editables (protege numpad y otros inputs).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      const tag = el?.tagName;
      const editable =
        tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || el?.isContentEditable;
      if (editable) return;

      // Acciones del modal — SitricPOS-style F-keys.
      const isYes = e.key === "Enter" || e.key === "F10" || e.key === "F12";
      const isNo = e.key === "Escape";
      const isPrint = e.key === "F1"; // Imprimir POS (reimprimir)
      const isInvoice = e.key === "F2"; // Facturar DIAN
      const isNewSale = e.key === "F3"; // Nueva venta sin imprimir
      const isEmit = canEmitInvoice && isInvoice;

      if (!(isYes || isNo || isPrint || isEmit || isNewSale)) return;

      e.preventDefault();
      e.stopImmediatePropagation();

      if (isYes) {
        if (printState === "printing") return;
        if (printState === "error") { runPrint(); return; }
        if (printState === "success") { closeAndReset(); return; }
        runPrint().then(closeAndReset).catch(() => { /* queda en error */ });
        return;
      }
      if (isNo) {
        if (printState === "printing") return;
        closeAndReset();
        return;
      }
      if (isPrint) {
        if (printState === "printing") return;
        void runPrint();
        return;
      }
      if (isEmit) {
        onEmitInvoice();
        return;
      }
      if (isNewSale) {
        if (printState === "printing") return;
        closeAndReset();
      }
    };
    // capture=true → corre antes que usePOSHotkeys en window
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, printState, runPrint, closeAndReset, canEmitInvoice, onEmitInvoice]);

  const toggleSound = () => {
    const next = !soundOn;
    setSoundOn(next);
    setPosSoundEnabled(next);
  };

  const handleYes = async () => {
    if (printState === "printing") return;
    if (printState === "error") { runPrint(); return; }
    await runPrint();
    // Si terminó ok, cerrar; si error, permanece abierto para reintentar
    setTimeout(() => {
      setPrintState((s) => {
        if (s === "success") closeAndReset();
        return s;
      });
    }, 0);
  };

  // Cierre controlado: bloquea cierre externo durante "printing"
  const handleOpenChange = (v: boolean) => {
    if (!v && printState === "printing") return;
    if (!v) closeAndReset();
    else onOpenChange(v);
  };

  const secondsLeft = remainingMs != null ? Math.ceil(remainingMs / 1000) : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        className="max-w-[min(92vw,880px)] p-0 gap-0 border-4 border-foreground/10 bg-[#f7f5ee] dark:bg-[#0e1220] overflow-hidden"
        onOpenAutoFocus={(e) => {
          // dejar autofocus manual en el botón SÍ (más predecible)
          e.preventDefault();
          setTimeout(() => yesBtnRef.current?.focus(), 20);
        }}
      >
        {/* Header discreto */}
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
            {secondsLeft != null && printState !== "error" && (
              <span className="ml-2 text-[10px] font-mono text-muted-foreground/70" aria-live="polite">
                cierre auto en {secondsLeft}s
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={toggleSound}
            className="text-muted-foreground hover:text-foreground transition mr-8"
            aria-label={soundOn ? "Silenciar sonido" : "Activar sonido"}
          >
            {soundOn ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </button>
        </div>

        {/* CIFRAS XXL */}
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

          {/* Cambio */}
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

        {/* Estado de impresión */}
        {printState !== "idle" && (
          <div className="px-6 sm:px-10 pb-2" aria-live="polite">
            {printState === "printing" && (
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span>Enviando recibo a la impresora…</span>
              </div>
            )}
            {printState === "success" && (
              <div className="flex items-center gap-2 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
                <span>Recibo enviado correctamente.</span>
              </div>
            )}
            {printState === "error" && (
              <div className="flex items-start gap-2 rounded-md border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm text-red-700 dark:text-red-400">
                <AlertTriangle className="w-4 h-4 mt-0.5" />
                <div className="flex-1">
                  <div className="font-semibold">No se pudo imprimir el recibo</div>
                  <div className="text-xs opacity-90">
                    {printError ?? "Revisa la impresora."} El ticket sigue reservado — puedes reintentar.
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Factura electrónica */}
        {einvoice.status !== "idle" && (
          <div className="px-6 sm:px-10 pb-3">
            <EinvoiceStatusBadge snap={einvoice} className="w-full justify-center" />
          </div>
        )}

        {/* Footer — ¿Imprimir? SÍ / NO */}
        <div className="border-t border-foreground/10 bg-background/60 px-5 sm:px-8 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="text-sm sm:text-base font-heading font-bold uppercase tracking-wider text-foreground/80">
              {printState === "error" ? "Reintentar impresión" : "Imprimir recibo"}
            </div>
            <div className="flex gap-2">
              <Button
                ref={yesBtnRef}
                variant="cta"
                className="h-16 min-w-[120px] text-xl font-heading font-extrabold uppercase tracking-wider gap-2 shadow-md"
                onClick={handleYes}
                disabled={printState === "printing"}
              >
                {printState === "printing" ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : printState === "error" ? (
                  <RotateCcw className="w-5 h-5" />
                ) : (
                  <Printer className="w-5 h-5" />
                )}
                {printState === "error" ? "Reintentar" : "Sí"}
                <span className="ml-1 flex items-center gap-0.5">
                  <kbd className="px-1.5 py-0.5 bg-black/20 rounded text-[10px] font-mono">↵</kbd>
                  <kbd className="px-1.5 py-0.5 bg-black/20 rounded text-[10px] font-mono">F10</kbd>
                </span>
              </Button>
              <Button
                variant="outline"
                className="h-16 min-w-[110px] text-xl font-heading font-extrabold uppercase tracking-wider gap-2 border-2"
                onClick={() => closeAndReset()}
                disabled={printState === "printing"}
              >
                <X className="w-5 h-5" />
                No
                <kbd className="ml-1 px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">Esc</kbd>
              </Button>
            </div>
          </div>

          {/* Acciones secundarias */}
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => closeAndReset()}
              disabled={printState === "printing"}
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
                onReprintPos={() => { void runPrint(); }}
              />
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={onEmitInvoice}
                disabled={!canEmitInvoice || printState === "printing"}
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
