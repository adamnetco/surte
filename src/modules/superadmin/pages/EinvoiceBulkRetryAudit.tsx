import { Skeleton } from "@/components/ui/skeleton";
/**
 * POS-einvoice-bulk-retry-hardening · Audit UI
 *
 * Vista de auditoría para superadmin: lista cada `idempotency_key` emitido por
 * `einvoice-resend-bulk-admin` con su estado derivado (running/truncated/
 * succeeded/failed) y el detalle por lote leído de `sync_logs`.
 *
 * Fuente única: `sync_logs` filtrado por service_name in
 *   ('einvoice_bulk_retry_admin', 'einvoice_bulk_retry_admin_idem').
 * No se introducen tablas nuevas — la idempotency_key vive dentro de
 * `payload.idempotency_key` y `payload.cached_response`.
 */
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ChevronDown,
  ChevronRight,
  History,
  Loader2,
  RefreshCw,
  Search,
} from "lucide-react";

const IDEM_SERVICE = "einvoice_bulk_retry_admin_idem";
const RUN_SERVICE = "einvoice_bulk_retry_admin";

type SyncLogRow = {
  id: string;
  organization_id: string | null;
  service_name: string;
  status: string | null;
  error_message: string | null;
  created_at: string;
  payload: any;
};

type RunStatus = "succeeded" | "failed" | "truncated" | "running" | "unknown";

interface RunBundle {
  idempotency_key: string;
  started_at: string;
  requested_by?: string | null;
  cached_response?: any;
  // Lotes agregados (uno por org dentro de la corrida).
  org_logs: SyncLogRow[];
  status: RunStatus;
  total_requeued: number;
  total_orgs: number;
  truncated: boolean;
  partial: boolean;
}

function deriveStatus(cached: any, org_logs: SyncLogRow[]): RunStatus {
  if (cached?.truncated) return "truncated";
  if (cached?.partial) return "failed";
  if (cached?.success && !cached?.partial) return "succeeded";
  // Sin cached_response (corrida en curso o truncada sin marker): inferir.
  if (org_logs.length === 0) return "running";
  if (org_logs.some((l) => l.payload?.truncated)) return "truncated";
  if (org_logs.some((l) => l.status === "error")) return "failed";
  return "running";
}

const statusVariant: Record<RunStatus, "default" | "destructive" | "secondary" | "outline"> = {
  succeeded: "default",
  failed: "destructive",
  truncated: "secondary",
  running: "outline",
  unknown: "outline",
};

const statusLabel: Record<RunStatus, string> = {
  succeeded: "succeeded",
  failed: "failed",
  truncated: "truncated",
  running: "running",
  unknown: "—",
};

