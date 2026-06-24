import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { FileMinus, FilePlus } from "lucide-react";

type DocType = "credit_note" | "debit_note";

interface Invoice {
  id: string;
  full_number: string | null;
  document_type: string;
  pos_order_id?: string | null;
  order_id?: string | null;
  total: number;
  customer_name: string | null;
  cufe?: string | null;
}

interface Props {
  invoice: Invoice | null;
  open: boolean;
  onClose: () => void;
  onEmitted?: () => void;
  organizationId: string;
}

// DIAN motivos
const NC_CONCEPTS = [
  { code: "1", label: "Devolución parcial" },
  { code: "2", label: "Anulación de factura" },
  { code: "3", label: "Rebaja o descuento parcial/total" },
  { code: "4", label: "Ajuste de precio" },
  { code: "5", label: "Rescisión" },
  { code: "6", label: "Otros" },
];
const ND_CONCEPTS = [
  { code: "1", label: "Intereses" },
  { code: "2", label: "Gastos por cobrar" },
  { code: "3", label: "Cambio del valor" },
  { code: "4", label: "Otros" },
];

export default function EmitNoteDialog({ invoice, open, onClose, onEmitted, organizationId }: Props) {
  const [docType, setDocType] = useState<DocType>("credit_note");
  const [conceptCode, setConceptCode] = useState<string>("2");
  const [conceptText, setConceptText] = useState<string>("");
  const [loading, setLoading] = useState(false);

  if (!invoice) return null;

  const concepts = docType === "credit_note" ? NC_CONCEPTS : ND_CONCEPTS;
  const isNote = invoice.document_type === "credit_note" || invoice.document_type === "debit_note";

  const handleEmit = async () => {
    if (isNote) {
      toast({ title: "No permitido", description: "No se puede emitir una nota sobre otra nota.", variant: "destructive" });
      return;
    }
    setLoading(true);
    const concept = concepts.find((c) => c.code === conceptCode);
    const { data, error } = await supabase.functions.invoke("innapsis-emit", {
      body: {
        organization_id: organizationId,
        pos_order_id: invoice.pos_order_id ?? undefined,
        order_id: invoice.order_id ?? undefined,
        document_type: docType,
        reference_invoice_id: invoice.id,
        note_concept_code: conceptCode,
        note_concept_text: conceptText.trim() || concept?.label || "",
      },
    });
    setLoading(false);
    if (error) {
      toast({ title: "Error al emitir nota", description: error.message, variant: "destructive" });
      return;
    }
    toast({
      title: docType === "credit_note" ? "Nota crédito emitida" : "Nota débito emitida",
      description: (data as any)?.invoice_id ? `ID ${(data as any).invoice_id.slice(0, 8)}…` : "Enviada a Innapsis",
    });
    onEmitted?.();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {docType === "credit_note" ? <FileMinus className="h-5 w-5" /> : <FilePlus className="h-5 w-5" />}
            Emitir nota sobre {invoice.full_number ?? "—"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="text-sm text-muted-foreground rounded-md border p-3 bg-muted/30">
            <div><span className="font-medium">Cliente:</span> {invoice.customer_name ?? "Consumidor Final"}</div>
            <div><span className="font-medium">Total original:</span> ${invoice.total.toLocaleString("es-CO")}</div>
            {invoice.cufe && <div className="break-all text-xs"><span className="font-medium">CUFE:</span> {invoice.cufe.slice(0, 40)}…</div>}
            {isNote && <Badge variant="destructive" className="mt-2">No es posible emitir notas sobre notas.</Badge>}
          </div>

          <div>
            <Label>Tipo de nota</Label>
            <div className="flex gap-2 mt-1">
              <Button
                type="button"
                variant={docType === "credit_note" ? "default" : "outline"}
                size="sm"
                onClick={() => { setDocType("credit_note"); setConceptCode("2"); }}
              >
                Crédito (NC)
              </Button>
              <Button
                type="button"
                variant={docType === "debit_note" ? "default" : "outline"}
                size="sm"
                onClick={() => { setDocType("debit_note"); setConceptCode("4"); }}
              >
                Débito (ND)
              </Button>
            </div>
          </div>

          <div>
            <Label>Motivo DIAN</Label>
            <Select value={conceptCode} onValueChange={setConceptCode}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {concepts.map((c) => (
                  <SelectItem key={c.code} value={c.code}>
                    {c.code} — {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label>Descripción (opcional)</Label>
            <Input
              value={conceptText}
              onChange={(e) => setConceptText(e.target.value)}
              placeholder="Detalle interno / nota al cliente"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Si lo dejas vacío, se enviará el texto estándar del motivo.
            </p>
          </div>

          <p className="text-xs text-muted-foreground">
            La nota se emite por el <strong>total de la orden original</strong>. Para notas parciales, ajusta los ítems desde el POS antes de emitir.
          </p>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button onClick={handleEmit} disabled={loading || isNote}>
            {loading ? "Emitiendo…" : `Emitir ${docType === "credit_note" ? "NC" : "ND"}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
