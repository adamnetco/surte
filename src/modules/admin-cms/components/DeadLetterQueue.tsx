import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { RefreshCw, Eye, Trash2, AlertOctagon, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";
import { TableSkeleton } from "@/components/ui/skeleton-presets";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";

interface OutboxRow {
  id: string;
  target: string;
  payload: any;
  status: "pending" | "succeeded" | "dead";
  attempts: number;
  max_attempts: number;
  next_attempt_at: string;
  last_error: string | null;
  created_at: string;
}

/**
 * Dead Letter Queue
 * - Muestra las tareas en sync_outbox que se marcaron como `dead`
 *   (alcanzaron max_attempts sin éxito).
 * - Permite reintentar manualmente (resetea attempts y next_attempt_at)
 *   o descartar definitivamente.
 */
export default function DeadLetterQueue() {
  const [rows, setRows] = useState<OutboxRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [previewRow, setPreviewRow] = useState<OutboxRow | null>(null);
  const { currentOrg } = useOrganization();

  const load = async () => {
    const { data, error } = await (supabase as any)
      .from("sync_outbox")
      .select("*")
      .eq("status", "dead")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      console.error(error);
      toast({ title: "Error cargando DLQ", description: error.message, variant: "destructive" });
    } else {
      setRows((data ?? []) as OutboxRow[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const ch = supabase
      .channel("sync_outbox_dlq")
      .on("postgres_changes", { event: "*", schema: "public", table: "sync_outbox" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const retry = async (row: OutboxRow) => {
    setBusyId(row.id);
    try {
      const { error } = await supabase.functions.invoke("sync-outbox-retry", {
        body: { id: row.id },
      });
      if (error) throw error;
      toast({ title: "Reintento encolado", description: row.target });
      // Forzar drenaje inmediato.
      supabase.functions.invoke("sync-outbox-flush", { body: {} }).catch(() => {});
      setTimeout(load, 1200);
    } catch (e: any) {
      toast({ title: "Error al reintentar", description: String(e?.message ?? e), variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  const discard = async (row: OutboxRow) => {
    if (!window.confirm(`¿Descartar definitivamente la tarea ${row.target}?`)) return;
    setBusyId(row.id);
    try {
      const { error } = await (supabase as any)
        .from("sync_outbox")
        .update({ status: "succeeded", succeeded_at: new Date().toISOString(), last_error: "discarded_manually" })
        .eq("id", row.id);
      if (error) throw error;
      toast({ title: "Tarea descartada" });
      setRows((r) => r.filter((x) => x.id !== row.id));
    } catch (e: any) {
      toast({ title: "Error al descartar", description: String(e?.message ?? e), variant: "destructive" });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <AlertOctagon className="h-5 w-5 text-destructive" />
            Dead Letter Queue
          </h3>
          <p className="text-sm text-muted-foreground">
            Tareas que agotaron sus reintentos. Revisa el error y reintenta o descarta.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
          Recargar
        </Button>
      </div>

      {loading ? (
        <TableSkeleton rows={4} cols={4} />
      ) : rows.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          No hay tareas en la cola de errores. Todo sincronizado.
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between gap-3 p-3 rounded-lg border border-destructive/30 bg-destructive/5"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <Badge variant="destructive">DEAD</Badge>
                  <span className="font-medium truncate">{row.target}</span>
                  <span className="text-xs text-muted-foreground">
                    {row.attempts}/{row.max_attempts} intentos
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  Encolada {formatDistanceToNow(new Date(row.created_at), { locale: es, addSuffix: true })}
                </div>
                {row.last_error && (
                  <div className="text-xs text-destructive truncate mt-1">{row.last_error}</div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button size="sm" variant="ghost" onClick={() => setPreviewRow(row)}>
                  <Eye className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => retry(row)}
                  disabled={busyId === row.id}
                >
                  {busyId === row.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="h-3.5 w-3.5" />
                  )}
                  <span className="ml-1.5 hidden sm:inline">Reintentar</span>
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => discard(row)}
                  disabled={busyId === row.id}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!previewRow} onOpenChange={(o) => !o && setPreviewRow(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Payload · {previewRow?.target}</DialogTitle>
          </DialogHeader>
          <pre className="text-xs bg-muted rounded p-3 overflow-auto max-h-[60vh]">
            {previewRow ? JSON.stringify(previewRow.payload, null, 2) : ""}
          </pre>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
