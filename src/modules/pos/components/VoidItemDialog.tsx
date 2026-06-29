import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Receipt, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { errorToMessage } from "@/lib/errors";

export type VoidReasonCode =
  | "error_digitacion"
  | "agotado"
  | "cliente_cambio"
  | "mal_preparado"
  | "otro";

const REASONS: { code: VoidReasonCode; label: string; hint: string }[] = [
  { code: "error_digitacion", label: "Error de digitación", hint: "Se digitó mal el producto o la cantidad" },
  { code: "agotado",          label: "Producto agotado",    hint: "No hay existencias para preparar" },
  { code: "cliente_cambio",   label: "Cliente cambió",       hint: "El cliente desistió o cambió su orden" },
  { code: "mal_preparado",    label: "Mal preparado",        hint: "Producto rechazado por calidad" },
  { code: "otro",             label: "Otro motivo",          hint: "Describe el motivo en detalle" },
];

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  item: { id: string; product_name: string; quantity: number; total: number; status: string } | null;
  onVoided: () => void;
}

const COP = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

export default function VoidItemDialog({ open, onOpenChange, item, onVoided }: Props) {
  const [code, setCode] = useState<VoidReasonCode | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const wasSent = item && item.status !== "pending";
  const minChars = code === "otro" ? 10 : 3;
  const canSubmit = !!item && !!code && text.trim().length >= minChars && !busy;

  const reset = () => { setCode(null); setText(""); };

  const submit = async () => {
    if (!item || !code) return;
    setBusy(true);
    try {
      const { data, error } = await (supabase.rpc as any)("pos_void_table_item", {
        _item_id: item.id,
        _reason_code: code,
        _reason_text: text.trim(),
      });
      if (error) throw error;
      const ticket = (data as any)?.ticket;
      const hash = (data as any)?.fiscal_hash as string | undefined;
      toast.success(`Vale de anulación #${ticket} emitido`, {
        description: hash ? `Sello fiscal ${hash.slice(0, 12)}…` : undefined,
        duration: 7000,
      });
      reset();
      onOpenChange(false);
      onVoided();
    } catch (e) {
      toast.error(errorToMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!busy) { if (!v) reset(); onOpenChange(v); } }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            Anular producto
          </DialogTitle>
          <DialogDescription>
            {wasSent
              ? "Este producto ya fue enviado a cocina. Se emitirá un vale fiscal inmutable."
              : "Selecciona el motivo. Se generará un vale fiscal trazable."}
          </DialogDescription>
        </DialogHeader>

        {item && (
          <div className="rounded-lg border bg-muted/40 p-3 text-sm space-y-1">
            <div className="flex justify-between font-medium">
              <span className="line-clamp-1">{item.product_name}</span>
              <span className="tabular-nums">{COP(item.total)}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Cantidad: {item.quantity}</span>
              <span>Estado: {item.status}</span>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label>Motivo · obligatorio</Label>
          <div className="grid grid-cols-1 gap-1.5">
            {REASONS.map((r) => {
              const active = code === r.code;
              return (
                <button
                  key={r.code}
                  type="button"
                  onClick={() => setCode(r.code)}
                  className={`text-left rounded-md border px-3 py-2 text-sm transition ${
                    active
                      ? "border-primary bg-primary/5 ring-1 ring-primary"
                      : "hover:border-primary/40"
                  }`}
                >
                  <div className="font-medium">{r.label}</div>
                  <div className="text-xs text-muted-foreground">{r.hint}</div>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-1">
          <Label>
            Detalle{" "}
            <span className="text-xs text-muted-foreground">
              (mín. {minChars} caracteres)
            </span>
          </Label>
          <Textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            placeholder={code === "otro"
              ? "Describe con claridad qué pasó (auditable)…"
              : "Comentario para el log fiscal"}
            aria-invalid={!!code && text.trim().length < minChars}
          />
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancelar
          </Button>
          <Button
            onClick={submit}
            disabled={!canSubmit}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {busy
              ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Anulando…</>
              : <><Receipt className="w-4 h-4 mr-1" /> Anular y emitir vale</>}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
