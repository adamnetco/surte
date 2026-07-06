import { useEffect, useState } from "react";
import { supabaseEinvoiceRepository } from "@/infrastructure/database/SupabaseEinvoiceRepository";

export interface ShiftDocsStats {
  ok: number;        // sent | accepted
  retry: number;     // queued | pending | contingency
  error: number;     // error | rejected
  total: number;
  loading: boolean;
}

const EMPTY: ShiftDocsStats = { ok: 0, retry: 0, error: 0, total: 0, loading: true };

function bucket(status: string): keyof Omit<ShiftDocsStats, "total" | "loading"> | null {
  if (status === "sent" || status === "accepted") return "ok";
  if (status === "queued" || status === "pending" || status === "contingency") return "retry";
  if (status === "error" || status === "rejected") return "error";
  return null;
}

function startOfTodayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

/**
 * AC15: Cuenta documentos electrónicos emitidos HOY por la organización,
 * agrupados en ok / retry / error. Realtime para que el widget se actualice
 * apenas el worker cambia el estado.
 */
export function useShiftDocsStats(organizationId: string | null | undefined): ShiftDocsStats {
  const [stats, setStats] = useState<ShiftDocsStats>(EMPTY);

  useEffect(() => {
    if (!organizationId) { setStats({ ...EMPTY, loading: false }); return; }
    let cancelled = false;
    const since = startOfTodayISO();

    const reload = async () => {
      try {
        const rows = await supabaseEinvoiceRepository.listStatusesSince(organizationId, since);
        if (cancelled) return;
        const next: ShiftDocsStats = { ok: 0, retry: 0, error: 0, total: 0, loading: false };
        for (const row of rows) {
          const b = bucket(String(row.status ?? ""));
          if (b) next[b] += 1;
          next.total += 1;
        }
        setStats(next);
      } catch {
        if (!cancelled) setStats((s) => ({ ...s, loading: false }));
      }
    };

    reload();

    const unsubscribe = supabaseEinvoiceRepository.subscribeByOrg(organizationId, () => {
      reload();
    });

    // Refresco defensivo cada 2 min por si Realtime se desconecta.
    const id = setInterval(reload, 120_000);

    return () => { cancelled = true; clearInterval(id); unsubscribe(); };
  }, [organizationId]);

  return stats;
}
