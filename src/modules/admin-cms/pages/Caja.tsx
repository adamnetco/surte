import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Wallet,
  CreditCard,
  ArrowLeftRight,
  Coins,
  AlertTriangle,
  CheckCircle2,
  Clock,
  RefreshCw,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import AdminHeader from "@/modules/admin-cms/components/AdminHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Caja (Admin) — arqueos, saldos por medio de pago y cierres.
 *
 * Solo lectura: consume `cash_sessions` / `cash_movements` / `pos_payments`
 * siempre filtrando por `organization_id` (RLS + scope explícito), sin tocar
 * el flujo de apertura/cierre que vive en el POS.
 */

const COP = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  minimumFractionDigits: 0,
});

const RANGES = [
  { key: "today", label: "Hoy", days: 0 },
  { key: "7d", label: "7 días", days: 7 },
  { key: "30d", label: "30 días", days: 30 },
] as const;

type RangeKey = (typeof RANGES)[number]["key"];

function rangeStartISO(key: RangeKey): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const days = RANGES.find((r) => r.key === key)?.days ?? 0;
  if (days > 0) d.setDate(d.getDate() - days);
  return d.toISOString();
}

interface CashSessionRow {
  id: string;
  status: string;
  opened_at: string;
  closed_at: string | null;
  opening_amount: number | null;
  expected_amount: number | null;
  closing_amount: number | null;
  difference: number | null;
  total_sales: number | null;
  total_cash: number | null;
  total_card: number | null;
  total_transfer: number | null;
  total_other: number | null;
  ticket_count: number | null;
  notes: string | null;
}

function useCajaData(orgId: string | undefined, range: RangeKey) {
  return useQuery({
    queryKey: ["admin-caja", orgId, range],
    enabled: !!orgId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const since = rangeStartISO(range);

      const [sessionsRes, paymentsRes, movementsRes] = await Promise.all([
        supabase
          .from("cash_sessions")
          .select(
            "id,status,opened_at,closed_at,opening_amount,expected_amount,closing_amount,difference,total_sales,total_cash,total_card,total_transfer,total_other,ticket_count,notes",
          )
          .eq("organization_id", orgId!)
          .gte("opened_at", since)
          .order("opened_at", { ascending: false })
          .limit(100),
        supabase
          .from("pos_payments")
          .select("method,amount")
          .eq("organization_id", orgId!)
          .gte("created_at", since)
          .limit(5000),
        supabase
          .from("cash_movements")
          .select("movement_type,amount,concept,created_at")
          .eq("organization_id", orgId!)
          .gte("created_at", since)
          .order("created_at", { ascending: false })
          .limit(50),
      ]);

      if (sessionsRes.error) throw sessionsRes.error;
      if (paymentsRes.error) throw paymentsRes.error;
      if (movementsRes.error) throw movementsRes.error;

      const byMethod = new Map<string, { total: number; count: number }>();
      for (const p of paymentsRes.data ?? []) {
        const key = (p.method ?? "otro").toLowerCase();
        const prev = byMethod.get(key) ?? { total: 0, count: 0 };
        byMethod.set(key, { total: prev.total + Number(p.amount ?? 0), count: prev.count + 1 });
      }

      return {
        sessions: (sessionsRes.data ?? []) as CashSessionRow[],
        methods: Array.from(byMethod.entries())
          .map(([method, v]) => ({ method, ...v }))
          .sort((a, b) => b.total - a.total),
        movements: movementsRes.data ?? [],
      };
    },
  });
}

const METHOD_META: Record<string, { label: string; Icon: typeof Wallet }> = {
  cash: { label: "Efectivo", Icon: Wallet },
  efectivo: { label: "Efectivo", Icon: Wallet },
  card: { label: "Tarjeta", Icon: CreditCard },
  tarjeta: { label: "Tarjeta", Icon: CreditCard },
  transfer: { label: "Transferencia", Icon: ArrowLeftRight },
  transferencia: { label: "Transferencia", Icon: ArrowLeftRight },
};

