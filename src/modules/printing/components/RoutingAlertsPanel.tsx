// Slice L — Alertas de enrutamiento.
// Detecta dos condiciones operativas leyendo print_jobs últimos 7 días:
//   1. Reglas activas que NO se aplicaron hace ≥ 7 días (posible regla huérfana).
//   2. Impresoras activas SIN jobs en las últimas 24 h (posible agente caído).
// Sin migración: reutiliza payload.routing.rules y printer_id de print_jobs.
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, Printer as PrinterIcon, RefreshCcw, ShieldAlert } from "lucide-react";

interface Props {
  organizationId: string;
  printers: Array<{ id: string; name: string; role?: string }>;
  rules: Array<{
    id: string;
    printer_id: string;
    is_active: boolean;
    product_id: string | null;
    category_id: string | null;
    kitchen_station_id: string | null;
  }>;
  products: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
  stations: Array<{ id: string; name: string }>;
}

interface JobRow {
  printer_id: string | null;
  created_at: string;
  payload: { routing?: { rules?: Array<{ rule_id: string }> } } | null;
}

const DAYS_RULE_IDLE = 7;
const HOURS_PRINTER_IDLE = 24;

export function RoutingAlertsPanel({
  organizationId, printers, rules, products, categories, stations,
}: Props) {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - DAYS_RULE_IDLE * 86400000).toISOString();
    const { data } = await (supabase as any)
      .from("print_jobs")
      .select("printer_id, created_at, payload")
      .eq("organization_id", organizationId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(2000);
    setJobs((data ?? []) as JobRow[]);
    setLoading(false);
  };

  useEffect(() => { if (organizationId) load(); }, [organizationId]);

  const { idleRules, idlePrinters } = useMemo(() => {
    const ruleLast = new Map<string, string>();
    const printerLast = new Map<string, string>();
    for (const j of jobs) {
      if (j.printer_id && !printerLast.has(j.printer_id)) printerLast.set(j.printer_id, j.created_at);
      const rs = j.payload?.routing?.rules ?? [];
      for (const r of rs) {
        if (r.rule_id && !ruleLast.has(r.rule_id)) ruleLast.set(r.rule_id, j.created_at);
      }
    }
    const now = Date.now();
    const idleRules = rules
      .filter((r) => r.is_active)
      .map((r) => ({ rule: r, lastAt: ruleLast.get(r.id) ?? null }))
      .filter((x) => !x.lastAt || (now - new Date(x.lastAt).getTime()) >= DAYS_RULE_IDLE * 86400000);

    const idlePrinters = printers
      .map((p) => ({ printer: p, lastAt: printerLast.get(p.id) ?? null }))
      .filter((x) => !x.lastAt || (now - new Date(x.lastAt).getTime()) >= HOURS_PRINTER_IDLE * 3600000);

    return { idleRules, idlePrinters };
  }, [jobs, rules, printers]);

  const describe = (r: Props["rules"][number]) => {
    if (r.product_id) return { kind: "Producto", label: products.find((p) => p.id === r.product_id)?.name ?? r.product_id };
    if (r.category_id) return { kind: "Categoría", label: categories.find((c) => c.id === r.category_id)?.name ?? r.category_id };
    if (r.kitchen_station_id) return { kind: "Estación", label: stations.find((s) => s.id === r.kitchen_station_id)?.name ?? r.kitchen_station_id };
    return { kind: "—", label: "—" };
  };

  const fmtAgo = (iso: string | null) => {
    if (!iso) return "nunca (últimos 7 días)";
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 60) return `hace ${mins} min`;
    const h = Math.floor(mins / 60);
    if (h < 48) return `hace ${h} h`;
    return `hace ${Math.floor(h / 24)} días`;
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-amber-600" />
          <h4 className="font-bold">Alertas de enrutamiento</h4>
          <Badge variant="outline" className="text-[10px]">7 días</Badge>
        </div>
        <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
          <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Reglas sin uso ({idleRules.length})
          </div>
          {idleRules.length === 0 ? (
            <p className="text-xs text-muted-foreground">Todas las reglas activas se aplicaron en los últimos {DAYS_RULE_IDLE} días.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {idleRules.map(({ rule, lastAt }) => {
                const t = describe(rule);
                const printer = printers.find((p) => p.id === rule.printer_id);
                return (
                  <li key={rule.id} className="flex items-center justify-between gap-2 border rounded-md px-2 py-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="outline" className="text-[10px] shrink-0">{t.kind}</Badge>
                      <span className="truncate font-medium">{t.label}</span>
                      <span className="text-xs text-muted-foreground truncate">→ {printer?.name ?? "—"}</span>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{fmtAgo(lastAt)}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <PrinterIcon className="h-4 w-4 text-amber-600" />
            Impresoras inactivas ({idlePrinters.length})
          </div>
          {idlePrinters.length === 0 ? (
            <p className="text-xs text-muted-foreground">Todas las impresoras recibieron jobs en las últimas {HOURS_PRINTER_IDLE} h.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {idlePrinters.map(({ printer, lastAt }) => (
                <li key={printer.id} className="flex items-center justify-between gap-2 border rounded-md px-2 py-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <PrinterIcon className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="truncate font-medium">{printer.name}</span>
                    {printer.role && <Badge variant="secondary" className="text-[10px]">{printer.role}</Badge>}
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">{fmtAgo(lastAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </Card>
  );
}
