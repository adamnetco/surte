import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type EinvoiceLiveStatus =
  | "idle"
  | "queued"
  | "sending"
  | "accepted"
  | "rejected"
  | "retrying"
  | "dead_letter"
  | "timeout";

export interface EinvoiceLiveSnapshot {
  status: EinvoiceLiveStatus;
  cufe?: string | null;
  errorMessage?: string | null;
  retryAttempt?: number | null;
  nextRetryAt?: string | null;
  invoiceId?: string | null;
  docType?: string | null;
}

const STATUS_MAP: Record<string, EinvoiceLiveStatus> = {
  pending: "queued",
  queued: "queued",
  sending: "sending",
  sent: "sending",
  accepted: "accepted",
  approved: "accepted",
  rejected: "rejected",
  error: "rejected",
  retrying: "retrying",
  dead_letter: "dead_letter",
};

/**
 * Suscripción Realtime al estado DIAN de la factura emitida para un pos_order.
 * AC4, AC5, AC6 de POS-innapsis-emision-pos.
 *
 * Tras 3s sin update, retorna status `timeout` para que el cajero pueda continuar
 * sin quedar bloqueado (la emisión sigue corriendo en background vía outbox).
 */
export function useEinvoiceLiveStatus(posOrderId: string | null | undefined): EinvoiceLiveSnapshot {
  const [snap, setSnap] = useState<EinvoiceLiveSnapshot>({ status: "idle" });

  useEffect(() => {
    if (!posOrderId) {
      setSnap({ status: "idle" });
      return;
    }

    let cancelled = false;
    setSnap({ status: "queued" });

    // Fetch inicial
    (async () => {
      const { data } = await supabase
        .from("electronic_invoices")
        .select("id, status, cufe, last_error, retry_count, next_retry_at, document_type")
        .eq("pos_order_id", posOrderId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || !data) return;
      setSnap({
        status: STATUS_MAP[data.status as string] ?? "queued",
        cufe: data.cufe ?? null,
        errorMessage: data.last_error ?? null,
        retryAttempt: data.retry_count ?? null,
        nextRetryAt: data.next_retry_at ?? null,
        invoiceId: data.id,
        docType: data.document_type ?? null,
      });
    })();

    // Timeout suave a 3s — si no hay actualización, mostramos "procesando en background"
    const timeoutId = window.setTimeout(() => {
      if (cancelled) return;
      setSnap((cur) =>
        cur.status === "queued" || cur.status === "sending" ? { ...cur, status: "timeout" } : cur,
      );
    }, 3000);

    // Realtime sub
    const channel = supabase
      .channel(`einvoice-pos-${posOrderId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "electronic_invoices",
          filter: `pos_order_id=eq.${posOrderId}`,
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as any;
          if (!row) return;
          setSnap({
            status: STATUS_MAP[row.status] ?? "queued",
            cufe: row.cufe ?? null,
            errorMessage: row.last_error ?? null,
            retryAttempt: row.retry_count ?? null,
            nextRetryAt: row.next_retry_at ?? null,
            invoiceId: row.id,
            docType: row.document_type ?? null,
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      supabase.removeChannel(channel);
    };
  }, [posOrderId]);

  return snap;
}