const CajaAdmin = () => {
  const { activeOrgId } = useOrganization();
  const [range, setRange] = useState<RangeKey>("today");
  const { data, isLoading, error, refetch, isRefetching } = useCajaData(activeOrgId, range);

  const totals = useMemo(() => {
    const sessions = data?.sessions ?? [];
    const open = sessions.filter((s) => s.status === "open");
    const closed = sessions.filter((s) => s.status !== "open");
    const diff = closed.reduce((acc, s) => acc + Number(s.difference ?? 0), 0);
    const sales = sessions.reduce((acc, s) => acc + Number(s.total_sales ?? 0), 0);
    const tickets = sessions.reduce((acc, s) => acc + Number(s.ticket_count ?? 0), 0);
    return { openCount: open.length, closedCount: closed.length, diff, sales, tickets };
  }, [data?.sessions]);

  return (
    <div className="min-h-dvh bg-background pb-20">
      <AdminHeader />

      <main className="px-3 pt-4 space-y-4 max-w-7xl mx-auto">
        <section aria-labelledby="caja-title" className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 id="caja-title" className="font-heading font-bold text-lg">
                Caja
              </h2>
              <p className="text-xs text-muted-foreground">
                Arqueos, saldos por medio de pago y cierres
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              aria-label="Actualizar datos de caja"
              className="h-11"
            >
              <RefreshCw size={16} className={cn(isRefetching && "animate-spin")} />
            </Button>
          </div>

          <div role="tablist" aria-label="Rango de fechas" className="flex gap-2">
            {RANGES.map((r) => (
              <button
                key={r.key}
                role="tab"
                aria-selected={range === r.key}
                onClick={() => setRange(r.key)}
                className={cn(
                  "min-h-11 px-4 rounded-lg border text-sm font-medium transition-colors",
                  range === r.key
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-foreground border-border hover:bg-accent",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
        </section>

        {error ? (
          <EmptyState
            icon={AlertTriangle}
            title="No se pudo cargar la caja"
            description={(error as Error).message}
          />
        ) : isLoading ? (
          <div className="space-y-3">
            <Skeleton className="h-24 w-full rounded-lg" />
            <Skeleton className="h-40 w-full rounded-lg" />
            <Skeleton className="h-40 w-full rounded-lg" />
          </div>
        ) : (
          <>
            <section aria-label="Resumen de caja" className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <article className="rounded-lg border border-border bg-card p-3">
                <p className="text-[11px] text-muted-foreground font-medium">Ventas del rango</p>
                <p className="text-lg font-bold tabular-nums">{COP.format(totals.sales)}</p>
                <p className="text-[11px] text-muted-foreground">{totals.tickets} tickets</p>
              </article>
              <article className="rounded-lg border border-border bg-card p-3">
                <p className="text-[11px] text-muted-foreground font-medium">Cajas abiertas</p>
                <p className="text-lg font-bold tabular-nums">{totals.openCount}</p>
                <p className="text-[11px] text-muted-foreground">{totals.closedCount} cerradas</p>
              </article>
              <article className="rounded-lg border border-border bg-card p-3">
                <p className="text-[11px] text-muted-foreground font-medium">Descuadre acumulado</p>
                <p
                  className={cn(
                    "text-lg font-bold tabular-nums",
                    Math.abs(totals.diff) > 0 ? "text-destructive" : "text-foreground",
                  )}
                >
                  {COP.format(totals.diff)}
                </p>
                <p className="text-[11px] text-muted-foreground">sobre cajas cerradas</p>
              </article>
              <article className="rounded-lg border border-border bg-card p-3">
                <p className="text-[11px] text-muted-foreground font-medium">Movimientos</p>
                <p className="text-lg font-bold tabular-nums">{data?.movements.length ?? 0}</p>
                <p className="text-[11px] text-muted-foreground">entradas / salidas</p>
              </article>
            </section>

            <section aria-labelledby="caja-methods" className="space-y-2">
              <h3 id="caja-methods" className="font-heading font-semibold text-sm">
                Saldos por medio de pago
              </h3>
              {(data?.methods.length ?? 0) === 0 ? (
                <EmptyState
                  icon={Coins}
                  title="Sin pagos registrados"
                  description="No hay pagos en el rango seleccionado."
                />
              ) : (
                <ul role="list" className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {data!.methods.map((m) => {
                    const meta = METHOD_META[m.method] ?? { label: m.method, Icon: Coins };
                    const { Icon } = meta;
                    return (
                      <li
                        key={m.method}
                        className="rounded-lg border border-border bg-card p-3 flex items-center gap-3"
                      >
                        <Icon size={18} className="text-muted-foreground shrink-0" aria-hidden />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{meta.label}</p>
                          <p className="text-[11px] text-muted-foreground">{m.count} pagos</p>
                        </div>
                        <p className="text-sm font-bold tabular-nums">{COP.format(m.total)}</p>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            <section aria-labelledby="caja-sessions" className="space-y-2">
              <h3 id="caja-sessions" className="font-heading font-semibold text-sm">
                Arqueos y cierres
              </h3>
              {(data?.sessions.length ?? 0) === 0 ? (
                <EmptyState
                  icon={Clock}
                  title="Sin cajas en el rango"
                  description="Abre una caja desde el POS para ver arqueos aquí."
                />
              ) : (
                <ul role="list" className="space-y-2">
                  {data!.sessions.map((s) => {
                    const isOpen = s.status === "open";
                    const diff = Number(s.difference ?? 0);
                    return (
                      <li
                        key={s.id}
                        className="rounded-lg border border-border bg-card p-3 space-y-2"
                      >
                        <div className="flex items-center gap-2">
                          {isOpen ? (
                            <Clock size={16} className="text-amber-600 shrink-0" aria-hidden />
                          ) : (
                            <CheckCircle2
                              size={16}
                              className="text-emerald-600 shrink-0"
                              aria-hidden
                            />
                          )}
                          <p className="text-sm font-medium flex-1 min-w-0 truncate">
                            {isOpen ? "Caja abierta" : "Caja cerrada"} ·{" "}
                            {new Date(s.opened_at).toLocaleString("es-CO", {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </p>
                          <span className="text-[11px] text-muted-foreground">
                            {s.ticket_count ?? 0} tickets
                          </span>
                        </div>

                        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                          <div>
                            <dt className="text-muted-foreground">Base</dt>
                            <dd className="font-semibold tabular-nums">
                              {COP.format(Number(s.opening_amount ?? 0))}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">Esperado</dt>
                            <dd className="font-semibold tabular-nums">
                              {COP.format(Number(s.expected_amount ?? 0))}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">Contado</dt>
                            <dd className="font-semibold tabular-nums">
                              {isOpen ? "—" : COP.format(Number(s.closing_amount ?? 0))}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-muted-foreground">Diferencia</dt>
                            <dd
                              className={cn(
                                "font-semibold tabular-nums",
                                !isOpen && diff !== 0 ? "text-destructive" : "",
                              )}
                            >
                              {isOpen ? "—" : COP.format(diff)}
                              {!isOpen && diff !== 0 && (
                                <span className="sr-only"> descuadre detectado</span>
                              )}
                            </dd>
                          </div>
                        </dl>

                        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                          <span>Efectivo {COP.format(Number(s.total_cash ?? 0))}</span>
                          <span>Tarjeta {COP.format(Number(s.total_card ?? 0))}</span>
                          <span>Transf. {COP.format(Number(s.total_transfer ?? 0))}</span>
                          <span>Otros {COP.format(Number(s.total_other ?? 0))}</span>
                        </div>

                        {s.notes && (
                          <p className="text-[11px] text-muted-foreground border-t border-border pt-2">
                            {s.notes}
                          </p>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>

            {(data?.movements.length ?? 0) > 0 && (
              <section aria-labelledby="caja-movs" className="space-y-2">
                <h3 id="caja-movs" className="font-heading font-semibold text-sm">
                  Últimos movimientos de efectivo
                </h3>
                <ul role="list" className="space-y-1">
                  {data!.movements.map((m, i) => (
                    <li
                      key={`${m.created_at}-${i}`}
                      className="rounded-lg border border-border bg-card px-3 py-2 flex items-center gap-2 text-xs"
                    >
                      <span className="flex-1 min-w-0 truncate">
                        {m.concept || m.movement_type}
                      </span>
                      <span className="text-muted-foreground">{m.movement_type}</span>
                      <span className="font-semibold tabular-nums">
                        {COP.format(Number(m.amount ?? 0))}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default CajaAdmin;
