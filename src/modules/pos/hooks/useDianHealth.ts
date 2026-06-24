import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type DianHealth = "online" | "degraded" | "offline" | "unknown";

export interface DianHealthSnapshot {
  health: DianHealth;
  hasContingencyRange: boolean;
}

interface CacheEntry {
  value: DianHealthSnapshot;
  at: number;
}

const TTL_MS = 5 * 60 * 1000; // 5 min
const cache = new Map<string, CacheEntry>();

const EMPTY: DianHealthSnapshot = { health: "unknown", hasContingencyRange: false };

function parseRow(row: any): DianHealthSnapshot {
  const range = row?.contingency_range ?? null;
  return {
    health: ((row?.dian_health_status ?? "unknown") as DianHealth),
    hasContingencyRange: !!(range && typeof range === "object" && (range.from ?? range.current ?? range.to)),
  };
}

/**
 * Lee `einvoice_configs.dian_health_status` y `contingency_range` para la organización activa.
 * AC10/AC11 de POS-innapsis-emision-pos. Cache local 5 min + Realtime para refresco inmediato.
 */
export function useDianHealth(organizationId: string | null | undefined): DianHealthSnapshot {
  const [snap, setSnap] = useState<DianHealthSnapshot>(() => {
    if (!organizationId) return EMPTY;
    const c = cache.get(organizationId);
    return c && Date.now() - c.at < TTL_MS ? c.value : EMPTY;
  });

  useEffect(() => {
    if (!organizationId) {
      setSnap(EMPTY);
      return;
    }

    const cached = cache.get(organizationId);
    if (cached && Date.now() - cached.at < TTL_MS) {
      setSnap(cached.value);
    }

    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("einvoice_configs")
        .select("dian_health_status, contingency_range")
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (cancelled) return;
      const v = parseRow(data);
      cache.set(organizationId, { value: v, at: Date.now() });
      setSnap(v);
    })();

    const channel = supabase
      .channel(`dian-health-${organizationId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "einvoice_configs",
          filter: `organization_id=eq.${organizationId}`,
        },
        (payload) => {
          const v = parseRow(payload.new);
          cache.set(organizationId, { value: v, at: Date.now() });
          setSnap(v);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [organizationId]);

  return snap;
}

