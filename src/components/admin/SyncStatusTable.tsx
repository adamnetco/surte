import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RefreshCw, CheckCircle2, AlertCircle, Clock, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

interface SyncLog {
  id: string;
  service_name: string;
  status: "pending" | "success" | "error" | "partial";
  error_message: string | null;
  attempts: number;
  duration_ms: number | null;
  last_run_at: string;
  payload: any;
}

interface ServiceRow {
  service_name: string;
  last?: SyncLog;
}

const TRACKED_SERVICES = [
  { key: "sync-products-to-wp", label: "WordPress · Productos", manualFn: "sync-products-to-wp" },
  { key: "sync-outbox-flush", label: "Outbox · Reintentos", manualFn: "sync-outbox-flush" },
  { key: "wp-revalidate-webhook", label: "WP Revalidate", manualFn: null },
  { key: "send-ycloud-whatsapp", label: "WhatsApp (yCloud)", manualFn: null },
  { key: "process-email-queue", label: "Email transaccional", manualFn: "process-email-queue" },
] as const;

export default function SyncStatusTable() {
  const [rows, setRows] = useState<ServiceRow[]>(
    TRACKED_SERVICES.map((s) => ({ service_name: s.key })),
  );
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const load = async () => {
    const { data, error } = await supabase
      .from("sync_logs" as any)
      .select("*")
      .in("service_name", TRACKED_SERVICES.map((s) => s.key))
      .order("last_run_at", { ascending: false })
      .limit(200);
    if (error) {
      console.error(error);
      setLoading(false);
      return;
    }
    const byService = new Map<string, SyncLog>();
    for (const log of (data ?? []) as unknown as SyncLog[]) {
      if (!byService.has(log.service_name)) byService.set(log.service_name, log);
    }
    setRows(TRACKED_SERVICES.map((s) => ({ service_name: s.key, last: byService.get(s.key) })));
    setLoading(false);
  };

  useEffect(() => {
    load();
    // Realtime: cualquier insert/update en sync_logs refresca
    const ch = supabase
      .channel("sync_logs_dash")
      .on("postgres_changes", { event: "*", schema: "public", table: "sync_logs" }, () => load())
      .subscribe();
    const id = setInterval(load, 30_000);
    return () => {
      supabase.removeChannel(ch);
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const trigger = async (svcKey: string, fnName: string) => {
    setBusy(svcKey);
    try {
      // Para sync-products-to-wp se requiere site_id: lo tomamos del primer tenant_site del usuario.
      let body: any = {};
      if (fnName === "sync-products-to-wp") {
        const { data: site } = await (supabase as any)
          .from("tenant_sites")
          .select("id")
          .limit(1)
          .maybeSingle();
        if (!site?.id) {
          toast({ title: "Sin tenant_site configurado", variant: "destructive" });
          setBusy(null);
          return;
        }
        body = { site_id: site.id };
      }
      const { error } = await supabase.functions.invoke(fnName, { body });
      if (error) throw error;
      toast({ title: "Sincronización lanzada", description: fnName });
      setTimeout(load, 1500);
    } catch (e: any) {
      toast({ title: "Error al forzar sync", description: String(e?.message ?? e), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">Estado de Sincronización</h3>
          <p className="text-sm text-muted-foreground">
            Monitoreo en vivo de servicios externos (sync_logs)
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Recargar
        </Button>
      </div>

      <div className="space-y-2">
        {rows.map((row) => {
          const svc = TRACKED_SERVICES.find((s) => s.key === row.service_name)!;
          const log = row.last;
          const status = log?.status ?? "pending";
          const dotColor =
            status === "success" ? "bg-emerald-500"
              : status === "error" ? "bg-red-500"
              : status === "partial" ? "bg-amber-500"
              : "bg-gray-300";
          return (
            <div
              key={row.service_name}
              className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-card"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className={`h-2.5 w-2.5 rounded-full ${dotColor} shrink-0`} />
                <div className="min-w-0">
                  <div className="font-medium truncate">{svc.label}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {log
                      ? <>
                          Última ejecución {formatDistanceToNow(new Date(log.last_run_at), { locale: es, addSuffix: true })}
                          {log.duration_ms != null && ` · ${log.duration_ms} ms`}
                          {log.attempts > 0 && ` · ${log.attempts} intento(s)`}
                        </>
                      : "Sin ejecuciones registradas"}
                  </div>
                  {log?.error_message && (
                    <div className="text-xs text-red-600 truncate mt-0.5">{log.error_message}</div>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <StatusBadge status={status} />
                {svc.manualFn && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => trigger(svc.key, svc.manualFn!)}
                    disabled={busy === svc.key}
                  >
                    {busy === svc.key
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <RefreshCw className="h-3.5 w-3.5" />}
                    <span className="ml-1.5 hidden sm:inline">Forzar</span>
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function StatusBadge({ status }: { status: SyncLog["status"] }) {
  if (status === "success") return <Badge className="bg-emerald-500/15 text-emerald-700 hover:bg-emerald-500/15"><CheckCircle2 className="h-3 w-3 mr-1" />OK</Badge>;
  if (status === "error") return <Badge variant="destructive"><AlertCircle className="h-3 w-3 mr-1" />Error</Badge>;
  if (status === "partial") return <Badge className="bg-amber-500/15 text-amber-700 hover:bg-amber-500/15"><AlertCircle className="h-3 w-3 mr-1" />Parcial</Badge>;
  return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pendiente</Badge>;
}
