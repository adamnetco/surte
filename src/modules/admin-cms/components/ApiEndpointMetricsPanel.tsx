// Ola 24-bis · Slice 5 — Métricas por endpoint (p50/p95/p99 + error%)
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Activity, Download, RefreshCw } from "lucide-react";
import { toast } from "sonner";

type Row = {
  endpoint: string; method: string; mode: string;
  req_count: number; err_count: number; err_rate: number;
  p50_ms: number; p95_ms: number; p99_ms: number;
  avg_ms: number; max_ms: number;
  buckets: Array<{ t: string; p95: number; req: number }>;
};

const RANGES: Array<{ k: "24h" | "7d" | "30d"; label: string; hours: number }> = [
  { k: "24h", label: "24h", hours: 24 },
  { k: "7d", label: "7 días", hours: 24 * 7 },
  { k: "30d", label: "30 días", hours: 24 * 30 },
];

function Sparkline({ values }: { values: number[] }) {
  if (!values.length) return <div className="h-8 w-24 rounded bg-muted/40" />;
  const max = Math.max(...values, 1);
  const w = 96, h = 28, step = w / Math.max(values.length - 1, 1);
  const d = values.map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(h - (v / max) * h).toFixed(1)}`).join(" ");
  return (
    <svg width={w} height={h} className="text-primary">
      <path d={d} fill="none" stroke="currentColor" strokeWidth={1.5} />
    </svg>
  );
}

export function ApiEndpointMetricsPanel({ orgId }: { orgId: string }) {
  const [range, setRange] = useState<"24h" | "7d" | "30d">("24h");
  const [mode, setMode] = useState<"all" | "live" | "test">("all");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const hours = RANGES.find(r => r.k === range)!.hours;
    const from = new Date(Date.now() - hours * 3600 * 1000).toISOString();
    const to = new Date().toISOString();
    const { data, error } = await supabase.rpc("get_api_endpoint_metrics", {
      p_org: orgId, p_from: from, p_to: to, p_mode: mode === "all" ? null : mode,
    });
    setLoading(false);
    if (error) { toast.error(error.message, { position: "top-center" }); return; }
    setRows((data ?? []) as Row[]);
  };

  useEffect(() => { if (orgId) load(); /* eslint-disable-next-line */ }, [orgId, range, mode]);

  const totals = useMemo(() => {
    const r = rows ?? [];
    const req = r.reduce((a, x) => a + Number(x.req_count), 0);
    const err = r.reduce((a, x) => a + Number(x.err_count), 0);
    return { req, err, errPct: req ? Math.round((err / req) * 10000) / 100 : 0 };
  }, [rows]);

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <CardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5" /> Métricas por endpoint
        </CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-md border p-0.5">
            {RANGES.map(r => (
              <button key={r.k} onClick={() => setRange(r.k)}
                className={`rounded px-2.5 py-1 text-xs ${range === r.k ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                {r.label}
              </button>
            ))}
          </div>
          <div className="flex rounded-md border p-0.5">
            {(["all", "live", "test"] as const).map(m => (
              <button key={m} onClick={() => setMode(m)}
                className={`rounded px-2.5 py-1 text-xs uppercase ${mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
                {m}
              </button>
            ))}
          </div>
          <Button size="sm" variant="outline" onClick={load} disabled={loading}>
            <RefreshCw className={`mr-1 h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Refrescar
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Requests" value={totals.req.toLocaleString("es-CO")} />
          <Stat label="Errores" value={`${totals.err.toLocaleString("es-CO")}`} />
          <Stat label="Error rate" value={`${totals.errPct}%`} tone={totals.errPct > 5 ? "danger" : totals.errPct > 1 ? "warn" : "ok"} />
        </div>

        {loading && !rows ? (
          <Skeleton className="h-40 w-full" />
        ) : !rows?.length ? (
          <div className="rounded-md border border-dashed p-6 text-center text-sm text-muted-foreground">
            Sin tráfico en el rango seleccionado.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 text-left">Endpoint</th>
                  <th className="px-3 py-2 text-right">Req</th>
                  <th className="px-3 py-2 text-right">Err%</th>
                  <th className="px-3 py-2 text-right">p50</th>
                  <th className="px-3 py-2 text-right">p95</th>
                  <th className="px-3 py-2 text-right">p99</th>
                  <th className="px-3 py-2 text-right">max</th>
                  <th className="px-3 py-2 text-center">Latencia p95</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="border-t">
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-mono text-[10px]">{r.method}</Badge>
                        <span className="font-mono text-xs">{r.endpoint || "/"}</span>
                        <Badge variant={r.mode === "test" ? "secondary" : "default"} className="text-[10px] uppercase">{r.mode}</Badge>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right font-mono">{Number(r.req_count).toLocaleString("es-CO")}</td>
                    <td className={`px-3 py-2 text-right font-mono ${Number(r.err_rate) > 5 ? "text-red-600" : Number(r.err_rate) > 1 ? "text-amber-600" : ""}`}>{r.err_rate}%</td>
                    <td className="px-3 py-2 text-right font-mono">{r.p50_ms}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.p95_ms}</td>
                    <td className="px-3 py-2 text-right font-mono">{r.p99_ms}</td>
                    <td className="px-3 py-2 text-right font-mono text-muted-foreground">{r.max_ms}</td>
                    <td className="px-3 py-2"><div className="flex justify-center"><Sparkline values={(r.buckets ?? []).map(b => Number(b.p95) || 0)} /></div></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Agregaciones refrescadas cada 5 minutos. Los percentiles se calculan a partir de buckets horarios.
        </p>
      </CardContent>
    </Card>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "ok" | "warn" | "danger" }) {
  const cls = tone === "danger" ? "text-red-600" : tone === "warn" ? "text-amber-600" : "";
  return (
    <div className="rounded-md border p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-semibold ${cls}`}>{value}</div>
    </div>
  );
}
