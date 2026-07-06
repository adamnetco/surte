import { useEffect, useState } from "react";
import { supabaseEinvoiceRepository } from "@/infrastructure/database/SupabaseEinvoiceRepository";
import type { EinvoiceConfigPatch } from "@/core/ports/IEinvoiceRepository";

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

function parseRow(row: EinvoiceConfigPatch | null | undefined): DianHealthSnapshot {
  const range = row?.contingency_range ?? null;
  return {
    health: ((row?.dian_health_status ?? "unknown") as DianHealth),
    hasContingencyRange: !!(
      range &&
      typeof range === "object" &&
      ((range as Record<string, unknown>).from ??
        (range as Record<string, unknown>).current ??
        (range as Record<string, unknown>).to)
    ),
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
      try {
        const row = await supabaseEinvoiceRepository.loadConfig(organizationId);
        if (cancelled) return;
        const v = parseRow(row);
        cache.set(organizationId, { value: v, at: Date.now() });
        setSnap(v);
      } catch {
        // silent: cache/EMPTY cubre
      }
    })();

    const unsubscribe = supabaseEinvoiceRepository.subscribeConfig(organizationId, (patch) => {
      const v = parseRow(patch);
      cache.set(organizationId, { value: v, at: Date.now() });
      setSnap(v);
    });

    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [organizationId]);

  return snap;
}
