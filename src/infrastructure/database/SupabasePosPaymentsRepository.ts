/**
 * SupabasePosPaymentsRepository — implementa `IPosPaymentsRepository`
 * sobre la tabla `pos_payments`.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  IPosPaymentsRepository,
  PosPaymentRow,
} from "@/core/ports/IPosPaymentsRepository";

const asError = (e: unknown): Error =>
  e instanceof Error ? e : new Error(String(e));

export const supabasePosPaymentsRepository: IPosPaymentsRepository = {
  async listInRange(organizationId, fromIso, toIso) {
    const { data, error } = await supabase
      .from("pos_payments")
      .select("method, amount, created_at")
      .eq("organization_id", organizationId)
      .gte("created_at", fromIso)
      .lte("created_at", toIso);
    if (error) throw asError(error);
    return (data ?? []) as PosPaymentRow[];
  },
};
