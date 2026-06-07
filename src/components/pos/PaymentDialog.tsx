import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Trash2, Plus } from "lucide-react";

const METHODS = [
  { key: "efectivo", label: "Efectivo" },
  { key: "tarjeta_debito", label: "Débito" },
  { key: "tarjeta_credito", label: "Crédito" },
  { key: "transferencia", label: "Transfer." },
  { key: "nequi", label: "Nequi" },
  { key: "daviplata", label: "Daviplata" },
];

interface Pay { method: string; amount: number; reference?: string }

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  total: number;
  onConfirm: (payments: Pay[]) => void;
}

const COP = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

export default function PaymentDialog({ open, onOpenChange, total, onConfirm }: Props) {
  const [payments, setPayments] = useState<Pay[]>([]);

  useEffect(() => {
    if (open) setPayments([{ method: "efectivo", amount: total }]);
  }, [open, total]);

  const sum = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const change = Math.max(0, sum - total);
  const pending = Math.max(0, total - sum);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>Cobrar {COP(total)}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {payments.map((p, i) => {
            const methodId = `pay-method-${i}`;
            const amountId = `pay-amount-${i}`;
            return (
              <div key={i} className="flex gap-2 items-end">
                <div className="flex-1 space-y-1">
                  <Label htmlFor={methodId} className="text-xs">Método</Label>
                  <select
                    id={methodId}
                    className="w-full h-10 rounded-lg border border-input bg-background px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    value={p.method}
                    onChange={(e) => {
                      const c = [...payments]; c[i] = { ...c[i], method: e.target.value }; setPayments(c);
                    }}
                  >
                    {METHODS.map((m) => <option key={m.key} value={m.key}>{m.label}</option>)}
                  </select>
                </div>
                <div className="w-32 space-y-1">
                  <Label htmlFor={amountId} className="text-xs">Monto</Label>
                  <Input
                    id={amountId}
                    type="number" inputMode="numeric" value={p.amount}
                    onChange={(e) => {
                      const c = [...payments]; c[i] = { ...c[i], amount: Number(e.target.value) }; setPayments(c);
                    }}
                  />
                </div>
                {payments.length > 1 && (
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setPayments(payments.filter((_, j) => j !== i))}
                    aria-label={`Eliminar pago ${i + 1}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            );
          })}

          <Button variant="outline" size="sm" onClick={() => setPayments([...payments, { method: "efectivo", amount: pending }])}>
            <Plus className="w-4 h-4 mr-1" /> Dividir pago
          </Button>

          <div className="bg-muted/50 rounded-lg p-3 text-sm space-y-1">
            <div className="flex justify-between"><span>Total</span><span>{COP(total)}</span></div>
            <div className="flex justify-between"><span>Recibido</span><span>{COP(sum)}</span></div>
            {pending > 0 && <div className="flex justify-between text-destructive"><span>Falta</span><span>{COP(pending)}</span></div>}
            {change > 0 && <div className="flex justify-between font-semibold text-primary"><span>Vuelto</span><span>{COP(change)}</span></div>}
          </div>

          <Button
            className="w-full h-11"
            disabled={pending > 0 || payments.some(p => !p.amount)}
            onClick={() => onConfirm(payments.filter(p => p.amount > 0))}
          >
            Confirmar cobro
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
