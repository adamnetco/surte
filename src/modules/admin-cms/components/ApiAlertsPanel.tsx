import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, Bell, CheckCircle2, RefreshCw, Webhook, Activity, KeyRound } from "lucide-react";
import { toast } from "sonner";

type Alert = {
  id: string;
  kind: "webhook_down" | "api_5xx_spike" | "api_key_near_limit";
  severity: "info" | "warning" | "critical";
  subject_label: string | null;
  message: string;
  metadata: Record<string, unknown>;
  status: "open" | "acknowledged" | "resolved";
  created_at: string;
  acknowledged_at: string | null;
  resolved_at: string | null;
};

const KIND_META: Record<Alert["kind"], { label: string; Icon: typeof Bell }> = {
  webhook_down: { label: "Webhook caído", Icon: Webhook },
  api_5xx_spike: { label: "Spike de errores 5xx", Icon: Activity },
  api_key_near_limit: { label: "API key cerca del límite", Icon: KeyRound },
};

const SEV_STYLES: Record<Alert["severity"], string> = {
  critical: "border-destructive/50 bg-destructive/5",
  warning: "border-warning/40 bg-warning/5",
  info: "border-border bg-muted/30",
};

export function ApiAlertsPanel({ orgId }: { orgId?: string }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("api_alerts")
      .select("*")
      .eq("organization_id", orgId)
      .order("status", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) toast.error(error.message);
    setAlerts((data as Alert[]) ?? []);
    setLoading(false);
  }, [orgId]);

  useEffect(() => { load(); }, [load]);

  const runEvaluation = async () => {
    setEvaluating(true);
    const { error } = await supabase.rpc("evaluate_api_alerts" as never);
    setEvaluating(false);
    if (error) return toast.error(error.message);
    toast.success("Evaluación completada");
    load();
  };

  const ack = async (id: string, resolve = false) => {
    const { error } = await supabase.rpc("api_alert_ack" as never, { _id: id, _resolve: resolve } as never);
    if (error) return toast.error(error.message);
    toast.success(resolve ? "Alerta resuelta" : "Alerta reconocida");
    load();
  };

  const openCount = alerts.filter((a) => a.status === "open").length;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          <Bell className="h-4 w-4" /> Alertas automáticas
          {openCount > 0 && <Badge variant="destructive">{openCount} abiertas</Badge>}
        </CardTitle>
        <Button size="sm" variant="outline" onClick={runEvaluation} disabled={evaluating}>
          <RefreshCw className={`mr-1 h-3.5 w-3.5 ${evaluating ? "animate-spin" : ""}`} /> Evaluar ahora
        </Button>
      </CardHeader>
      <CardContent>
        <p className="text-xs text-muted-foreground mb-3">
          Detecta automáticamente webhooks caídos (5+ fallos en 15 min), picos de errores 5xx (≥20% en 60 min)
          y API keys cerca del rate-limit (≥80% req/min). Evaluación automática cada 5 min.
        </p>

        {loading ? (
          <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}</div>
        ) : alerts.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            <CheckCircle2 className="mx-auto mb-2 h-6 w-6 text-success" />
            Sin alertas. Todo opera dentro de los umbrales.
          </div>
        ) : (
          <ul className="space-y-2">
            {alerts.map((a) => {
              const { label, Icon } = KIND_META[a.kind];
              return (
                <li key={a.id} className={`rounded-lg border p-3 ${SEV_STYLES[a.severity]} ${a.status !== "open" ? "opacity-60" : ""}`}>
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <Icon className="h-3.5 w-3.5" />
                        <span className="font-medium">{label}</span>
                        <Badge variant={a.severity === "critical" ? "destructive" : "secondary"} className="text-[10px]">
                          {a.severity}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">{a.status}</Badge>
                        {a.subject_label && <code className="truncate text-[11px] text-muted-foreground">{a.subject_label}</code>}
                      </div>
                      <p className="mt-1 text-sm">{a.message}</p>
                      <time className="text-[11px] text-muted-foreground">
                        {new Date(a.created_at).toLocaleString("es-CO")}
                      </time>
                    </div>
                    {a.status === "open" && (
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" onClick={() => ack(a.id, false)}>Reconocer</Button>
                        <Button size="sm" variant="outline" onClick={() => ack(a.id, true)}>
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Resolver
                        </Button>
                      </div>
                    )}
                    {a.status === "acknowledged" && (
                      <Button size="sm" variant="outline" onClick={() => ack(a.id, true)}>
                        <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Resolver
                      </Button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {openCount > 0 && (
          <div className="mt-3 flex items-start gap-2 rounded border border-warning/40 bg-warning/5 p-2 text-xs text-warning-foreground">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 text-warning" />
            Las alertas abiertas se resuelven automáticamente cuando la condición desaparece (ej. webhook vuelve a entregar OK).
          </div>
        )}
      </CardContent>
    </Card>
  );
}
