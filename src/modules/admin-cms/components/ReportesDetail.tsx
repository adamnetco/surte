import { useMemo } from "react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Package, CreditCard, User2, TrendingUp } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useTopProducts,
  usePaymentMix,
  useCashierPerformance,
} from "../hooks/useSalesReport";

const cop = (n: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  }).format(n);

const PIE_COLORS = [
  "hsl(var(--primary))",
  "#76B833",
  "#F37021",
  "#0C4B83",
  "#A855F7",
  "#06B6D4",
  "#F59E0B",
  "#EF4444",
];

const METHOD_LABEL: Record<string, string> = {
  cash: "Efectivo",
  card: "Tarjeta",
  transfer: "Transferencia",
  nequi: "Nequi",
  daviplata: "Daviplata",
  credit: "Crédito",
  other: "Otro",
};

interface Props {
  orgId?: string | null;
  from: Date;
  to: Date;
}

function SectionHeader({ icon: Icon, title, subtitle }: { icon: any; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="h-8 w-8 rounded-md bg-primary/10 text-primary flex items-center justify-center">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <h2 className="text-sm font-semibold leading-none">{title}</h2>
        {subtitle && <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function EmptyMini({ label }: { label: string }) {
  return (
    <div className="py-8 text-center text-xs text-muted-foreground">
      <TrendingUp className="h-6 w-6 mx-auto opacity-30 mb-1" />
      {label}
    </div>
  );
}

function TopProductsCard({ orgId, from, to }: Props) {
  const { data, isLoading } = useTopProducts({ orgId, from, to, limit: 10 });
  const totalGross = useMemo(() => (data ?? []).reduce((s, p) => s + p.gross, 0), [data]);

  return (
    <Card className="p-4 border-border/60">
      <SectionHeader icon={Package} title="Top productos" subtitle="Por ingreso bruto" />
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyMini label="Sin ventas de productos" />
      ) : (
        <ul className="space-y-2" role="list">
          {data.map((p, i) => {
            const pct = totalGross > 0 ? (p.gross / totalGross) * 100 : 0;
            return (
              <li
                key={`${p.product_id ?? "x"}-${i}`}
                className="rounded-lg border border-border/60 p-3 hover:bg-muted/40 transition min-h-[56px]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-semibold text-muted-foreground w-5">
                        #{i + 1}
                      </span>
                      <p className="text-sm font-medium truncate">{p.product_name}</p>
                    </div>
                    {p.sku && (
                      <p className="text-[11px] text-muted-foreground ml-7">SKU: {p.sku}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold tabular-nums">{cop(p.gross)}</div>
                    <div className="text-[11px] text-muted-foreground tabular-nums">
                      {p.units.toLocaleString("es-CO")} und · {p.tickets} tickets
                    </div>
                  </div>
                </div>
                <div className="mt-2 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${pct.toFixed(1)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

function PaymentMixCard({ orgId, from, to }: Props) {
  const { data, isLoading } = usePaymentMix({ orgId, from, to });
  const total = useMemo(() => (data ?? []).reduce((s, p) => s + p.amount, 0), [data]);

  const chartData = useMemo(
    () =>
      (data ?? []).map((d) => ({
        name: METHOD_LABEL[d.method] ?? d.method,
        value: d.amount,
        count: d.count,
      })),
    [data],
  );

  return (
    <Card className="p-4 border-border/60">
      <SectionHeader icon={CreditCard} title="Mix de pagos" subtitle="Por método" />
      {isLoading ? (
        <Skeleton className="h-48 w-full" />
      ) : !data || data.length === 0 ? (
        <EmptyMini label="Sin pagos registrados" />
      ) : (
        <div className="space-y-4">
          <div className="h-40 w-full" role="img" aria-label="Distribución de métodos de pago">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={70}
                  paddingAngle={2}
                  stroke="hsl(var(--background))"
                  strokeWidth={2}
                >
                  {chartData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number) => cop(v)}
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <ul className="space-y-1.5" role="list">
            {chartData.map((d, i) => {
              const pct = total > 0 ? (d.value / total) * 100 : 0;
              return (
                <li key={d.name} className="flex items-center justify-between gap-2 text-xs">
                  <span className="inline-flex items-center gap-2 min-w-0">
                    <span
                      className="h-2.5 w-2.5 rounded-sm shrink-0"
                      style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                    />
                    <span className="truncate">{d.name}</span>
                    <span className="text-muted-foreground">({d.count})</span>
                  </span>
                  <span className="tabular-nums font-medium">
                    {cop(d.value)} <span className="text-muted-foreground">· {pct.toFixed(1)}%</span>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}

function CashierCard({ orgId, from, to }: Props) {
  const { data, isLoading } = useCashierPerformance({ orgId, from, to });
  const max = useMemo(
    () => Math.max(0, ...(data ?? []).map((c) => c.gross)),
    [data],
  );

  return (
    <Card className="p-4 border-border/60">
      <SectionHeader icon={User2} title="Desempeño por cajero" subtitle="Ranking por ventas brutas" />
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : !data || data.length === 0 ? (
        <EmptyMini label="Sin actividad de cajeros" />
      ) : (
        <ul className="space-y-2" role="list">
          {data.map((c) => {
            const initials = c.cashier_name
              .split(" ")
              .map((s) => s[0])
              .filter(Boolean)
              .slice(0, 2)
              .join("")
              .toUpperCase();
            const pct = max > 0 ? (c.gross / max) * 100 : 0;
            return (
              <li
                key={c.cashier_id ?? c.cashier_name}
                className="rounded-lg border border-border/60 p-3 hover:bg-muted/40 transition min-h-[56px]"
              >
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                    {initials || "??"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{c.cashier_name}</p>
                    <p className="text-[11px] text-muted-foreground tabular-nums">
                      {c.tickets} tickets · prom {cop(c.avg_ticket)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-semibold tabular-nums">{cop(c.gross)}</div>
                  </div>
                </div>
                <div className="mt-2 h-1.5 w-full bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full"
                    style={{ width: `${pct.toFixed(1)}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

export default function ReportesDetail({ orgId, from, to }: Props) {
  return (
    <section
      className="grid gap-3 grid-cols-1 lg:grid-cols-3"
      aria-label="Detalle de reportes"
    >
      <TopProductsCard orgId={orgId} from={from} to={to} />
      <PaymentMixCard orgId={orgId} from={from} to={to} />
      <CashierCard orgId={orgId} from={from} to={to} />
    </section>
  );
}