export default function EinvoiceBulkRetryAudit() {
  const [hours, setHours] = useState(24);
  const [filter, setFilter] = useState("");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["bulk-retry-audit", hours],
    queryFn: async () => {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("sync_logs")
        .select("id, organization_id, service_name, status, error_message, created_at, payload")
        .in("service_name", [IDEM_SERVICE, RUN_SERVICE])
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as SyncLogRow[];
    },
  });

  // También necesitamos nombres de org para mostrar mejor.
  const { data: orgs } = useQuery({
    queryKey: ["bulk-retry-audit-orgs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id, name, slug");
      if (error) throw error;
      return data ?? [];
    },
  });

  const nameById = useMemo(() => {
    const m: Record<string, string> = {};
    (orgs ?? []).forEach((o: any) => { m[o.id] = o.name; });
    return m;
  }, [orgs]);

  // Agrupar por idempotency_key. Las filas org agregadas no traen idem_key
  // directamente; las asociamos por (requested_by + ventana ±5 min) o quedan
  // en grupo "_no_idem".
  const bundles = useMemo<RunBundle[]>(() => {
    if (!data) return [];
    const markers = data.filter((r) => r.service_name === IDEM_SERVICE);
    const orgRows = data.filter((r) => r.service_name === RUN_SERVICE);

    const byKey = new Map<string, RunBundle>();
    for (const m of markers) {
      const key: string | undefined = m.payload?.idempotency_key;
      if (!key) continue;
      const cached = m.payload?.cached_response ?? {};
      const requestedAtMs = new Date(m.created_at).getTime();
      const elapsed = cached.elapsed_ms ?? 0;
      const startedMs = requestedAtMs - elapsed;
      const associatedOrgLogs = orgRows.filter((o) => {
        const t = new Date(o.created_at).getTime();
        return (
          o.payload?.requested_by === m.payload?.requested_by &&
          t >= startedMs - 1000 &&
          t <= requestedAtMs + 1000
        );
      });
      byKey.set(key, {
        idempotency_key: key,
        started_at: new Date(startedMs).toISOString(),
        requested_by: m.payload?.requested_by ?? null,
        cached_response: cached,
        org_logs: associatedOrgLogs,
        status: deriveStatus(cached, associatedOrgLogs),
        total_requeued: cached.total_requeued ?? 0,
        total_orgs: cached.total_orgs ?? associatedOrgLogs.length,
        truncated: Boolean(cached.truncated),
        partial: Boolean(cached.partial),
      });
    }

    // Bucket "sin marker" — corridas sin idem_key o truncadas que no persistieron marker.
    const orphan = orgRows.filter((o) => {
      return !Array.from(byKey.values()).some((b) => b.org_logs.includes(o));
    });
    if (orphan.length > 0) {
      // Agrupar huérfanas por requested_by + minuto.
      const map = new Map<string, SyncLogRow[]>();
      for (const o of orphan) {
        const bucket = `${o.payload?.requested_by ?? "?"}|${o.created_at.slice(0, 16)}`;
        if (!map.has(bucket)) map.set(bucket, []);
        map.get(bucket)!.push(o);
      }
      for (const [bucket, rows] of map) {
        const truncated = rows.some((r) => r.payload?.truncated);
        const errored = rows.some((r) => r.status === "error");
        byKey.set(`_orphan_${bucket}`, {
          idempotency_key: `(sin idem · ${bucket.split("|")[1]})`,
          started_at: rows[rows.length - 1].created_at,
          requested_by: rows[0].payload?.requested_by ?? null,
          org_logs: rows,
          status: truncated ? "truncated" : errored ? "failed" : "succeeded",
          total_requeued: rows.reduce((s, r) => s + (r.payload?.requeued_count ?? 0), 0),
          total_orgs: rows.length,
          truncated,
          partial: truncated || errored,
        });
      }
    }

    const out = Array.from(byKey.values()).sort(
      (a, b) => +new Date(b.started_at) - +new Date(a.started_at),
    );
    if (!filter.trim()) return out;
    const f = filter.toLowerCase();
    return out.filter(
      (b) =>
        b.idempotency_key.toLowerCase().includes(f) ||
        (b.requested_by ?? "").toLowerCase().includes(f) ||
        b.status.includes(f),
    );
  }, [data, filter]);

  return (
    <div className="space-y-4">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <History className="h-5 w-5 text-primary" aria-hidden="true" />
          <h1 className="text-xl font-bold">Bulk retry · Auditoría</h1>
          <Badge variant="outline" className="ml-2">Superadmin</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Historial de cada <code>idempotency_key</code> emitido por el bulk retry DIAN, con su
          estado y el detalle por lote leído desde <code>sync_logs</code>.
        </p>
      </header>

      <Card className="p-4">
        <div className="grid gap-3 md:grid-cols-3 items-end">
          <div>
            <Label htmlFor="hours">Ventana (horas)</Label>
            <Input
              id="hours"
              type="number"
              min={1}
              max={168}
              value={hours}
              onChange={(e) => setHours(Math.max(1, Math.min(168, Number(e.target.value) || 24)))}
            />
          </div>
          <div className="md:col-span-1">
            <Label htmlFor="filter">Filtro</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
              <Input
                id="filter"
                placeholder="idem_key, requested_by o status…"
                className="pl-8"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
          </div>
          <div>
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching} className="w-full">
              {isFetching ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
              Refrescar
            </Button>
          </div>
        </div>
      </Card>

      <Card className="p-0 overflow-hidden">
        {isLoading && (
          <div className="p-6 text-sm text-muted-foreground flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Cargando auditoría…
          </div>
        )}
        {!isLoading && bundles.length === 0 && (
          <div className="p-6 text-sm text-muted-foreground">Sin corridas en la ventana seleccionada.</div>
        )}
        <ul className="divide-y" role="list">
          {bundles.map((b) => {
            const isOpen = !!expanded[b.idempotency_key];
            return (
              <li key={b.idempotency_key} className="text-sm">
                <button
                  type="button"
                  onClick={() => setExpanded((s) => ({ ...s, [b.idempotency_key]: !s[b.idempotency_key] }))}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/40 text-left"
                  aria-expanded={isOpen}
                >
                  {isOpen ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                  <div className="min-w-0 flex-1">
                    <p className="font-mono text-xs truncate">{b.idempotency_key}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {new Date(b.started_at).toLocaleString()} · {b.requested_by ?? "—"}
                    </p>
                  </div>
                  <Badge variant={statusVariant[b.status]} className="shrink-0">
                    {statusLabel[b.status]}
                  </Badge>
                  <Badge variant="outline" className="shrink-0">
                    {b.total_requeued} / {b.total_orgs} org
                  </Badge>
                </button>

                {isOpen && (
                  <div className="px-4 pb-4 space-y-3 bg-muted/20">
                    {b.cached_response?.results && (
                      <div className="text-xs text-muted-foreground">
                        elapsed: {(b.cached_response.elapsed_ms ?? 0)}ms ·
                        truncated: {String(b.truncated)} · partial: {String(b.partial)}
                      </div>
                    )}
                    <div className="divide-y rounded-md border bg-card">
                      {b.org_logs.length === 0 && (
                        <div className="p-3 text-xs text-muted-foreground">
                          Sin filas agregadas por org en <code>sync_logs</code> (corrida idempotente reutilizada).
                        </div>
                      )}
                      {b.org_logs.map((l) => {
                        const orgName = l.organization_id ? nameById[l.organization_id] ?? l.organization_id : "—";
                        const p = l.payload ?? {};
                        return (
                          <div key={l.id} className="px-3 py-2 text-xs">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-medium truncate">{orgName}</span>
                              <Badge
                                variant={l.status === "success" ? (p.truncated ? "secondary" : "outline") : "destructive"}
                              >
                                {l.status} · {p.requeued_count ?? 0}/{p.batches ?? 0} lotes
                              </Badge>
                            </div>
                            {l.error_message && (
                              <p className="text-destructive mt-1">{l.error_message}</p>
                            )}
                            <p className="text-muted-foreground mt-1">
                              batch_size={p.batch_size ?? "—"} · failed_batches={p.failed_batches ?? 0}
                              {p.last_processed_id ? <> · last_id <code className="font-mono">{String(p.last_processed_id).slice(0, 12)}</code></> : null}
                              {p.phase ? <> · phase=<code>{p.phase}</code></> : null}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
    </div>
  );
}
