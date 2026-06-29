// Ola 27-bis · Slice C — Inspector y reimpresión de trabajos de impresión.
// Lista los últimos print_jobs del tenant con filtros básicos por estado y
// permite reimprimir cualquiera dejando registro en parent_job_id.
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Printer, RefreshCw, RotateCcw, FileText, Route, Sparkles } from "lucide-react";

interface Props { organizationId: string }

interface RoutingRuleRef { rule_id: string | null; source: string; priority: number | null }
interface RoutingInfo { source?: string; rules?: RoutingRuleRef[] }
interface PrintJobRow {
  id: string;
  printer_id: string | null;
  pos_order_id: string | null;
  kind: string;
  status: string;
  attempts: number;
  copies: number;
  last_error: string | null;
  created_at: string;
  processed_at: string | null;
  parent_job_id: string | null;
  template_id: string | null;
  channel: string | null;
  reprint_count: number | null;
  reprint_reason: string | null;
  payload: { routing?: RoutingInfo; station_name?: string } | null;
}

const SOURCE_LABEL: Record<string, { label: string; cls: string }> = {
  product: { label: "Producto", cls: "bg-violet-500/15 text-violet-700 border-violet-300" },
  category: { label: "Categoría", cls: "bg-indigo-500/15 text-indigo-700 border-indigo-300" },
  station: { label: "Estación", cls: "bg-cyan-500/15 text-cyan-700 border-cyan-300" },
  station_default: { label: "Estación (default)", cls: "bg-slate-500/15 text-slate-700 border-slate-300" },
  default_receipt: { label: "Recibo default", cls: "bg-slate-500/15 text-slate-700 border-slate-300" },
};

const STATUS_COLORS: Record<string, string> = {
  queued: "bg-amber-500/15 text-amber-700 border-amber-300",
  printing: "bg-blue-500/15 text-blue-700 border-blue-300",
  done: "bg-emerald-500/15 text-emerald-700 border-emerald-300",
  failed: "bg-rose-500/15 text-rose-700 border-rose-300",
};

const fmtDate = (s: string) => new Date(s).toLocaleString("es-CO", { dateStyle: "short", timeStyle: "medium" });

