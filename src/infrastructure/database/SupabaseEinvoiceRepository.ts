/**
 * SupabaseEinvoiceRepository — implementa `IEinvoiceRepository` usando
 * el edge function `einvoice-resend`, la tabla `einvoice_configs` y realtime.
 */
import { supabase } from "@/integrations/supabase/client";
import { uniqueTopic, safeRemoveChannel } from "@/lib/realtime/safeChannel";
import type {
  IEinvoiceRepository,
  ResendPayload,
  EinvoiceConfigRow,
  EinvoiceConfigPatch,
} from "@/core/ports/IEinvoiceRepository";

const asError = (e: unknown): Error =>
  e instanceof Error ? e : new Error(String(e));

const CONFIG_COLUMNS =
  "is_active, resolution_number, resolution_prefix, resolution_from, resolution_to, resolution_current, environment, dian_health_status, contingency_range";

export const supabaseEinvoiceRepository: IEinvoiceRepository = {
  async resend({ invoiceId, action, to }: ResendPayload): Promise<void> {
    const { data, error } = await supabase.functions.invoke("einvoice-resend", {
      body: { invoice_id: invoiceId, action, to },
    });
    const remoteError = (data as { error?: string } | null | undefined)?.error;
    if (error || remoteError) {
      throw asError(remoteError ?? error?.message ?? "Error");
    }
  },

  async loadConfig(organizationId, opts) {
    let query = supabase
      .from("einvoice_configs")
      .select(CONFIG_COLUMNS)
      .eq("organization_id", organizationId);
    if (opts?.onlyProd) {
      query = query.eq("environment", "prod");
    }
    const { data, error } = await query.maybeSingle();
    if (error) throw asError(error);
    return (data ?? null) as EinvoiceConfigRow | null;
  },

  subscribeConfig(organizationId, onChange) {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(uniqueTopic(`einvoice-cfg-${organizationId}`))
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "einvoice_configs",
            filter: `organization_id=eq.${organizationId}`,
          },
          (payload) => onChange((payload.new ?? {}) as EinvoiceConfigPatch),
        )
        .subscribe();
    } catch (err) {
      console.warn("[SupabaseEinvoiceRepository] realtime subscribe failed", err);
    }
    return () => safeRemoveChannel(channel);
  },
};
