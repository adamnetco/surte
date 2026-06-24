import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Mail, MessageCircle, Eye, RotateCw, Printer, Loader2 } from "lucide-react";
import { useEinvoiceActions } from "../hooks/useEinvoiceActions";
import type { EinvoiceLiveSnapshot } from "../hooks/useEinvoiceLiveStatus";
import InvoicePdfDrawer from "./InvoicePdfDrawer";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

interface Props {
  snap: EinvoiceLiveSnapshot;
  posOrderId?: string | null;
  customerEmail?: string | null;
  customerPhone?: string | null;
  isAdmin?: boolean;
  onReprintPos?: () => void;
}

/**
 * Acciones rápidas sobre el documento DIAN recién emitido.
 * AC7 (Re-imprimir / Email / WhatsApp), AC8 (Ver factura), AC9 (Reintentar) — POS-innapsis-emision-pos.
 */
export default function EinvoiceActions({
  snap, posOrderId, customerEmail, customerPhone, isAdmin = false, onReprintPos,
}: Props) {
  const { run, pending } = useEinvoiceActions();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Cargamos datos completos sólo cuando se abre el drawer (lazy)
  const { data: invoice } = useQuery({
    enabled: drawerOpen && !!snap.invoiceId,
    queryKey: ["invoice-detail", snap.invoiceId],
    queryFn: async () => {
      const { data } = await supabase
        .from("electronic_invoices")
        .select("pdf_url, xml_url, qr_url, cufe, full_number")
        .eq("id", snap.invoiceId!)
        .maybeSingle();
      return data;
    },
  });

  const accepted = snap.status === "accepted";
  const retriable = ["retrying", "dead_letter", "rejected"].includes(snap.status);

  if (snap.status === "idle") return null;

  return (
    <>
      <div className="grid grid-cols-2 gap-2">
        {onReprintPos && (
          <Button variant="outline" size="sm" onClick={onReprintPos}>
            <Printer className="w-4 h-4 mr-1.5" /> Imprimir POS
          </Button>
        )}

        <Button
          variant="outline"
          size="sm"
          disabled={!accepted || !snap.invoiceId}
          onClick={() => setDrawerOpen(true)}
          title={accepted ? "Ver factura DIAN" : "Disponible cuando DIAN acepte"}
        >
          <Eye className="w-4 h-4 mr-1.5" /> Ver factura
        </Button>

        <Button
          variant="outline"
          size="sm"
          disabled={!accepted || !snap.invoiceId || !customerEmail || pending === "send_email"}
          onClick={() => snap.invoiceId && customerEmail && run({
            invoice_id: snap.invoiceId, action: "send_email", to: customerEmail,
          })}
          title={!customerEmail ? "Cliente sin email" : "Enviar PDF por email"}
        >
          {pending === "send_email"
            ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            : <Mail className="w-4 h-4 mr-1.5" />}
          Email
        </Button>

        <Button
          variant="outline"
          size="sm"
          disabled={!accepted || !snap.invoiceId || !customerPhone || pending === "send_whatsapp"}
          onClick={() => snap.invoiceId && customerPhone && run({
            invoice_id: snap.invoiceId, action: "send_whatsapp", to: customerPhone,
          })}
          title={!customerPhone ? "Cliente sin teléfono" : "Enviar por WhatsApp"}
        >
          {pending === "send_whatsapp"
            ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
            : <MessageCircle className="w-4 h-4 mr-1.5" />}
          WhatsApp
        </Button>

        {retriable && isAdmin && (
          <Button
            variant="destructive"
            size="sm"
            className="col-span-2"
            disabled={!snap.invoiceId || pending === "retry_now"}
            onClick={() => snap.invoiceId && run({ invoice_id: snap.invoiceId, action: "retry_now" })}
          >
            {pending === "retry_now"
              ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />
              : <RotateCw className="w-4 h-4 mr-1.5" />}
            Reintentar emisión ahora
          </Button>
        )}
      </div>

      <InvoicePdfDrawer
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
        pdfUrl={invoice?.pdf_url ?? null}
        xmlUrl={invoice?.xml_url ?? null}
        qrUrl={invoice?.qr_url ?? null}
        cufe={invoice?.cufe ?? snap.cufe ?? null}
        fullNumber={invoice?.full_number ?? null}
      />
    </>
  );
}
