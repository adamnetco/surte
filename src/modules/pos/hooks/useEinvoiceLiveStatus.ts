import { useEffect, useState } from "react";
import { supabaseEinvoiceRepository } from "@/infrastructure/database/SupabaseEinvoiceRepository";
import type { EinvoiceStatusRow } from "@/core/ports/IEinvoiceRepository";

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

function toSnapshot(row: EinvoiceStatusRow): EinvoiceLiveSnapshot {
  return {
    status: STATUS_MAP[row.status] ?? "queued",
    cufe: row.cufe ?? null,
    errorMessage: row.last_error ?? null,
    retryAttempt: row.retry_count ?? null,
    nextRetryAt: row.next_retry_at ?? null,
    invoiceId: row.id,
    docType: row.document_type ?? null,
  };
}

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

    (async () => {
      try {
        const row = await supabaseEinvoiceRepository.loadLatestByPosOrder(posOrderId);
        if (cancelled || !row) return;
        setSnap(toSnapshot(row));
      } catch {
        // silent
      }
    })();

    const timeoutId = window.setTimeout(() => {
      if (cancelled) return;
      setSnap((cur) =>
        cur.status === "queued" || cur.status === "sending" ? { ...cur, status: "timeout" } : cur,
      );
    }, 3000);

    const unsubscribe = supabaseEinvoiceRepository.subscribeByPosOrder(posOrderId, (row) => {
      setSnap(toSnapshot(row));
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      unsubscribe();
    };
  }, [posOrderId]);

  return snap;
}
