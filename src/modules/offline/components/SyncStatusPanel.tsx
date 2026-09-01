// Panel de estado de sincronización local-first (Fases 6–9).
// Solo presentación: toda la lógica vive en `syncEngine`.
import { useCallback, useEffect, useState } from "react";
import { RefreshCw, AlertTriangle, CheckCircle2, Database, CloudUpload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { syncEngine } from "@/modules/offline/lib/sync";
import type { OfflineReadiness, SyncCheckpoint, SyncConflict } from "@/core/ports/ISyncEngine";

const fmt = (ts?: number | null) =>
  ts ? new Date(ts).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit" }) : "nunca";

export default function SyncStatusPanel({ organizationId }: { organizationId: string }) {
  const [readiness, setReadiness] = useState<OfflineReadiness | null>(null);
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [checkpoints, setCheckpoints] = useState<SyncCheckpoint[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!organizationId) return;
    const [r, c, cp] = await Promise.all([
      syncEngine.readiness(organizationId),
      syncEngine.listConflicts(organizationId),
      syncEngine.checkpoints(organizationId),
    ]);
    setReadiness(r);
    setConflicts(c);
    setCheckpoints(cp);
  }, [organizationId]);

  useEffect(() => { void load(); }, [load]);

  const runSync = async () => {
    setBusy(true);
    try {
      const res = await syncEngine.run(organizationId);
      if (res.offline) toast.info("Sin conexión: seguimos operando en modo local");
      else
        toast.success(
          `Sync: ${res.pushed} enviadas · ${res.pulled} actualizadas${res.removed ? ` · ${res.removed} retiradas` : ""}`,
        );
      await load();
    } catch (e: any) {
      toast.error(`Sync falló: ${e?.message ?? e}`);
    } finally {
      setBusy(false);
    }
  };

  if (!organizationId) return null;

  return (
    <section aria-label="Estado de sincronización" className="rounded-lg border border-border bg-card p-3 space-y-3">
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Database className="h-4 w-4 shrink-0" aria-hidden="true" />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">Base local del negocio</p>
            <p className="text-xs text-muted-foreground truncate">
              {readiness
                ? `${readiness.products} productos · ${readiness.categories} categorías · última sync ${fmt(readiness.lastCatalogSyncAt)}`
                : "Cargando…"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {readiness && (
            <Badge variant={readiness.ready ? "secondary" : "destructive"} className="text-[11px]">
              {readiness.ready ? "Puede vender sin red" : "Requiere descarga"}
            </Badge>
          )}
          <Button size="sm" variant="outline" onClick={runSync} disabled={busy}>
            <RefreshCw className={`h-3.5 w-3.5 mr-1 ${busy ? "animate-spin" : ""}`} aria-hidden="true" />
            Sincronizar
          </Button>
        </div>
      </header>

      {readiness && !readiness.ready && readiness.reason && (
        <p role="status" className="text-xs text-destructive">{readiness.reason}</p>
      )}

      {readiness && readiness.pendingOutbox > 0 && (
        <p className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-400">
          <CloudUpload className="h-3.5 w-3.5" aria-hidden="true" />
          {readiness.pendingOutbox} operación(es) locales pendientes de enviar
        </p>
      )}

      {checkpoints.length > 0 && (
        <ul className="space-y-1" aria-label="Cursores de sincronización">
          {checkpoints.map((cp) => (
            <li key={cp.key} className="flex items-center justify-between text-[11px] text-muted-foreground">
              <span className="capitalize">{cp.entity}</span>
              <span>{cp.rows_applied} filas · {fmt(cp.last_pull_at)}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-1">
        {conflicts.length === 0 ? (
          <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CheckCircle2 className="h-3.5 w-3.5 text-green-600" aria-hidden="true" />
            Sin conflictos de sincronización
          </p>
        ) : (
          <ul className="space-y-1" aria-label="Conflictos de sincronización">
            {conflicts.slice(0, 5).map((c) => (
              <li key={c.id} className="flex items-start justify-between gap-2 rounded-md border border-border p-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-1.5 text-xs font-medium">
                    <AlertTriangle className="h-3.5 w-3.5 text-amber-600" aria-hidden="true" />
                    {c.entity} · {c.kind}
                  </p>
                  <p className="text-[11px] text-muted-foreground break-words">{c.detail}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 px-2 text-[11px] shrink-0"
                  onClick={async () => { await syncEngine.resolveConflict(c.id!); await load(); }}
                >
                  Revisado
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
