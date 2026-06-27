import { useMemo, useState } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { TrendingUp, TrendingDown, Receipt, DollarSign, Percent, ShoppingBag, Download, FileSpreadsheet, FileText } from "lucide-react";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  useSalesSummary,
  useTopProducts,
  usePaymentMix,
  useCashierPerformance,
  aggregate,
  type Granularity,
  type SalesBucket,
} from "../hooks/useSalesReport";
import ReportesDetail from "../components/ReportesDetail";
import { exportReportsCsv, exportReportsXlsx } from "../lib/exportReports";
import { toast } from "@/hooks/use-toast";

type RangeKey = "today" | "7d" | "30d" | "month" | "custom";

interface Range {
  from: Date;
  to: Date;
  granularity: Granularity;
  label: string;
}

const startOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};
const endOfDay = (d: Date) => {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
};

function buildRange(key: RangeKey, custom?: { from: Date; to: Date }): Range {
  const now = new Date();
  switch (key) {
    case "today":
      return { from: startOfDay(now), to: endOfDay(now), granularity: "hour", label: "Hoy" };
    case "7d": {
      const from = startOfDay(new Date(now.getTime() - 6 * 86400000));
      return { from, to: endOfDay(now), granularity: "day", label: "Últimos 7 días" };
    }
    case "30d": {
      const from = startOfDay(new Date(now.getTime() - 29 * 86400000));
      return { from, to: endOfDay(now), granularity: "day", label: "Últimos 30 días" };
    }
    case "month": {
      const from = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from, to: endOfDay(now), granularity: "day", label: "Este mes" };
    }
    case "custom":
      return {
        from: custom?.from ?? startOfDay(now),
        to: custom?.to ?? endOfDay(now),
        granularity: "day",
        label: "Rango personalizado",
      };
  }
}

function prevRangeOf(r: Range): Range {
  const span = r.to.getTime() - r.from.getTime();
  return {
    from: new Date(r.from.getTime() - span - 1),
    to: new Date(r.from.getTime() - 1),
    granularity: r.granularity,
    label: "Período anterior",
  };
}

function yoyRangeOf(r: Range): Range {
  const shift = (d: Date) => {
    const x = new Date(d);
    x.setFullYear(x.getFullYear() - 1);
    return x;
  };
  return { from: shift(r.from), to: shift(r.to), granularity: r.granularity, label: "Año anterior" };
}


const cop = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);

function fmtBucket(iso: string, g: Granularity): string {
  const d = new Date(iso);
  if (g === "hour") return d.toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" });
  if (g === "month") return d.toLocaleDateString("es-CO", { month: "short", year: "2-digit" });
  return d.toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
}

type Metric = "gross" | "net" | "units";

interface KpiCardProps {
  icon: React.ElementType;
  label: string;
  value: string;
  delta?: number;
  loading?: boolean;
}

