// Phase 4 — Structured WhatsApp event logger.
// Always include org_id and direction; latency/error/phone are optional but
// strongly recommended for debugging delivery and routing issues.
import { supabase } from "@/integrations/supabase/client";

export type WhatsAppDirection = "outbound" | "inbound" | "system";
export type WhatsAppStatus = "queued" | "sent" | "delivered" | "read" | "failed" | "retry_requested";

export interface WhatsAppEventInput {
  status: WhatsAppStatus;
  direction: WhatsAppDirection;
  organization_id?: string | null;
  order_id?: string | null;
  phone?: string | null;
  whatsapp_ref?: string | null;
  latency_ms?: number | null;
  error?: string | null;
  payload?: Record<string, unknown> | null;
}

/** Insert a structured WhatsApp event. Swallows errors but logs to console
 *  so that observability failures never break a send/receive path. */
export async function logWhatsAppEvent(event: WhatsAppEventInput): Promise<void> {
  const row = {
    status: event.status,
    direction: event.direction,
    organization_id: event.organization_id ?? null,
    order_id: event.order_id ?? null,
    phone: event.phone ?? null,
    whatsapp_ref: event.whatsapp_ref ?? null,
    latency_ms: event.latency_ms ?? null,
    error: event.error ?? null,
    payload: event.payload ?? null,
  };
  const { error } = await supabase.from("whatsapp_message_events").insert(row);
  if (error) {
    // eslint-disable-next-line no-console
    console.warn("[whatsapp-events] insert failed", error.message, row);
  }
}

/** Convenience: time a WhatsApp send and emit two events (queued + sent/failed). */
export async function withWhatsAppTrace<T>(
  ctx: Pick<WhatsAppEventInput, "organization_id" | "order_id" | "phone" | "whatsapp_ref"> & { direction?: WhatsAppDirection },
  fn: () => Promise<T>
): Promise<T> {
  const started = performance.now();
  const direction: WhatsAppDirection = ctx.direction ?? "outbound";
  await logWhatsAppEvent({ ...ctx, status: "queued", direction });
  try {
    const out = await fn();
    await logWhatsAppEvent({
      ...ctx,
      status: "sent",
      direction,
      latency_ms: Math.round(performance.now() - started),
    });
    return out;
  } catch (err) {
    await logWhatsAppEvent({
      ...ctx,
      status: "failed",
      direction,
      latency_ms: Math.round(performance.now() - started),
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
