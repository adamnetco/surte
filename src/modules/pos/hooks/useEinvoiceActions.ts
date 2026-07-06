import { useState } from "react";
import { toast } from "sonner";
import { supabaseEinvoiceRepository } from "@/infrastructure/database/SupabaseEinvoiceRepository";
import type { EinvoiceResendAction } from "@/core/ports/IEinvoiceRepository";

export type { EinvoiceResendAction };

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
      await supabaseEinvoiceRepository.resend({
        invoiceId: payload.invoice_id,
        action: payload.action,
        to: payload.to,
      });
      const labels: Record<EinvoiceResendAction, string> = {
        send_email: "Email enviado al cliente",
        send_whatsapp: "WhatsApp enviado al cliente",
        retry_now: "Reintento encolado",
      };
      toast.success(labels[payload.action]);
      return true;
    } catch (e) {
      toast.error((e as Error)?.message ?? "Error de red");
      return false;
    } finally {
      setPending(null);
    }
  }

  return { run, pending };
}
