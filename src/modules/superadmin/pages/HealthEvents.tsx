import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle2, HeartPulse, RefreshCw, ShieldAlert, Activity, MessageCircle } from "lucide-react";
import { GateDenialsPanel } from "@/modules/superadmin/components/GateDenialsPanel";
import { ConversionFunnelPanel } from "@/modules/superadmin/components/ConversionFunnelPanel";
import { UsageDivergencePanel } from "@/modules/superadmin/components/UsageDivergencePanel";

type HealthRow = {
  id: string;
  source: string;
  status: string;
  message: string | null;
  prev_status: string | null;
  latency_ms: number | null;
  correlation_id: string | null;
  organization_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type WaRow = {
  id: string;
  status: string;
  direction: string | null;
  organization_id: string | null;
  phone: string | null;
  order_id: string | null;
  whatsapp_ref: string | null;
  latency_ms: number | null;
  error: string | null;
  created_at: string;
};

const STATUS_STYLES: Record<string, string> = {
  ok: "border-success/30 bg-success/5",
  critical: "border-destructive/50 bg-destructive/5",
  warning: "border-warning/40 bg-warning/5",
  failed: "border-destructive/50 bg-destructive/5",
  sent: "border-success/30 bg-success/5",
  delivered: "border-success/30 bg-success/5",
  read: "border-success/30 bg-success/5",
  queued: "border-muted bg-muted/30",
};

const SOURCE_ICON: Record<string, JSX.Element> = {
  data_api: <ShieldAlert className="w-3.5 h-3.5" />,
  rls_audit: <ShieldAlert className="w-3.5 h-3.5" />,
  whatsapp: <MessageCircle className="w-3.5 h-3.5" />,
};

export default function HealthEvents() {
  const [events, setEvents] = useState<HealthRow[]>([]);
  const [waEvents, setWaEvents] = useState<WaRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [probing, setProbing] = useState(false);
  const [probeResult, setProbeResult] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setErr(null);
    const [{ data: he, error: e1 }, { data: wa, error: e2 }] = await Promise.all([
      supabase.from("health_events").select("*").order("created_at", { ascending: false }).limit(100),
      supabase.from("whatsapp_message_events").select("*").order("created_at", { ascending: false }).limit(50),
    ]);
    if (e1) setErr(e1.message);
    setEvents((he as HealthRow[]) ?? []);
    setWaEvents((wa as WaRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    document.title = "Salud del sistema · Superadmin · SistecPOS";
    load();
  }, [load]);

  const runProbe = async () => {
    setProbing(true);
    setProbeResult(null);
    const { data, error } = await supabase.rpc("check_public_catalog_health" as never);
    if (error) {
      setProbeResult(`Error: ${error.message}`);
    } else {
      const r = data as { status?: string; public_count?: number; latency_ms?: number };
      setProbeResult(
        r?.status === "ok"
          ? `OK — ${r.public_count} planes públicos visibles (${r.latency_ms}ms)`
          : `CRÍTICO — saas_plans devolvió ${r?.public_count} filas. Evento registrado.`
      );
    }
    setProbing(false);
    await load();
  };

  const summary = useMemo(() => {
    const critical = events.filter((e) => e.status === "critical").length;
    const warning = events.filter((e) => e.status === "warning").length;
    const waFailed = waEvents.filter((e) => e.status === "failed").length;
    return { critical, warning, waFailed, total: events.length };
  }, [events, waEvents]);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><HeartPulse className="w-5 h-5 text-primary" /> Salud del sistema</h1>
          <p className="text-sm text-muted-foreground">Eventos críticos cross-tenant: Data API, RLS y trazas de WhatsApp.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={runProbe} disabled={probing} variant="outline" size="sm">
            <Activity className={`w-4 h-4 mr-2 ${probing ? "animate-pulse" : ""}`} /> Probar /planes
          </Button>
          <Button onClick={load} disabled={loading} variant="outline" size="sm">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refrescar
          </Button>
        </div>
      </header>

      {probeResult && (
        <Card className={`p-3 text-sm ${probeResult.startsWith("OK") ? "border-success/40 bg-success/5" : "border-destructive/50 bg-destructive/5"}`}>
          {probeResult}
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3"><p className="text-[11px] uppercase text-muted-foreground">Eventos (100 últ.)</p><p className="text-2xl font-bold">{summary.total}</p></Card>
        <Card className="p-3 border-destructive/50"><p className="text-[11px] uppercase text-muted-foreground">Críticos</p><p className="text-2xl font-bold text-destructive">{summary.critical}</p></Card>
        <Card className="p-3 border-warning/40"><p className="text-[11px] uppercase text-muted-foreground">Warnings</p><p className="text-2xl font-bold text-warning">{summary.warning}</p></Card>
        <Card className="p-3"><p className="text-[11px] uppercase text-muted-foreground">WhatsApp fallidos</p><p className="text-2xl font-bold">{summary.waFailed}</p></Card>
      </div>

      {err && <Card className="p-3 border-destructive/40 bg-destructive/5 text-sm text-destructive">{err}</Card>}

      <ConversionFunnelPanel />

      <div className="grid gap-3 md:grid-cols-2">
        <GateDenialsPanel />
        <UsageDivergencePanel />
      </div>


      <section>
        <h2 className="text-sm font-semibold mb-2 flex items-center gap-2"><ShieldAlert className="w-4 h-4" /> Health events</h2>
        <div className="space-y-2">
          {loading && events.length === 0 && <Card className="h-16 animate-pulse bg-muted/40" />}
          {!loading && events.length === 0 && (
            <Card className="p-6 text-center text-sm text-muted-foreground">
              <CheckCircle2 className="w-5 h-5 text-success inline mr-2" /> Sin eventos registrados.
            </Card>
          )}
          {events.map((e) => (
            <Card key={e.id} className={`p-3 text-sm ${STATUS_STYLES[e.status] ?? ""}`}>
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  {SOURCE_ICON[e.source] ?? <Activity className="w-3.5 h-3.5" />}
                  <Badge variant="outline" className="text-[10px]">{e.source}</Badge>
                  <Badge variant={e.status === "critical" ? "destructive" : "secondary"} className="text-[10px]">{e.status}</Badge>
                  {e.latency_ms != null && <span className="text-[11px] text-muted-foreground">{e.latency_ms}ms</span>}
                  {e.correlation_id && <code className="text-[10px] font-mono text-muted-foreground">{e.correlation_id}</code>}
                </div>
                <time className="text-[11px] text-muted-foreground">{new Date(e.created_at).toLocaleString("es-CO")}</time>
              </div>
              {e.message && <p className="mt-1 text-foreground">{e.message}</p>}
              {e.metadata && Object.keys(e.metadata).length > 0 && (
                <details className="mt-1">
                  <summary className="text-[11px] text-muted-foreground cursor-pointer">Metadata</summary>
                  <pre className="mt-1 text-[10px] font-mono bg-muted/40 p-2 rounded overflow-x-auto">{JSON.stringify(e.metadata, null, 2)}</pre>
                </details>
              )}
            </Card>
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-2 flex items-center gap-2"><MessageCircle className="w-4 h-4" /> WhatsApp (50 últimos)</h2>
        <div className="space-y-2">
          {!loading && waEvents.length === 0 && (
            <Card className="p-6 text-center text-sm text-muted-foreground">Sin eventos WhatsApp recientes.</Card>
          )}
          {waEvents.map((w) => (
            <Card key={w.id} className={`p-3 text-sm ${STATUS_STYLES[w.status] ?? ""}`}>
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant="outline" className="text-[10px]">{w.direction ?? "?"}</Badge>
                  <Badge variant={w.status === "failed" ? "destructive" : "secondary"} className="text-[10px]">{w.status}</Badge>
                  {w.phone && <code className="text-[11px] font-mono">{w.phone}</code>}
                  {w.latency_ms != null && <span className="text-[11px] text-muted-foreground">{w.latency_ms}ms</span>}
                </div>
                <time className="text-[11px] text-muted-foreground">{new Date(w.created_at).toLocaleString("es-CO")}</time>
              </div>
              {w.error && <p className="mt-1 text-destructive text-[12px] flex items-start gap-1"><AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />{w.error}</p>}
              {w.whatsapp_ref && <p className="text-[11px] text-muted-foreground mt-0.5">ref: <code>{w.whatsapp_ref}</code></p>}
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
