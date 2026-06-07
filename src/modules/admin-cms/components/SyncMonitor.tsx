import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, CheckCircle2, AlertCircle, Clock, Filter } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

type SyncLog = {
  id: string;
  organization_id: string | null;
  service_name: string;
  status: "pending" | "success" | "error" | "partial";
  error_message: string | null;
  attempts: number;
  duration_ms: number | null;
  payload: any;
  last_run_at: string;
};

const STATUSES = ["all", "success", "error", "partial", "pending"] as const;

export default function SyncMonitor() {
  const { currentOrg } = useOrganization();
  const [logs, setLogs] = useState<SyncLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<typeof STATUSES[number]>("all");
  const [serviceFilter, setServiceFilter] = useState<string>("all");

  const load = async () => {
    setLoading(true);
    let q = supabase.from("sync_logs").select("*").order("last_run_at", { ascending: false }).limit(200);
    if (currentOrg?.id) q = q.eq("organization_id", currentOrg.id);
    const { data, error } = await q;
    if (!error) setLogs((data as SyncLog[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("sync_monitor")
      .on("postgres_changes", { event: "*", schema: "public", table: "sync_logs" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrg?.id]);

  const services = Array.from(new Set(logs.map((l) => l.service_name))).sort();
  const filtered = logs.filter(
    (l) =>
      (statusFilter === "all" || l.status === statusFilter) &&
      (serviceFilter === "all" || l.service_name === serviceFilter),
  );

  const counts = {
    success: logs.filter((l) => l.status === "success").length,
    error: logs.filter((l) => l.status === "error").length,
    partial: logs.filter((l) => l.status === "partial").length,
    pending: logs.filter((l) => l.status === "pending").length,
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="OK" value={counts.success} tone="success" />
        <KpiCard label="Error" value={counts.error} tone="danger" />
        <KpiCard label="Parcial" value={counts.partial} tone="warning" />
        <KpiCard label="Pendiente" value={counts.pending} tone="muted" />
      </div>

      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Filter size={14} className="text-muted-foreground" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="text-sm bg-muted rounded-md px-2 py-1.5 border border-border"
          >
            {STATUSES.map((s) => <option key={s} value={s}>{s === "all" ? "Todos los estados" : s}</option>)}
          </select>
          <select
            value={serviceFilter}
            onChange={(e) => setServiceFilter(e.target.value)}
            className="text-sm bg-muted rounded-md px-2 py-1.5 border border-border"
          >
            <option value="all">Todos los servicios</option>
            {services.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="ml-auto">
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} />
            Recargar
          </Button>
        </div>

        <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              {loading ? "Cargando…" : "Sin registros para los filtros seleccionados"}
            </p>
          )}
          {filtered.map((l) => (
            <div key={l.id} className="flex items-start gap-3 p-2.5 rounded-md border border-border bg-card text-sm">
              <StatusBadge status={l.status} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium truncate">{l.service_name}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {formatDistanceToNow(new Date(l.last_run_at), { locale: es, addSuffix: true })}
                  </span>
                  {l.duration_ms != null && (
                    <span className="text-[11px] text-muted-foreground">· {l.duration_ms}ms</span>
                  )}
                  {l.attempts > 0 && (
                    <span className="text-[11px] text-muted-foreground">· {l.attempts} intentos</span>
                  )}
                </div>
                {l.error_message && (
                  <p className="text-xs text-destructive mt-0.5 line-clamp-2">{l.error_message}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function KpiCard({ label, value, tone }: { label: string; value: number; tone: "success" | "danger" | "warning" | "muted" }) {
  const colors = {
    success: "text-emerald-600 bg-emerald-500/10",
    danger: "text-red-600 bg-red-500/10",
    warning: "text-amber-600 bg-amber-500/10",
    muted: "text-muted-foreground bg-muted",
  }[tone];
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <p className={`text-2xl font-heading font-bold ${colors.split(" ")[0]}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: SyncLog["status"] }) {
  if (status === "success") return <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15"><CheckCircle2 className="h-3 w-3" /></Badge>;
  if (status === "error") return <Badge variant="destructive"><AlertCircle className="h-3 w-3" /></Badge>;
  if (status === "partial") return <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/15"><AlertCircle className="h-3 w-3" /></Badge>;
  return <Badge variant="secondary"><Clock className="h-3 w-3" /></Badge>;
}
