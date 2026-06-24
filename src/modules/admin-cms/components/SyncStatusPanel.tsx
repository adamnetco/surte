import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, AlertTriangle, Clock, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

/**
 * SyncStatusPanel — muestra estado de las colas/sincronizaciones críticas
 * (KPI snapshot, Innapsis DIAN, FX rates) con última actualización y
 * conteo de errores recientes. Se refresca cada 60s.
 */

type Row = {
  key: string;
  label: string;
  services: string[]; // prefijos a matchear en sync_logs.service_name
};

const ROWS: Row[] = [
  { key: "kpi", label: "KPIs diarios", services: ["kpi", "daily-kpi", "diario"] },
  { key: "innapsis", label: "Facturación DIAN (Innapsis)", services: ["innapsis", "einvoice"] },
  { key: "fx", label: "Casas de Cambio (FX)", services: ["fx", "fx-trm", "fx-import"] },
];

function relative(date: string | null) {
  if (!date) return "nunca";
  const diff = Date.now() - new Date(date).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return "ahora";
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.floor(h / 24)} d`;
}

export default function SyncStatusPanel() {
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;

  const { data, isLoading, isError, refetch, isRefetching } = useQuery({
    queryKey: ["admin", "sync-status", orgId],
    enabled: !!orgId,
    refetchInterval: 60_000,
    queryFn: async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { data, error } = await supabase
        .from("sync_logs")
        .select("service_name,status,last_run_at,error_message,attempts")
        .eq("organization_id", orgId!)
        .gte("last_run_at", since)
        .order("last_run_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data ?? [];
    },
  });

  const stats = ROWS.map((row) => {
    const matches = (data ?? []).filter((r) =>
      row.services.some((s) => r.service_name?.toLowerCase().includes(s)),
    );
    const last = matches[0];
    const errors = matches.filter((m) => m.status === "error").length;
    const lastError = matches.find((m) => m.status === "error");
    return {
      ...row,
      last_run_at: last?.last_run_at ?? null,
      last_status: last?.status ?? null,
      errors_24h: errors,
      total_24h: matches.length,
      last_error_msg: lastError?.error_message ?? null,
      attempts: last?.attempts ?? 0,
    };
  });

  return (
    <section className="bg-card border border-border rounded-xl p-4 space-y-3">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="font-heading font-bold text-sm text-foreground">Estado de sincronización</h2>
          <p className="text-[11px] text-muted-foreground">Últimas 24h · colas con backoff</p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isRefetching}
          className="h-7 w-7 rounded-md border border-border grid place-items-center text-muted-foreground hover:text-foreground disabled:opacity-50"
          aria-label="Actualizar estado de sincronización"
        >
          <RefreshCw size={13} className={isRefetching ? "animate-spin" : ""} />
        </button>
      </header>

      {isError && (
        <p className="text-xs text-destructive">No pudimos leer el estado de sincronización.</p>
      )}

      <ul className="space-y-2">
        {stats.map((s) => {
          const isErr = s.last_status === "error" || s.errors_24h > 0;
          const isOk = s.last_status === "success" && s.errors_24h === 0;
          const Icon = isErr ? AlertTriangle : isOk ? CheckCircle2 : Clock;
          return (
            <li
              key={s.key}
              className={cn(
                "flex items-start gap-3 p-2.5 rounded-lg border",
                isErr
                  ? "border-red-500/30 bg-red-500/5"
                  : isOk
                    ? "border-emerald-500/20 bg-emerald-500/5"
                    : "border-border bg-muted/30",
              )}
            >
              <Icon
                size={16}
                className={cn(
                  "mt-0.5 shrink-0",
                  isErr ? "text-red-600" : isOk ? "text-emerald-600" : "text-muted-foreground",
                )}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-foreground truncate">{s.label}</p>
                  <span className="text-[10px] tabular-nums text-muted-foreground shrink-0">
                    {isLoading ? <Skeleton className="h-3 w-12 inline-block" /> : relative(s.last_run_at)}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  {s.total_24h === 0
                    ? "Sin ejecuciones registradas"
                    : `${s.total_24h} ejecución(es) · ${s.errors_24h} error(es)`}
                  {s.attempts > 1 && ` · reintentos: ${s.attempts}`}
                </p>
                {s.last_error_msg && (
                  <p className="text-[11px] text-red-700 mt-0.5 line-clamp-1" title={s.last_error_msg}>
                    {s.last_error_msg}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
