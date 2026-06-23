import type { FxFraudRule, FxFraudWatchEntry } from "../hooks/useFxFraud";

export type SimulatedTx = {
  operation: "buy" | "sell";
  cop_amount: number;
  customer_doc_type?: string;
  customer_doc_number?: string;
  customer_name?: string;
  customer_address?: string;
  customer_occupation?: string;
  funds_origin?: string;
};

export type DailyAggregate = {
  ops_today: number;
  amount_today_cop: number;
  ops_last_window: number;
  window_minutes: number;
};

export type SimulationContext = {
  rules: FxFraudRule[];
  watchlist: FxFraudWatchEntry[];
  daily: DailyAggregate;
  uiafThresholdCop: number; // por defecto 10.000.000 COP
};

export type SimulationHit = {
  rule_code: string;
  rule_name: string;
  severity: FxFraudRule["severity"];
  auto_mark_suspicious: boolean;
  reason: string;
  criteria: Record<string, unknown>;
};

const DEFAULT_UIAF_COP = 10_000_000;

export function simulateFraudRules(tx: SimulatedTx, ctx: SimulationContext): SimulationHit[] {
  const hits: SimulationHit[] = [];
  const uiafCop = ctx.uiafThresholdCop ?? DEFAULT_UIAF_COP;
  const aboveThreshold = tx.cop_amount >= uiafCop;

  for (const rule of ctx.rules.filter((r) => r.is_active)) {
    const p = rule.params ?? {};
    switch (rule.rule_code) {
      case "structuring_daily_count": {
        const max = Number(p.max_ops_per_day ?? 3);
        const projected = ctx.daily.ops_today + 1;
        if (projected >= max) {
          hits.push(buildHit(rule, `Cliente alcanzaría ${projected} operaciones hoy (umbral ${max}).`, {
            ops_today: ctx.daily.ops_today,
            projected,
            max_ops_per_day: max,
          }));
        }
        break;
      }
      case "structuring_daily_amount": {
        const max = Number(p.max_amount_per_day_cop ?? 50_000_000);
        const projected = ctx.daily.amount_today_cop + tx.cop_amount;
        if (projected >= max) {
          hits.push(buildHit(rule, `Acumulado diario alcanzaría ${formatCop(projected)} (umbral ${formatCop(max)}).`, {
            amount_today_cop: ctx.daily.amount_today_cop,
            tx_cop: tx.cop_amount,
            projected_cop: projected,
            max_amount_per_day_cop: max,
          }));
        }
        break;
      }
      case "rapid_operations": {
        const max = Number(p.max_ops ?? 5);
        const win = Number(p.window_minutes ?? 60);
        const projected = ctx.daily.ops_last_window + 1;
        if (projected >= max) {
          hits.push(buildHit(rule, `${projected} operaciones en ${win} min (umbral ${max}).`, {
            ops_last_window: ctx.daily.ops_last_window,
            projected,
            window_minutes: win,
            max_ops: max,
          }));
        }
        break;
      }
      case "large_single_op": {
        const thr = Number(p.threshold_cop ?? 40_000_000);
        if (tx.cop_amount >= thr) {
          hits.push(buildHit(rule, `Operación de ${formatCop(tx.cop_amount)} supera ${formatCop(thr)}.`, {
            tx_cop: tx.cop_amount,
            threshold_cop: thr,
          }));
        }
        break;
      }
      case "missing_customer_data": {
        if (aboveThreshold) {
          const missing: string[] = [];
          if (!tx.customer_doc_number) missing.push("documento");
          if (!tx.customer_name) missing.push("nombre");
          if (!tx.customer_address) missing.push("dirección");
          if (!tx.customer_occupation) missing.push("ocupación");
          if (!tx.funds_origin) missing.push("origen de fondos");
          if (missing.length) {
            hits.push(buildHit(rule, `Operación sobre umbral UIAF sin: ${missing.join(", ")}.`, {
              uiaf_threshold_cop: uiafCop,
              tx_cop: tx.cop_amount,
              missing_fields: missing,
            }));
          }
        }
        break;
      }
    }
  }

  // Watchlist (no requiere regla configurada; siempre se evalúa si hay documento)
  if (tx.customer_doc_number) {
    const match = ctx.watchlist.find(
      (w) => w.is_active && w.doc_number.trim() === tx.customer_doc_number!.trim(),
    );
    if (match) {
      hits.push({
        rule_code: "watchlist_match",
        rule_name: "Coincidencia con lista de vigilancia",
        severity: "critical",
        auto_mark_suspicious: true,
        reason: `Documento ${match.doc_type ?? ""} ${match.doc_number} está en lista de vigilancia${match.reason ? ` (${match.reason})` : ""}.`,
        criteria: {
          doc_type: match.doc_type,
          doc_number: match.doc_number,
          watchlist_reason: match.reason,
          full_name: match.full_name,
        },
      });
    }
  }

  return hits;
}

function buildHit(rule: FxFraudRule, reason: string, criteria: Record<string, unknown>): SimulationHit {
  return {
    rule_code: rule.rule_code,
    rule_name: rule.name,
    severity: rule.severity,
    auto_mark_suspicious: rule.auto_mark_suspicious,
    reason,
    criteria,
  };
}

function formatCop(n: number): string {
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
}
