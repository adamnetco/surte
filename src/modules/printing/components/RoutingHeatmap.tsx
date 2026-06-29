// Slice K — Heatmap de uso por regla / impresora (últimos 7 días).
// Lee print_jobs y agrega en cliente por rule_id × printer_id y por día.
// Sin migración: usa el payload.routing.rules ya escrito por enqueue_print_job (Slice I).
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Flame, RefreshCcw, Printer as PrinterIcon } from "lucide-react";
import { format, subDays, startOfDay } from "date-fns";
import { es } from "date-fns/locale";

interface Props {
  organizationId: string;
  printers: Array<{ id: string; name: string }>;
  rules: Array<{
    id: string;
    printer_id: string;
    product_id: string | null;
    category_id: string | null;
    kitchen_station_id: string | null;
  }>;
  products: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
  stations: Array<{ id: string; name: string }>;
}

interface JobRouting {
  rules?: Array<{ rule_id: string; priority?: number }>;
}

const intensityClass = (v: number, max: number) => {
  if (v === 0) return "bg-muted/40 text-muted-foreground";
  const r = max > 0 ? v / max : 0;
  if (r > 0.75) return "bg-primary text-primary-foreground";
  if (r > 0.5) return "bg-primary/70 text-primary-foreground";
  if (r > 0.25) return "bg-primary/40";
  return "bg-primary/15";
};

