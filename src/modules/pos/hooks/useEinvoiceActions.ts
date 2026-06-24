import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export type EinvoiceResendAction = "send_email" | "send_whatsapp" | "retry_now";

interface InvokePayload {
  invoice_id: string;
  action: EinvoiceResendAction;
  to?: string;
}

/**
 * Acciones rápidas sobre una factura emitida.
 * AC7/AC9 de POS-innapsis-emision-pos.
 */
export function useEinvoiceActions() {
  const [pending, setPending] = useState<EinvoiceResendAction | null>(null);

  async function run(payload: InvokePayload): Promise<boolean> {
    setPending(payload.action);
    try {
      const { data, error } = await supabase.functions.invoke("einvoice-resend", {
        body: payload,
      });
      if (error || (data as any)?.error) {
        const msg = (data as any)?.error ?? error?.message ?? "Error";
        toast.error(`No se pudo procesar: ${msg}`);
        return false;
      }
      const labels: Record<EinvoiceResendAction, string> = {
        send_email: "Email enviado al cliente",
        send_whatsapp: "WhatsApp enviado al cliente",
        retry_now: "Reintento encolado",
      };
      toast.success(labels[payload.action]);
      return true;
    } catch (e: any) {
      toast.error(e?.message ?? "Error de red");
      return false;
    } finally {
      setPending(null);
    }
  }

  return { run, pending };
}
