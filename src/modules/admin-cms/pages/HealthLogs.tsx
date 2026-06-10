/**
 * HealthLogs — panel admin de eventos de salud (printer/core/wp/sites).
 *
 * Permite auditar reintentos y caídas con correlation_id para vincular
 * eventos del mismo intento. Realtime opcional: nuevos eventos aparecen
 * en vivo gracias a la suscripción a la tabla `health_events`.
 */
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Activity, Printer, Globe, Database, RefreshCw, Copy, Download, Loader2, AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import AppBreadcrumb from "@/components/AppBreadcrumb";
import { cn } from "@/lib/utils";

type EventRow = {
  id: string;
  organization_id: string | null;
  source: "printer" | "core" | "wordpress" | "sites" | "session";
  status: string;
  prev_status: string | null;
  latency_ms: number | null;
  message: string | null;
  correlation_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

const SOURCE_META: Record<EventRow["source"], { icon: typeof Printer; label: string }> = {
  printer:   { icon: Printer,  label: "Impresora" },
  core:      { icon: Database, label: "Core" },
  wordpress: { icon: Globe,    label: "WordPress" },
  sites:     { icon: Globe,    label: "Sitios" },
  session:   { icon: Activity, label: "Sesión" },
};

const STATUS_TONE: Record<string, string> = {
  ok: "bg-emerald-500/15 text-emerald-700 border-emerald-500/30",
  warn: "bg-amber-500/15 text-amber-700 border-amber-500/30",
  off: "bg-destructive/15 text-destructive border-destructive/30",
  error: "bg-destructive/15 text-destructive border-destructive/30",
  idle: "bg-muted text-muted-foreground border-border",
};

function tone(s: string) {
  return STATUS_TONE[s] ?? STATUS_TONE.idle;
}

function fmt(ts: string) {
  const d = new Date(ts);
  return d.toLocaleString("es-CO", { dateStyle: "short", timeStyle: "medium" });
}

export default function HealthLogs() {
  const { currentOrg } = useOrganization();
  const [rows, setRows] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sourceFilter, setSourceFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [detail, setDetail] = useState<EventRow | null>(null);

  useEffect(() => { document.title = "Logs de salud · SistecPOS"; }, []);

  const load = async () => {
    if (!currentOrg) return;
    setLoading(true);
    let q = supabase
      .from("health_events")
      .select("*")
      .eq("organization_id", currentOrg.id)
      .order("created_at", { ascending: false })
      .limit(200);
    const { data, error } = await q;
    if (error) toast.error(error.message);
    setRows((data ?? []) as EventRow[]);
    setLoading(false);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [currentOrg?.id]);

  // Realtime
  useEffect(() => {
    if (!currentOrg) return;
    const ch = supabase
      .channel(`health_events:${currentOrg.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "health_events", filter: `organization_id=eq.${currentOrg.id}` },
        (payload) => setRows((prev) => [payload.new as EventRow, ...prev].slice(0, 200)),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [currentOrg?.id]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (sourceFilter !== "all" && r.source !== sourceFilter) return false;
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (term && !(r.correlation_id ?? "").toLowerCase().includes(term)
              && !(r.message ?? "").toLowerCase().includes(term)) return false;
      return true;
    });
  }, [rows, sourceFilter, statusFilter, search]);

  const exportCsv = () => {
    const header = ["created_at","source","status","prev_status","latency_ms","correlation_id","message"];
    const lines = [header.join(",")].concat(
      filtered.map((r) => [
        r.created_at, r.source, r.status, r.prev_status ?? "",
        r.latency_ms ?? "", r.correlation_id ?? "", (r.message ?? "").replace(/"/g, '""'),
      ].map((c) => `"${c}"`).join(",")),
    );
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `health-events-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!currentOrg) {
    return (
      <main className="min-h-[100dvh] grid place-items-center p-6">
        <div className="text-center space-y-2">
          <AlertCircle className="h-8 w-8 mx-auto text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Selecciona una organización para ver sus logs.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-[100dvh] bg-background">
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        <AppBreadcrumb currentLabel="Logs de salud" />

        <header className="flex items-end justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Activity className="h-5 w-5 text-primary" aria-hidden />
              Logs de salud
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Eventos de impresora, core (Supabase), WordPress y sitios.
            </p>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={load} disabled={loading} aria-label="Recargar">
              {loading ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" aria-hidden />
                       : <RefreshCw className="h-3.5 w-3.5 mr-1" aria-hidden />}
              Recargar
            </Button>
            <Button size="sm" variant="outline" onClick={exportCsv} disabled={!filtered.length} aria-label="Exportar CSV">
              <Download className="h-3.5 w-3.5 mr-1" aria-hidden /> CSV
            </Button>
          </div>
        </header>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Filtros</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-3">
            <Select value={sourceFilter} onValueChange={setSourceFilter}>
              <SelectTrigger aria-label="Filtrar por origen"><SelectValue placeholder="Origen" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los orígenes</SelectItem>
                {Object.entries(SOURCE_META).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger aria-label="Filtrar por estado"><SelectValue placeholder="Estado" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los estados</SelectItem>
                <SelectItem value="ok">OK</SelectItem>
                <SelectItem value="warn">Warn</SelectItem>
                <SelectItem value="off">Off</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="idle">Idle</SelectItem>
              </SelectContent>
            </Select>
            <Input
              placeholder="Buscar correlation_id o mensaje"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="md:col-span-2"
              aria-label="Buscar"
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0 overflow-hidden">
            {loading && rows.length === 0 ? (
              <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-16 text-sm text-muted-foreground" role="status">
                Sin eventos para los filtros actuales.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50 text-xs uppercase text-muted-foreground">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium">Fecha</th>
                      <th className="text-left px-3 py-2 font-medium">Origen</th>
                      <th className="text-left px-3 py-2 font-medium">Cambio</th>
                      <th className="text-left px-3 py-2 font-medium">Latencia</th>
                      <th className="text-left px-3 py-2 font-medium">Correlation</th>
                      <th className="text-left px-3 py-2 font-medium">Mensaje</th>
                      <th className="px-3 py-2"><span className="sr-only">Acciones</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((r) => {
                      const Meta = SOURCE_META[r.source] ?? SOURCE_META.session;
                      const Icon = Meta.icon;
                      return (
                        <tr key={r.id} className="border-t hover:bg-muted/30">
                          <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">{fmt(r.created_at)}</td>
                          <td className="px-3 py-2">
                            <span className="inline-flex items-center gap-1.5 text-xs">
                              <Icon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden /> {Meta.label}
                            </span>
                          </td>
                          <td className="px-3 py-2">
                            <span className="inline-flex items-center gap-1 text-xs">
                              {r.prev_status && (
                                <Badge variant="outline" className={cn("font-normal", tone(r.prev_status))}>{r.prev_status}</Badge>
                              )}
                              <span className="text-muted-foreground">→</span>
                              <Badge variant="outline" className={cn("font-normal", tone(r.status))}>{r.status}</Badge>
                            </span>
                          </td>
                          <td className="px-3 py-2 text-xs tabular-nums">
                            {r.latency_ms != null ? `${r.latency_ms} ms` : "—"}
                          </td>
                          <td className="px-3 py-2">
                            {r.correlation_id ? (
                              <button
                                type="button"
                                onClick={() => {
                                  navigator.clipboard.writeText(r.correlation_id!);
                                  toast.success("Correlation ID copiado");
                                }}
                                className="inline-flex items-center gap-1 font-mono text-[11px] text-muted-foreground hover:text-foreground"
                                aria-label={`Copiar correlation id ${r.correlation_id}`}
                              >
                                {r.correlation_id.slice(0, 8)}… <Copy className="h-3 w-3" aria-hidden />
                              </button>
                            ) : "—"}
                          </td>
                          <td className="px-3 py-2 text-xs max-w-[300px] truncate">{r.message ?? "—"}</td>
                          <td className="px-3 py-2 text-right">
                            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setDetail(r)}>
                              Detalle
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          Mostrando {filtered.length} de {rows.length} eventos · Realtime activo
        </p>
      </div>

      <Sheet open={!!detail} onOpenChange={(o) => !o && setDetail(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader><SheetTitle>Detalle del evento</SheetTitle></SheetHeader>
          {detail && (
            <div className="mt-4 space-y-3 text-sm">
              <dl className="grid grid-cols-2 gap-y-1.5 text-xs">
                <dt className="text-muted-foreground">Fecha</dt><dd>{fmt(detail.created_at)}</dd>
                <dt className="text-muted-foreground">Origen</dt><dd>{SOURCE_META[detail.source]?.label}</dd>
                <dt className="text-muted-foreground">Estado</dt>
                <dd><Badge variant="outline" className={tone(detail.status)}>{detail.status}</Badge></dd>
                <dt className="text-muted-foreground">Anterior</dt><dd>{detail.prev_status ?? "—"}</dd>
                <dt className="text-muted-foreground">Latencia</dt><dd>{detail.latency_ms != null ? `${detail.latency_ms} ms` : "—"}</dd>
                <dt className="text-muted-foreground">Correlation</dt>
                <dd className="font-mono break-all text-[11px]">{detail.correlation_id ?? "—"}</dd>
              </dl>
              {detail.message && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">Mensaje</p>
                  <p className="text-sm bg-muted rounded p-2">{detail.message}</p>
                </div>
              )}
              <div>
                <p className="text-xs text-muted-foreground mb-1">Metadata</p>
                <pre className="text-[11px] bg-muted rounded p-2 overflow-x-auto">
{JSON.stringify(detail.metadata ?? {}, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>
    </main>
  );
}