export function RoutingHeatmap({
  organizationId, printers, rules, products, categories, stations,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [rows, setRows] = useState<Array<{ created_at: string; printer_id: string | null; payload: any }>>([]);

  const load = async () => {
    setLoading(true);
    const since = subDays(startOfDay(new Date()), 6).toISOString();
    const { data } = await (supabase as any)
      .from("print_jobs")
      .select("created_at,printer_id,payload")
      .eq("organization_id", organizationId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(2000);
    setRows((data ?? []) as any);
    setLoading(false);
  };

  useEffect(() => { if (organizationId) load(); /* eslint-disable-next-line */ }, [organizationId]);

  const days = useMemo(() => {
    const out: string[] = [];
    for (let i = 6; i >= 0; i--) out.push(format(subDays(new Date(), i), "yyyy-MM-dd"));
    return out;
  }, []);

  // Agregaciones
  const { perRulePerDay, perPrinterPerDay, ruleTotals, printerTotals, maxRule, maxPrinter } = useMemo(() => {
    const rd: Record<string, Record<string, number>> = {};
    const pd: Record<string, Record<string, number>> = {};
    const rt: Record<string, number> = {};
    const pt: Record<string, number> = {};
    for (const r of rows) {
      const day = format(new Date(r.created_at), "yyyy-MM-dd");
      const routing = (r.payload?.routing ?? {}) as JobRouting;
      const applied = routing.rules ?? [];
      for (const a of applied) {
        if (!a.rule_id) continue;
        rd[a.rule_id] ??= {};
        rd[a.rule_id][day] = (rd[a.rule_id][day] ?? 0) + 1;
        rt[a.rule_id] = (rt[a.rule_id] ?? 0) + 1;
      }
      if (r.printer_id) {
        pd[r.printer_id] ??= {};
        pd[r.printer_id][day] = (pd[r.printer_id][day] ?? 0) + 1;
        pt[r.printer_id] = (pt[r.printer_id] ?? 0) + 1;
      }
    }
    let maxR = 0, maxP = 0;
    Object.values(rd).forEach((m) => Object.values(m).forEach((v) => { if (v > maxR) maxR = v; }));
    Object.values(pd).forEach((m) => Object.values(m).forEach((v) => { if (v > maxP) maxP = v; }));
    return { perRulePerDay: rd, perPrinterPerDay: pd, ruleTotals: rt, printerTotals: pt, maxRule: maxR, maxPrinter: maxP };
  }, [rows]);

  const ruleLabel = (id: string) => {
    const r = rules.find((x) => x.id === id);
    if (!r) return id.slice(0, 8);
    if (r.product_id) return `Prod: ${products.find((p) => p.id === r.product_id)?.name ?? r.product_id.slice(0, 6)}`;
    if (r.category_id) return `Cat: ${categories.find((c) => c.id === r.category_id)?.name ?? r.category_id.slice(0, 6)}`;
    if (r.kitchen_station_id) return `Est: ${stations.find((s) => s.id === r.kitchen_station_id)?.name ?? r.kitchen_station_id.slice(0, 6)}`;
    return id.slice(0, 8);
  };
  const printerLabel = (id: string) => printers.find((p) => p.id === id)?.name ?? id.slice(0, 8);

  const ruleIds = Object.keys(perRulePerDay).sort((a, b) => (ruleTotals[b] ?? 0) - (ruleTotals[a] ?? 0));
  const printerIds = Object.keys(perPrinterPerDay).sort((a, b) => (printerTotals[b] ?? 0) - (printerTotals[a] ?? 0));

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2">
          <Flame className="h-5 w-5 mt-0.5 text-primary" />
          <div>
            <h4 className="font-semibold">Heatmap de uso · últimos 7 días</h4>
            <p className="text-xs text-muted-foreground">
              Frecuencia diaria por regla aplicada e impresora destino.
              Total de jobs analizados: <strong>{rows.length}</strong>.
            </p>
          </div>
        </div>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          <RefreshCcw className={`h-3 w-3 mr-1 ${loading ? "animate-spin" : ""}`} />
          Refrescar
        </Button>
      </div>

      {/* Reglas */}
      <div>
        <div className="text-xs font-medium mb-2 text-muted-foreground uppercase tracking-wide">Reglas</div>
        {ruleIds.length === 0 ? (
          <p className="text-sm text-muted-foreground py-3">Sin jobs ruteados por reglas en los últimos 7 días.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-separate border-spacing-1">
              <thead>
                <tr>
                  <th className="text-left font-medium text-muted-foreground pr-2">Regla</th>
                  {days.map((d) => (
                    <th key={d} className="text-center font-medium text-muted-foreground w-12">
                      {format(new Date(d), "EE dd", { locale: es })}
                    </th>
                  ))}
                  <th className="text-right font-medium text-muted-foreground pl-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {ruleIds.map((rid) => (
                  <tr key={rid}>
                    <td className="pr-2 whitespace-nowrap font-medium">{ruleLabel(rid)}</td>
                    {days.map((d) => {
                      const v = perRulePerDay[rid]?.[d] ?? 0;
                      return (
                        <td key={d} className="text-center">
                          <div className={`rounded h-7 flex items-center justify-center font-medium ${intensityClass(v, maxRule)}`}
                            title={`${v} jobs · ${format(new Date(d), "PP", { locale: es })}`}>
                            {v || "·"}
                          </div>
                        </td>
                      );
                    })}
                    <td className="text-right pl-2">
                      <Badge variant="secondary">{ruleTotals[rid]}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Impresoras */}
      <div>
        <div className="text-xs font-medium mb-2 text-muted-foreground uppercase tracking-wide">Impresoras</div>
        {printerIds.length === 0 ? (
          <p className="text-sm text-muted-foreground py-3">Sin jobs registrados en los últimos 7 días.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-separate border-spacing-1">
              <thead>
                <tr>
                  <th className="text-left font-medium text-muted-foreground pr-2">Impresora</th>
                  {days.map((d) => (
                    <th key={d} className="text-center font-medium text-muted-foreground w-12">
                      {format(new Date(d), "EE dd", { locale: es })}
                    </th>
                  ))}
                  <th className="text-right font-medium text-muted-foreground pl-2">Total</th>
                </tr>
              </thead>
              <tbody>
                {printerIds.map((pid) => (
                  <tr key={pid}>
                    <td className="pr-2 whitespace-nowrap font-medium flex items-center gap-1">
                      <PrinterIcon className="h-3 w-3 text-muted-foreground" />{printerLabel(pid)}
                    </td>
                    {days.map((d) => {
                      const v = perPrinterPerDay[pid]?.[d] ?? 0;
                      return (
                        <td key={d} className="text-center">
                          <div className={`rounded h-7 flex items-center justify-center font-medium ${intensityClass(v, maxPrinter)}`}
                            title={`${v} jobs · ${format(new Date(d), "PP", { locale: es })}`}>
                            {v || "·"}
                          </div>
                        </td>
                      );
                    })}
                    <td className="text-right pl-2">
                      <Badge variant="secondary">{printerTotals[pid]}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Card>
  );
}
