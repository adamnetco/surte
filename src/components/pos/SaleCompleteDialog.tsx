import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Printer, FileSignature, Plus } from "lucide-react";

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
}

const COP = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

export default function SaleCompleteDialog({
  open, onOpenChange, total, amountPaid, change, canEmitInvoice,
  onNewSale, onPrint, onEmitInvoice,
}: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="mx-auto w-14 h-14 rounded-full bg-emerald-500/10 grid place-items-center mb-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <DialogTitle className="text-center text-xl">Venta completada</DialogTitle>
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
        </div>
      </DialogContent>
    </Dialog>
  );
}
