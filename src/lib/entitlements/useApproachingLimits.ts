import { useMemo } from "react";
import { useEntitlements } from "./useEntitlements";

export type LimitSeverity = "ok" | "notice" | "warn" | "critical" | "exceeded";

export type LimitWarning = {
  key: string;
  used: number;
  limit: number;
  remaining: number;
  pct: number;
  severity: LimitSeverity;
};

/**
 * Clasifica cada límite del tenant según su porcentaje de consumo:
 *  - <70%: ok (oculto)
 *  - 70-79%: notice (passive)
 *  - 80-94%: warn (banner)
 *  - 95-99%: critical (banner + CTA fuerte)
 *  - >=100%: exceeded (hard block, sólo informativo aquí)
 */
export function classifyLimit(used: number, limit: number | null | undefined): LimitSeverity {
  if (limit == null || limit <= 0) return "ok";
  const pct = (used / limit) * 100;
  if (pct >= 100) return "exceeded";
  if (pct >= 95) return "critical";
  if (pct >= 80) return "warn";
  if (pct >= 70) return "notice";
  return "ok";
}

export function useApproachingLimits(organizationId: string | null | undefined) {
  const { data: ent, isLoading } = useEntitlements(organizationId);

  const warnings = useMemo<LimitWarning[]>(() => {
    if (!ent) return [];
    const out: LimitWarning[] = [];
    for (const [key, l] of Object.entries(ent.limits)) {
      const used = l.used ?? 0;
      const limit = l.value;
      const severity = classifyLimit(used, limit);
      if (severity === "ok" || limit == null) continue;
      out.push({
        key,
        used,
        limit,
        remaining: Math.max(0, limit - used),
        pct: Math.min(100, Math.round((used / limit) * 100)),
        severity,
      });
    }
    // Más críticos primero
    const rank: Record<LimitSeverity, number> = { exceeded: 0, critical: 1, warn: 2, notice: 3, ok: 4 };
    return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
  }, [ent]);

  const topCritical = warnings.find((w) => w.severity === "critical" || w.severity === "warn") ?? null;

  return { warnings, topCritical, loading: isLoading };
}
