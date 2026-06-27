import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { uniqueTopic, safeRemoveChannel } from "@/lib/realtime/safeChannel";

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
      const { data, error } = await supabase
        .from("electronic_invoices")
        .select("status")
        .eq("organization_id", organizationId)
        .gte("created_at", since);
      if (cancelled) return;
      if (error) { setStats((s) => ({ ...s, loading: false })); return; }
      const next = { ok: 0, retry: 0, error: 0, total: 0, loading: false } as ShiftDocsStats;
      for (const row of data ?? []) {
        const b = bucket(String((row as any).status ?? ""));
        if (b) next[b] += 1;
        next.total += 1;
      }
      setStats(next);
    };

    reload();

    let channel: ReturnType<typeof supabase.channel> | null = null;
    try {
      channel = supabase
        .channel(uniqueTopic(`shift-docs-${organizationId}`))
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "electronic_invoices", filter: `organization_id=eq.${organizationId}` },
          () => { reload(); },
        )
        .subscribe();
    } catch (err) {
      console.warn("[useShiftDocsStats] realtime subscribe failed", err);
    }

    // Refresco defensivo cada 2 min por si Realtime se desconecta.
    const id = setInterval(reload, 120_000);

    return () => { cancelled = true; clearInterval(id); safeRemoveChannel(channel); };
  }, [organizationId]);

  return stats;
}
