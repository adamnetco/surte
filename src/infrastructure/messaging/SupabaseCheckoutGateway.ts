/**
 * SupabaseCheckoutGateway — implementa `ICheckoutGateway` invocando
 * la edge function `send-whatsapp-order`.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  ICheckoutGateway,
  SubmitWhatsAppOrderInput,
  SubmitWhatsAppOrderResult,
} from "@/core/ports/ICheckoutGateway";

const asError = (raw: unknown): Error | null =>
  raw ? new Error((raw as { message?: string }).message ?? "checkout_submit_failed") : null;

export const supabaseCheckoutGateway: ICheckoutGateway = {
  async submitWhatsAppOrder(input: SubmitWhatsAppOrderInput) {
    const { data, error } = await supabase.functions.invoke("send-whatsapp-order", {
      body: input,
    });
    if (error) return { data: null, error: asError(error) };
    const result = (data ?? null) as SubmitWhatsAppOrderResult | null;
    if (result?.error) return { data: result, error: new Error(result.error) };
    return { data: result, error: null };
  },
};
