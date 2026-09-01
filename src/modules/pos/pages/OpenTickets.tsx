/**
 * Tickets Abiertos — pantalla operativa que lista los tickets suspendidos
 * (`parked_tickets`) con su estado y el stock en tiempo real de cada producto
 * comprometido.
 *
 * Capa de presentación pura: consume los puertos
 * `IParkedTicketRepository` e `IStockWatchRepository` mediante sus adaptadores;
 * no habla con Supabase directamente.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle, ArrowLeft, CheckCircle2, Loader2, PauseCircle,
  Package, RefreshCw, Search, User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { supabaseParkedTicketRepository } from "@/infrastructure/database/SupabaseParkedTicketRepository";
import { supabaseStockWatchRepository } from "@/infrastructure/database/SupabaseStockWatchRepository";
import type { ParkedTicketRow } from "@/core/ports/IParkedTicketRepository";
import type { StockSnapshot } from "@/core/ports/IStockWatchRepository";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const COP = (n: number) =>
  new Intl.NumberFormat("es-CO", {
    style: "currency", currency: "COP", maximumFractionDigits: 0,
  }).format(n || 0);

function relativeTime(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "hace un momento";
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `hace ${hrs} h`;
  return `hace ${Math.round(hrs / 24)} d`;
}

type TicketStatus = "ok" | "short" | "unknown";

export default function OpenTickets() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id ?? "";

  const [rows, setRows] = useState<ParkedTicketRow[]>([]);
  const [stock, setStock] = useState<Record<string, StockSnapshot>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState("");

  useEffect(() => { document.title = "Tickets abiertos · SistecPOS"; }, []);

  const load = useCallback(async (silent = false) => {
    if (!orgId) return;
    if (!silent) setRefreshing(true);
    try {
      const tickets = await supabaseParkedTicketRepository.list(orgId);
      setRows(tickets);
      const ids = Array.from(
        new Set(tickets.flatMap((t) => (t.items ?? []).map((i) => i.productId).filter(Boolean))),
      );
      const snaps = await supabaseStockWatchRepository.getStock(orgId, ids);
      setStock(Object.fromEntries(snaps.map((s) => [s.id, s])));
    } catch (e) {
      toast.error("No se pudo cargar los tickets abiertos", {
        description: e instanceof Error ? e.message : undefined,
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orgId]);

  useEffect(() => { void load(true); }, [load]);

  // Realtime: tickets y stock.
  useEffect(() => {
    if (!orgId) return;
    const offTickets = supabaseParkedTicketRepository.subscribe(orgId, () => void load(true));
    const offStock = supabaseStockWatchRepository.subscribe(orgId, () => void load(true));
    return () => { offTickets(); offStock(); };
  }, [orgId, load]);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return rows;
    return rows.filter((r) =>
      [r.label, r.customer_name, r.notes].filter(Boolean).join(" ").toLowerCase().includes(term)
      || (r.items ?? []).some((i) => (i.name ?? "").toLowerCase().includes(term)),
    );
  }, [rows, q]);

  const statusOf = (row: ParkedTicketRow): TicketStatus => {
    const items = row.items ?? [];
    if (items.length === 0) return "unknown";
    let known = false;
    for (const it of items) {
      const snap = stock[it.productId];
      if (!snap) continue;
      known = true;
      if (snap.stock < it.quantity) return "short";
    }
    return known ? "ok" : "unknown";
  };

  const totals = useMemo(() => ({
    count: filtered.length,
    amount: filtered.reduce((a, r) => a + (r.total ?? 0), 0),
    shortages: filtered.filter((r) => statusOf(r) === "short").length,
  }), [filtered, stock]);

  const goToPos = (row: ParkedTicketRow) => {
    navigate("/pos/vender");
    // El sheet de suspendidas escucha este evento al montarse el workspace.
    window.setTimeout(() => window.dispatchEvent(new Event("pos:open-parked")), 900);
    toast.info(`Retoma "${row.label || row.customer_name || "ticket"}" desde suspendidas`);
  };

  return (
    <main className="min-h-dvh bg-background">
      <div className="mx-auto max-w-7xl px-4 py-4 space-y-4">
        <header className="flex flex-wrap items-center gap-3">
          <Button variant="ghost" size="icon" aria-label="Volver al POS" onClick={() => navigate("/pos/vender")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1 min-w-[220px]">
            <h1 className="text-lg font-semibold flex items-center gap-2">
              <PauseCircle className="h-5 w-5 text-primary" /> Tickets abiertos
            </h1>
            <p className="text-xs text-muted-foreground">
              Estado y stock en tiempo real de los tickets suspendidos.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={refreshing}>
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            <span className="ml-2">Actualizar</span>
          </Button>
        </header>

        <section aria-label="Resumen" className="grid grid-cols-3 gap-3">
          {[
            { label: "Tickets", value: String(totals.count) },
            { label: "Valor retenido", value: COP(totals.amount) },
            { label: "Con faltante", value: String(totals.shortages) },
          ].map((c) => (
            <div key={c.label} className="rounded-lg border border-border bg-card p-3">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="text-base font-semibold tabular-nums">{c.value}</p>
            </div>
          ))}
        </section>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por etiqueta, cliente, nota o producto…"
            aria-label="Buscar tickets abiertos"
            className="pl-9 h-11"
          />
        </div>

        {loading ? (
          <div className="space-y-3" aria-busy="true" aria-label="Cargando tickets">
            {[0, 1, 2].map((i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div role="status" className="rounded-lg border border-dashed border-border py-16 text-center">
            <PauseCircle className="mx-auto h-10 w-10 text-muted-foreground" />
            <h2 className="mt-2 text-sm font-medium">Sin tickets abiertos</h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Los tickets que suspendas en el POS aparecerán aquí.
            </p>
          </div>
        ) : (
          <ul role="list" className="grid gap-3 md:grid-cols-2">
            {filtered.map((row) => {
              const status = statusOf(row);
              const items = row.items ?? [];
              return (
                <li key={row.id} className="rounded-lg border border-border bg-card p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        {row.label || row.customer_name || "Ticket sin etiqueta"}
                      </p>
                      <p className="text-xs text-muted-foreground flex items-center gap-2">
                        {row.customer_name && (
                          <span className="inline-flex items-center gap-1">
                            <User className="h-3 w-3" />{row.customer_name}
                          </span>
                        )}
                        <span>{relativeTime(row.created_at)}</span>
                        {row.cashier_id === user?.id && <span>· mío</span>}
                      </p>
                    </div>
                    <Badge
                      variant={status === "short" ? "destructive" : status === "ok" ? "secondary" : "outline"}
                      className="shrink-0 gap-1"
                    >
                      {status === "short" ? <AlertTriangle className="h-3 w-3" />
                        : status === "ok" ? <CheckCircle2 className="h-3 w-3" />
                        : <Package className="h-3 w-3" />}
                      {status === "short" ? "Stock insuficiente" : status === "ok" ? "Disponible" : "Sin datos"}
                    </Badge>
                  </div>

                  <ul role="list" className="mt-2 divide-y divide-border/60">
                    {items.slice(0, 6).map((it, idx) => {
                      const snap = stock[it.productId];
                      const short = snap ? snap.stock < it.quantity : false;
                      return (
                        <li key={`${it.productId}-${idx}`} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                          <span className="truncate">
                            <span className="tabular-nums text-muted-foreground">{it.quantity}×</span>{" "}
                            {it.name || snap?.name || it.productId.slice(0, 8)}
                          </span>
                          <span className={cn("text-xs tabular-nums", short ? "text-destructive font-medium" : "text-muted-foreground")}>
                            {snap ? `stock ${snap.stock}${snap.unit ? ` ${snap.unit}` : ""}` : "sin dato"}
                          </span>
                        </li>
                      );
                    })}
                    {items.length > 6 && (
                      <li className="py-1.5 text-xs text-muted-foreground">
                        +{items.length - 6} ítems más
                      </li>
                    )}
                  </ul>

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold tabular-nums">{COP(row.total)}</span>
                    <Button size="sm" onClick={() => goToPos(row)}>Retomar en POS</Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
