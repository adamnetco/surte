import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type DianHealth = "online" | "degraded" | "offline" | "unknown";

interface CacheEntry {
  value: DianHealth;
  at: number;
}

const TTL_MS = 5 * 60 * 1000; // 5 min
const cache = new Map<string, CacheEntry>();

/**
 * Lee `einvoice_configs.dian_health_status` para la organización activa.
 * AC10 de POS-innapsis-emision-pos.
 * Cache local 5 min para no martillar la DB con polling.
 */
export function useDianHealth(organizationId: string | null | undefined): DianHealth {
  const [health, setHealth] = useState<DianHealth>(() => {
    if (!organizationId) return "unknown";
    const c = cache.get(organizationId);
    return c && Date.now() - c.at < TTL_MS ? c.value : "unknown";
  });

  useEffect(() => {
    if (!organizationId) {
      setHealth("unknown");
      return;
    }

    const cached = cache.get(organizationId);
    if (cached && Date.now() - cached.at < TTL_MS) {
      setHealth(cached.value);
      return;
    }

    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("einvoice_configs")
        .select("dian_health_status")
        .eq("organization_id", organizationId)
        .maybeSingle();
      if (cancelled) return;
      const v = ((data as any)?.dian_health_status ?? "unknown") as DianHealth;
      cache.set(organizationId, { value: v, at: Date.now() });
      setHealth(v);
    })();

    // Suscripción Realtime para reflejar cambios del cron sin esperar TTL
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
          const v = ((payload.new as any)?.dian_health_status ?? "unknown") as DianHealth;
          cache.set(organizationId, { value: v, at: Date.now() });
          setHealth(v);
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [organizationId]);

  return health;
}
