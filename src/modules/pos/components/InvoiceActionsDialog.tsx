import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { FileText, FileSignature, Pause, Loader2 } from "lucide-react";

interface TicketLine {
  productId: string; name: string; unitPrice: number; quantity: number; total: number;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  mode: "emit" | "quote" | "park";
  organizationId: string;
  locationId: string;
  cashSessionId: string;
  userId: string;
  ticket: TicketLine[];
  subtotal: number;
  total: number;
  posOrderId?: string;
  onDone: () => void;
}

export default function InvoiceActionsDialog({
  open, onOpenChange, mode, organizationId, locationId, cashSessionId, userId,
  ticket, subtotal, total, posOrderId, onDone,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [customerName, setCustomerName] = useState("");
  const [customerDoc, setCustomerDoc] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [validDays, setValidDays] = useState(15);

  const handleEmit = async () => {
    if (!posOrderId) return toast.error("Falta el ID de la orden");
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("innapsis-emit", {
      body: { organization_id: organizationId, pos_order_id: posOrderId, document_type: "invoice" },
    });
    setLoading(false);
    if (error || !data?.success) {
      toast.error(data?.error || error?.message || "Error al emitir");
      return;
    }
    toast.success(`Factura enviada · ${data.track_id?.slice(0, 8)}`);
    onDone(); onOpenChange(false);
  };

  const handleQuote = async () => {
    setLoading(true);
    const itemsJson = ticket.map(l => ({
      product_id: l.productId, name: l.name, quantity: l.quantity,
      unit_price: l.unitPrice, total: l.total,
    }));
    const validUntil = new Date();
    validUntil.setDate(validUntil.getDate() + validDays);
    const { error } = await supabase.from("pos_quotes").insert({
      organization_id: organizationId,
      location_id: locationId,
      customer_name: customerName || null,
      customer_phone: customerPhone || null,
      customer_email: customerEmail || null,
      items: itemsJson,
      subtotal, total,
      notes: notes || null,
      valid_until: validUntil.toISOString().slice(0, 10),
      created_by: userId,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Cotización guardada");
    onDone(); onOpenChange(false);
  };

  const handlePark = async () => {
    setLoading(true);
    const itemsJson = ticket.map(l => ({
      product_id: l.productId, name: l.name, quantity: l.quantity,
      unit_price: l.unitPrice, total: l.total,
    }));
    const { error } = await supabase.from("parked_tickets").insert({
      organization_id: organizationId,
      location_id: locationId,
      cash_session_id: cashSessionId,
      cashier_id: userId,
      label: customerName || `Ticket ${new Date().toLocaleTimeString("es-CO")}`,
      customer_name: customerName || null,
      items: itemsJson,
      subtotal, total,
      notes: notes || null,
    });
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Ticket suspendido");
    onDone(); onOpenChange(false);
  };

  const COP = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

  const title = mode === "emit" ? "Emitir factura electrónica DIAN"
    : mode === "quote" ? "Crear cotización" : "Suspender ticket";
  const Icon = mode === "emit" ? FileSignature : mode === "quote" ? FileText : Pause;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="w-5 h-5 text-primary" /> {title}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="bg-muted/40 rounded-lg p-3 text-sm flex justify-between">
            <span>{ticket.length} ítems</span>
            <span className="font-semibold">{COP(total)}</span>
          </div>

          {mode === "emit" && (
            <p className="text-xs text-muted-foreground">
              Se enviará a Innapsis usando la configuración activa. Si el cliente no requiere factura electrónica, se emitirá como Consumidor Final.
            </p>
          )}

          {(mode === "emit" || mode === "quote") && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Nombre cliente</Label>
                  <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="Consumidor final" /></div>
                <div><Label className="text-xs">NIT / Cédula</Label>
                  <Input value={customerDoc} onChange={(e) => setCustomerDoc(e.target.value)} placeholder="222222222222" /></div>
                <div><Label className="text-xs">Email</Label>
                  <Input type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} /></div>
                <div><Label className="text-xs">Teléfono</Label>
                  <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} /></div>
              </div>
            </>
          )}

          {mode === "quote" && (
            <div><Label className="text-xs">Validez (días)</Label>
              <Input type="number" value={validDays} onChange={(e) => setValidDays(Number(e.target.value))} /></div>
          )}

          {(mode === "quote" || mode === "park") && (
            <div><Label className="text-xs">Notas</Label>
              <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
          )}

          <Button
            className="w-full h-11"
            disabled={loading || ticket.length === 0}
            onClick={mode === "emit" ? handleEmit : mode === "quote" ? handleQuote : handlePark}
          >
            {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {mode === "emit" ? "Emitir ahora" : mode === "quote" ? "Guardar cotización" : "Suspender"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
