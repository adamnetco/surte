import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { HealthStatus } from "@/modules/pos/hooks/useHealthSnapshot";

export type TimelineEntry = {
  at: string;       // ISO
  from: string | null;
  to: string;
  note?: string;
  source: "local" | "server";
};

const MAX = 8;

function storageKey(source: string, scope: string) {
  return `sistecpos.timeline.${source}.${scope}`;
}

function load(source: string, scope: string): TimelineEntry[] {
  try {
    const raw = localStorage.getItem(storageKey(source, scope));
    return raw ? (JSON.parse(raw) as TimelineEntry[]) : [];
  } catch {
    return [];
  }
}

function persist(source: string, scope: string, entries: TimelineEntry[]) {
  try {
    localStorage.setItem(storageKey(source, scope), JSON.stringify(entries.slice(0, MAX)));
  } catch {
    /* quota — ignore */
  }
}

/**
 * Tracks status transitions for a given source (printer/core/wp/sites).
 * - Records local transitions in localStorage (survives reloads).
 * - Optionally hydrates from health_events (server side) for cross-device audit.
 *
 * Returns formatted strings for the StatusPill `events` prop plus the raw list.
 */
export function useStatusTimeline(
  source: "printer" | "core" | "wp" | "sites",
  status: HealthStatus,
  scope: string, // organizationId or "local"
  opts?: { hydrateFromServer?: boolean; note?: string },
) {
  const [entries, setEntries] = useState<TimelineEntry[]>(() => load(source, scope));
  const prevRef = useRef<HealthStatus | null>(null);

  // Record local transitions.
  useEffect(() => {
    if (status === "unknown") return;
    const prev = prevRef.current;
    if (prev === status) return;
    if (prev !== null) {
      const entry: TimelineEntry = {
        at: new Date().toISOString(),
        from: prev,
        to: status,
        note: opts?.note,
        source: "local",
      };
      setEntries((cur) => {
        const next = [entry, ...cur].slice(0, MAX);
        persist(source, scope, next);
        return next;
      });
    }
    prevRef.current = status;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Optional server hydration (last 5 events).
  useEffect(() => {
    if (!opts?.hydrateFromServer || !scope || scope === "local") return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("health_events")
        .select("created_at,status_from,status_to,metadata")
        .eq("source", source)
        .eq("organization_id", scope)
        .order("created_at", { ascending: false })
        .limit(5);
      if (cancelled || !data) return;
      const serverEntries: TimelineEntry[] = data.map((r: any) => ({
        at: r.created_at,
        from: r.status_from,
        to: r.status_to,
        note: r.metadata?.message,
        source: "server",
      }));
      setEntries((cur) => {
        // Merge by `at` (dedupe) and sort desc.
        const map = new Map<string, TimelineEntry>();
        [...serverEntries, ...cur].forEach((e) => map.set(e.at, e));
        return Array.from(map.values())
          .sort((a, b) => (a.at < b.at ? 1 : -1))
          .slice(0, MAX);
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [source, scope, opts?.hydrateFromServer]);

  const formatted = entries.map((e) => {
    const t = new Date(e.at).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
    const arrow = e.from ? `${e.from} → ${e.to}` : e.to;
    const tag = e.source === "server" ? "·srv" : "";
    return `${t} ${arrow}${tag}${e.note ? ` — ${e.note}` : ""}`;
  });

  return { entries, formatted };
}