export function PrintJobsInspectorTab({ organizationId }: Props) {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<PrintJobRow | null>(null);
  const [reprintTarget, setReprintTarget] = useState<PrintJobRow | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const { data: printers } = useQuery({
    queryKey: ["admin-printers-min", organizationId],
    enabled: !!organizationId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("printers")
        .select("id,name,connection")
        .eq("organization_id", organizationId);
      return (data ?? []) as Array<{ id: string; name: string; connection: string }>;
    },
  });

  const { data: jobs, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["admin-print-jobs", organizationId, statusFilter],
    enabled: !!organizationId,
    refetchInterval: 10000,
    queryFn: async () => {
      let q = (supabase as any)
        .from("print_jobs")
        .select("id,printer_id,pos_order_id,kind,status,attempts,copies,last_error,created_at,processed_at,parent_job_id,template_id,channel,reprint_count,reprint_reason,payload")
        .eq("organization_id", organizationId)
        .order("created_at", { ascending: false })
        .limit(150);
      if (statusFilter !== "all") q = q.eq("status", statusFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as PrintJobRow[];
    },
  });

  const printerName = (id: string | null) =>
    !id ? "—" : printers?.find((p) => p.id === id)?.name ?? id.slice(0, 8);

  const filtered = useMemo(() => {
    if (!jobs) return [];
    const s = search.trim().toLowerCase();
    if (!s) return jobs;
    return jobs.filter((j) =>
      [j.id, j.pos_order_id ?? "", j.kind, j.channel ?? "", j.last_error ?? ""]
        .some((v) => v.toLowerCase().includes(s)),
    );
  }, [jobs, search]);

  const handleReprint = async (printerId: string | null) => {
    if (!reprintTarget) return;
    setSubmitting(true);
    try {
      const { error } = await (supabase as any).rpc("print_job_reprint", {
        _job_id: reprintTarget.id,
        _reason: reason.trim() || null,
        _printer_id: printerId,
      });
      if (error) throw error;
      toast.success("Reimpresión encolada");
      setReprintTarget(null);
      setReason("");
      qc.invalidateQueries({ queryKey: ["admin-print-jobs", organizationId] });
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo reimprimir");
    } finally {
      setSubmitting(false);
    }
  };

  const stats = useMemo(() => {
    const total = jobs?.length ?? 0;
    const failed = jobs?.filter((j) => j.status === "failed").length ?? 0;
    const queued = jobs?.filter((j) => j.status === "queued" || j.status === "printing").length ?? 0;
    const reprints = jobs?.filter((j) => j.parent_job_id).length ?? 0;
    return { total, failed, queued, reprints };
  }, [jobs]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Trabajos (últimos 150)" value={stats.total} />
        <StatCard label="En cola" value={stats.queued} tone="amber" />
        <StatCard label="Fallidos" value={stats.failed} tone="rose" />
        <StatCard label="Reimpresiones" value={stats.reprints} tone="blue" />
      </div>

      <Card className="rounded-lg border-gray-100">
        <CardHeader className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Printer className="w-4 h-4" /> Inspector de impresión
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              Historial reciente con reimpresión auditada por usuario y razón.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              placeholder="Buscar id, pedido, error…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="h-9 w-56"
            />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="queued">En cola</SelectItem>
                <SelectItem value="printing">Imprimiendo</SelectItem>
                <SelectItem value="done">OK</SelectItem>
                <SelectItem value="failed">Fallidos</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isFetching ? "animate-spin" : ""}`} /> Actualizar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : filtered.length === 0 ? (
            <div className="text-sm text-muted-foreground py-12 text-center">Sin trabajos para los filtros actuales.</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filtered.map((j) => {
                const routing = j.payload?.routing;
                const sources = Array.from(new Set((routing?.rules ?? []).map((r) => r.source).concat(routing?.source ? [routing.source] : [])));
                return (
                <li key={j.id} className="py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={STATUS_COLORS[j.status] ?? ""}>{j.status}</Badge>
                      <span className="text-sm font-medium">{j.kind}</span>
                      {j.channel && <Badge variant="secondary" className="text-xs">{j.channel}</Badge>}
                      {sources.map((s) => {
                        const meta = SOURCE_LABEL[s] ?? { label: s, cls: "" };
                        return (
                          <Badge key={s} variant="outline" className={`text-xs ${meta.cls}`}>
                            <Route className="w-3 h-3 mr-1" /> {meta.label}
                          </Badge>
                        );
                      })}
                      {j.parent_job_id && <Badge variant="outline" className="text-xs"><RotateCcw className="w-3 h-3 mr-1" />reimp #{j.reprint_count ?? 1}</Badge>}
                      <span className="text-xs text-muted-foreground">{printerName(j.printer_id)} · {j.copies} copia(s) · {j.attempts} intento(s)</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">
                      {fmtDate(j.created_at)} · id <code className="text-[10px]">{j.id.slice(0, 8)}</code>
                      {j.last_error && <span className="text-rose-600 ml-2">· {j.last_error}</span>}
                    </div>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setSelected(j)}><FileText className="w-3.5 h-3.5" /></Button>
                  <Button variant="outline" size="sm" onClick={() => { setReprintTarget(j); setReason(""); }}>
                    <RotateCcw className="w-3.5 h-3.5 mr-1" /> Reimprimir
                  </Button>
                </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      {/* Detalle */}
      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Detalle del trabajo</DialogTitle>
            <DialogDescription>Información completa registrada en la cola.</DialogDescription>
          </DialogHeader>
          {selected && (
            <dl className="text-sm grid grid-cols-3 gap-y-1.5">
              <dt className="text-muted-foreground">ID</dt><dd className="col-span-2 font-mono text-xs break-all">{selected.id}</dd>
              <dt className="text-muted-foreground">Estado</dt><dd className="col-span-2">{selected.status}</dd>
              <dt className="text-muted-foreground">Tipo</dt><dd className="col-span-2">{selected.kind}</dd>
              <dt className="text-muted-foreground">Canal</dt><dd className="col-span-2">{selected.channel ?? "—"}</dd>
              <dt className="text-muted-foreground">Impresora</dt><dd className="col-span-2">{printerName(selected.printer_id)}</dd>
              <dt className="text-muted-foreground">Pedido</dt><dd className="col-span-2 font-mono text-xs">{selected.pos_order_id ?? "—"}</dd>
              <dt className="text-muted-foreground">Plantilla</dt><dd className="col-span-2 font-mono text-xs">{selected.template_id ?? "—"}</dd>
              <dt className="text-muted-foreground">Padre</dt><dd className="col-span-2 font-mono text-xs">{selected.parent_job_id ?? "—"}</dd>
              <dt className="text-muted-foreground">Reimpresiones</dt><dd className="col-span-2">{selected.reprint_count ?? 0}</dd>
              <dt className="text-muted-foreground">Razón</dt><dd className="col-span-2">{selected.reprint_reason ?? "—"}</dd>
              <dt className="text-muted-foreground">Creado</dt><dd className="col-span-2">{fmtDate(selected.created_at)}</dd>
              <dt className="text-muted-foreground">Procesado</dt><dd className="col-span-2">{selected.processed_at ? fmtDate(selected.processed_at) : "—"}</dd>
              {selected.last_error && (<>
                <dt className="text-muted-foreground">Error</dt><dd className="col-span-2 text-rose-600">{selected.last_error}</dd>
              </>)}
            </dl>
          )}
        </DialogContent>
      </Dialog>

      {/* Reimprimir */}
      <Dialog open={!!reprintTarget} onOpenChange={(o) => { if (!o) { setReprintTarget(null); setReason(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reimprimir trabajo</DialogTitle>
            <DialogDescription>
              Se encolará un nuevo trabajo enlazado al original. Cambia la impresora si la original está caída.
            </DialogDescription>
          </DialogHeader>
          {reprintTarget && (
            <div className="space-y-3">
              <div className="text-xs text-muted-foreground">
                Tipo <b>{reprintTarget.kind}</b> · original <code>{reprintTarget.id.slice(0,8)}</code>
              </div>
              <div>
                <label className="text-xs font-medium">Impresora destino</label>
                <Select defaultValue={reprintTarget.printer_id ?? "__same__"} onValueChange={(v) => { (reprintTarget as any)._targetPrinter = v; }}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__same__">Misma original</SelectItem>
                    {printers?.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.connection})</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs font-medium">Razón (recomendado)</label>
                <Textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} placeholder="Ej: papel atascado, reclamo cliente, prueba…" />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setReprintTarget(null); setReason(""); }}>Cancelar</Button>
            <Button
              disabled={submitting}
              onClick={() => {
                const tgt = (reprintTarget as any)?._targetPrinter as string | undefined;
                const printerId = !tgt || tgt === "__same__" ? null : tgt;
                handleReprint(printerId);
              }}
            >
              {submitting ? "Encolando…" : "Reimprimir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "amber" | "rose" | "blue" }) {
  const cls = tone === "amber" ? "text-amber-700" : tone === "rose" ? "text-rose-700" : tone === "blue" ? "text-blue-700" : "text-foreground";
  return (
    <Card className="rounded-lg border-gray-100">
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-2xl font-bold mt-1 ${cls}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

export default PrintJobsInspectorTab;