function KpiCard({ icon: Icon, label, value, delta, loading }: KpiCardProps) {
  const up = (delta ?? 0) >= 0;
  return (
    <Card className="p-4 border-border/60">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </div>
      {loading ? (
        <Skeleton className="h-8 w-32 mt-2" />
      ) : (
        <div className="mt-1 text-2xl font-bold tracking-tight">{value}</div>
      )}
      {delta !== undefined && !loading && (
        <div
          className={`mt-1 inline-flex items-center gap-1 text-xs ${
            up ? "text-emerald-600" : "text-red-600"
          }`}
        >
          {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {Math.abs(delta).toFixed(1)}% vs período anterior
        </div>
      )}
    </Card>
  );
}

function deltaPct(curr: number, prev: number): number | undefined {
  if (!prev) return curr > 0 ? 100 : undefined;
  return ((curr - prev) / prev) * 100;
}

const RANGE_OPTIONS: { key: RangeKey; label: string }[] = [
  { key: "today", label: "Hoy" },
  { key: "7d", label: "7d" },
  { key: "30d", label: "30d" },
  { key: "month", label: "Mes" },
];

const Reportes = () => {
  const { currentOrg } = useOrganization();
  const [rangeKey, setRangeKey] = useState<RangeKey>("7d");
  const [customRange, setCustomRange] = useState<{ from: string; to: string }>({
    from: new Date().toISOString().slice(0, 10),
    to: new Date().toISOString().slice(0, 10),
  });
  const [metric, setMetric] = useState<Metric>("gross");

  const range = useMemo(() => {
    if (rangeKey === "custom") {
      return buildRange("custom", {
        from: startOfDay(new Date(customRange.from)),
        to: endOfDay(new Date(customRange.to)),
      });
    }
    return buildRange(rangeKey);
  }, [rangeKey, customRange]);

  const prevRange = useMemo(() => prevRangeOf(range), [range]);

  const current = useSalesSummary({
    orgId: currentOrg?.id,
    from: range.from,
    to: range.to,
    granularity: range.granularity,
  });
  const previous = useSalesSummary({
    orgId: currentOrg?.id,
    from: prevRange.from,
    to: prevRange.to,
    granularity: prevRange.granularity,
  });

  const topProducts = useTopProducts({ orgId: currentOrg?.id, from: range.from, to: range.to, limit: 25 });
  const paymentMix = usePaymentMix({ orgId: currentOrg?.id, from: range.from, to: range.to });
  const cashiers = useCashierPerformance({ orgId: currentOrg?.id, from: range.from, to: range.to });

  const currTotals = useMemo(() => aggregate(current.data ?? []), [current.data]);
  const prevTotals = useMemo(() => aggregate(previous.data ?? []), [previous.data]);

  const avgTicket = currTotals.tickets > 0 ? currTotals.gross / currTotals.tickets : 0;
  const prevAvgTicket = prevTotals.tickets > 0 ? prevTotals.gross / prevTotals.tickets : 0;
  const taxPct = currTotals.gross > 0 ? (currTotals.tax / currTotals.gross) * 100 : 0;
  const prevTaxPct = prevTotals.gross > 0 ? (prevTotals.tax / prevTotals.gross) * 100 : 0;

  const chartData = useMemo(
    () =>
      (current.data ?? []).map((b: SalesBucket) => ({
        bucket: fmtBucket(b.bucket, range.granularity),
        gross: b.gross,
        net: b.net,
        units: b.units,
      })),
    [current.data, range.granularity],
  );

  const loading = current.isLoading;

  const exportReady =
    !current.isLoading && !topProducts.isLoading && !paymentMix.isLoading && !cashiers.isLoading;

  const handleExport = (format: "csv" | "xlsx") => {
    if (!exportReady) {
      toast({ title: "Espera", description: "Los datos siguen cargando." });
      return;
    }
    const payload = {
      orgName: currentOrg?.name ?? "negocio",
      rangeLabel: range.label,
      from: range.from,
      to: range.to,
      granularity: range.granularity,
      buckets: current.data ?? [],
      topProducts: topProducts.data ?? [],
      paymentMix: paymentMix.data ?? [],
      cashiers: cashiers.data ?? [],
    };
    try {
      if (format === "csv") exportReportsCsv(payload);
      else exportReportsXlsx(payload);
      toast({ title: "Exportación lista", description: `Archivo ${format.toUpperCase()} descargado.` });
    } catch (e: any) {
      toast({ title: "Error al exportar", description: e?.message ?? "Intenta de nuevo.", variant: "destructive" });
    }
  };


  return (
    <main className="min-h-[100dvh] bg-background pb-16">
      <div className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        {/* Header */}
        <header className="space-y-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Reportes</h1>
            <p className="text-sm text-muted-foreground">
              {currentOrg?.name ?? "Tu negocio"} · {range.label}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-lg border border-border bg-card p-1">
              {RANGE_OPTIONS.map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setRangeKey(opt.key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                    rangeKey === opt.key
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
              <button
                onClick={() => setRangeKey("custom")}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${
                  rangeKey === "custom"
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                Custom
              </button>
            </div>

            {rangeKey === "custom" && (
              <div className="flex items-center gap-1 text-xs">
                <input
                  type="date"
                  value={customRange.from}
                  max={customRange.to}
                  onChange={(e) => setCustomRange((s) => ({ ...s, from: e.target.value }))}
                  className="px-2 py-1.5 rounded-md border border-border bg-card"
                />
                <span className="text-muted-foreground">→</span>
                <input
                  type="date"
                  value={customRange.to}
                  min={customRange.from}
                  onChange={(e) => setCustomRange((s) => ({ ...s, to: e.target.value }))}
                  className="px-2 py-1.5 rounded-md border border-border bg-card"
                />
              </div>
            )}

            <div className="ml-auto flex items-center gap-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" disabled={!exportReady} className="gap-1.5">
                    <Download className="h-3.5 w-3.5" />
                    Exportar
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleExport("xlsx")} className="gap-2">
                    <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                    Excel (.xlsx)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleExport("csv")} className="gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    CSV
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => current.refetch()}
                disabled={loading}
              >
                Actualizar
              </Button>
            </div>

          </div>
        </header>

        {/* KPIs */}
        <section
          className="grid gap-3 grid-cols-2 lg:grid-cols-4"
          aria-label="Indicadores clave"
        >
          <KpiCard
            icon={DollarSign}
            label="Ventas netas"
            value={cop(currTotals.net)}
            delta={deltaPct(currTotals.net, prevTotals.net)}
            loading={loading}
          />
          <KpiCard
            icon={Receipt}
            label="Tickets"
            value={currTotals.tickets.toLocaleString("es-CO")}
            delta={deltaPct(currTotals.tickets, prevTotals.tickets)}
            loading={loading}
          />
          <KpiCard
            icon={ShoppingBag}
            label="Ticket promedio"
            value={cop(avgTicket)}
            delta={deltaPct(avgTicket, prevAvgTicket)}
            loading={loading}
          />
          <KpiCard
            icon={Percent}
            label="Impuestos"
            value={`${taxPct.toFixed(1)}%`}
            delta={deltaPct(taxPct, prevTaxPct)}
            loading={loading}
          />
        </section>

        {/* Chart */}
        <section aria-label="Serie temporal de ventas">
          <Card className="p-4 border-border/60">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
              <div>
                <h2 className="text-sm font-semibold">Evolución</h2>
                <p className="text-xs text-muted-foreground">
                  {range.granularity === "hour"
                    ? "Por hora"
                    : range.granularity === "month"
                      ? "Por mes"
                      : "Por día"}
                </p>
              </div>
              <div className="inline-flex rounded-md border border-border p-0.5 text-xs">
                {(["gross", "net", "units"] as Metric[]).map((m) => (
                  <button
                    key={m}
                    onClick={() => setMetric(m)}
                    className={`px-2.5 py-1 rounded transition ${
                      metric === m
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:bg-muted"
                    }`}
                  >
                    {m === "gross" ? "Bruto" : m === "net" ? "Neto" : "Unidades"}
                  </button>
                ))}
              </div>
            </div>

            {loading ? (
              <Skeleton className="h-64 w-full" />
            ) : chartData.length === 0 ? (
              <div className="h-64 flex flex-col items-center justify-center text-center text-muted-foreground">
                <TrendingUp className="h-10 w-10 mb-2 opacity-30" />
                <p className="text-sm">Sin ventas en este período</p>
                <p className="text-xs">Cuando registres ventas aparecerán aquí.</p>
              </div>
            ) : (
              <div className="h-64 w-full" role="img" aria-label="Gráfica de evolución de ventas">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 8, right: 12, left: -8, bottom: 0 }}>
                    <defs>
                      <linearGradient id="g-metric" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis
                      dataKey="bucket"
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) =>
                        metric === "units"
                          ? String(v)
                          : new Intl.NumberFormat("es-CO", {
                              notation: "compact",
                              maximumFractionDigits: 1,
                            }).format(v as number)
                      }
                      width={56}
                    />
                    <Tooltip
                      formatter={(v: number) => (metric === "units" ? v : cop(v))}
                      contentStyle={{
                        background: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey={metric}
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      fill="url(#g-metric)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>
        </section>

        {/* Detalle: top productos, mix de pagos, cajeros */}
        <ReportesDetail orgId={currentOrg?.id} from={range.from} to={range.to} />

        <p className="text-[11px] text-muted-foreground text-center">
          Exportaciones disponibles en Excel y CSV · Datos del rango seleccionado.
        </p>

      </div>
    </main>
  );
};

export default Reportes;
