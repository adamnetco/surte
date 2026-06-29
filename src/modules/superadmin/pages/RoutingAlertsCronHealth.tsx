// Slice P — Salud global del cron diario `notify-routing-alerts-daily`.
// Lee `routing_alert_notifications` (últimos 14 días) y agrega por día:
//   - orgs notificadas, total notificaciones, breakdown rule/printer, canales (email/whatsapp).
// Permite re-disparar manualmente el Edge Function global.
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from "@/components/ui/table";
import { RefreshCcw, Play, HeartPulse, AlertTriangle, Mail, MessageCircle, Bell, ShieldAlert, Clock, Wand2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const SLA_HOURS = 24;
const SLA_GRACE_HOURS = 36; // umbral crítico → registra health_event
const AUTO_RECOVERY_LS_KEY = "routing_alerts_auto_recovery_enabled";
const AUTO_RECOVERY_LAST_ATTEMPT_KEY = "routing_alerts_auto_recovery_last_attempt";
const AUTO_RECOVERY_COOLDOWN_HOURS = 6;

interface NotificationRow {
  id: string;
  organization_id: string;
  target_kind: "rule" | "printer";
  target_id: string;
  notified_on: string;
  channel: "email" | "whatsapp" | "both";
  recipients_count: number;
  created_at: string;
}
interface OrgRow { id: string; name: string; slug: string }

interface DayAggregate {
  day: string;
  total: number;
  orgs: Set<string>;
  rules: number;
  printers: number;
  email: number;
  whatsapp: number;
  both: number;
  recipients: number;
}

const DAYS_WINDOW = 14;

export default function RoutingAlertsCronHealth() {
  const [rows, setRows] = useState<NotificationRow[]>([]);
  const [orgs, setOrgs] = useState<Record<string, OrgRow>>({});
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [autoRecovery, setAutoRecovery] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(AUTO_RECOVERY_LS_KEY) === "1";
  });
  const [autoAttempted, setAutoAttempted] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const since = new Date(Date.now() - DAYS_WINDOW * 86400000).toISOString().slice(0, 10);
    const { data: notifs, error } = await (supabase as any)
      .from("routing_alert_notifications")
      .select("id, organization_id, target_kind, target_id, notified_on, channel, recipients_count, created_at")
      .gte("notified_on", since)
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) { toast.error(error.message); setLoading(false); return; }
    const list = (notifs ?? []) as NotificationRow[];
    setRows(list);

    const orgIds = Array.from(new Set(list.map((r) => r.organization_id)));
    if (orgIds.length) {
      const { data: orgsData } = await (supabase as any)
        .from("organizations")
        .select("id, name, slug")
        .in("id", orgIds);
      const map: Record<string, OrgRow> = {};
      (orgsData ?? []).forEach((o: OrgRow) => { map[o.id] = o; });
      setOrgs(map);
    }
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const days = useMemo<DayAggregate[]>(() => {
    const byDay = new Map<string, DayAggregate>();
    for (const r of rows) {
      let agg = byDay.get(r.notified_on);
      if (!agg) {
        agg = { day: r.notified_on, total: 0, orgs: new Set(), rules: 0, printers: 0, email: 0, whatsapp: 0, both: 0, recipients: 0 };
        byDay.set(r.notified_on, agg);
      }
      agg.total += 1;
      agg.orgs.add(r.organization_id);
      if (r.target_kind === "rule") agg.rules += 1; else agg.printers += 1;
      if (r.channel === "email") agg.email += 1;
      else if (r.channel === "whatsapp") agg.whatsapp += 1;
      else agg.both += 1;
      agg.recipients += r.recipients_count;
    }
    return Array.from(byDay.values()).sort((a, b) => b.day.localeCompare(a.day));
  }, [rows]);

  const today = new Date().toISOString().slice(0, 10);
  const ranToday = days.find((d) => d.day === today);
  const totalOrgs = useMemo(() => new Set(rows.map((r) => r.organization_id)).size, [rows]);

  // SLA: horas desde la última notificación registrada (proxy de "última corrida con efecto").
  const lastRunAt = useMemo(() => {
    if (!rows.length) return null;
    return rows.reduce((max, r) => (r.created_at > max ? r.created_at : max), rows[0].created_at);
  }, [rows]);
  const hoursSince = useMemo(() => {
    if (!lastRunAt) return Infinity;
    return (Date.now() - new Date(lastRunAt).getTime()) / 3600000;
  }, [lastRunAt]);
  const slaBreach = hoursSince > SLA_HOURS;
  const slaCritical = hoursSince > SLA_GRACE_HOURS;

  // Registro automático del breach crítico en health_events (best-effort, una vez por carga).
  useEffect(() => {
    if (loading || !slaCritical) return;
    (async () => {
      try {
        await (supabase as any).from("health_events").insert({
          kind: "routing_alerts_cron_sla_breach",
          severity: "warning",
          payload: {
            hours_since_last_run: Math.round(hoursSince),
            last_run_at: lastRunAt,
            sla_hours: SLA_HOURS,
          },
        });
      } catch { /* silent */ }
    })();
  }, [loading, slaCritical, hoursSince, lastRunAt]);

  const invokeCron = useCallback(async (opts: { auto: boolean }) => {
    setRunning(true);
    const startedAt = Date.now();
    try {
      const { data, error } = await supabase.functions.invoke("notify-routing-alerts", { body: {} });
      if (error) throw error;
      const results = (data as any)?.results ?? [];
      const sent = results.filter((r: any) => !r.skipped).length;
      const skipped = results.filter((r: any) => r.skipped).length;
      if (opts.auto) {
        toast.success(`Auto-recuperación · ${sent} orgs notificadas · ${skipped} sin cambios`);
        try {
          await (supabase as any).from("health_events").insert({
            kind: "routing_alerts_auto_recovery",
            severity: sent > 0 ? "info" : "warning",
            payload: {
              triggered_by: "sla_critical",
              hours_since_last_run: Math.round(hoursSince),
              sent, skipped,
              duration_ms: Date.now() - startedAt,
            },
          });
        } catch { /* silent */ }
      } else {
        toast.success(`Cron disparado · ${sent} org notificadas · ${skipped} sin cambios`);
      }
      load();
    } catch (e: any) {
      toast.error(`${opts.auto ? "Auto-recuperación falló" : "Error al disparar cron"}: ${e?.message ?? "desconocido"}`);
      if (opts.auto) {
        try {
          await (supabase as any).from("health_events").insert({
            kind: "routing_alerts_auto_recovery",
            severity: "error",
            payload: { triggered_by: "sla_critical", error: String(e?.message ?? e) },
          });
        } catch { /* silent */ }
      }
    } finally {
      setRunning(false);
    }
  }, [hoursSince, load]);

  const runManual = async () => {
    if (!window.confirm("Disparar manualmente el cron global de alertas? Iterará todas las organizaciones (respeta mutes y dedupe diario).")) return;
    await invokeCron({ auto: false });
  };

  // Slice R — Auto-recuperación: si SLA crítico y toggle activo, dispara el cron una sola vez
  // por cada ventana de cooldown (6h) y registra el resultado en health_events.
  useEffect(() => {
    if (loading || !slaCritical || !autoRecovery || autoAttempted || running) return;
    const lastAttemptStr = window.localStorage.getItem(AUTO_RECOVERY_LAST_ATTEMPT_KEY);
    const lastAttempt = lastAttemptStr ? Number(lastAttemptStr) : 0;
    const hoursSinceAttempt = (Date.now() - lastAttempt) / 3600000;
    if (hoursSinceAttempt < AUTO_RECOVERY_COOLDOWN_HOURS) return;
    setAutoAttempted(true);
    window.localStorage.setItem(AUTO_RECOVERY_LAST_ATTEMPT_KEY, String(Date.now()));
    toast.message("Auto-recuperación activada", { description: `SLA crítico (${Math.round(hoursSince)}h). Disparando cron…` });
    invokeCron({ auto: true });
  }, [loading, slaCritical, autoRecovery, autoAttempted, running, hoursSince, invokeCron]);

  const toggleAutoRecovery = (v: boolean) => {
    setAutoRecovery(v);
    window.localStorage.setItem(AUTO_RECOVERY_LS_KEY, v ? "1" : "0");
    if (!v) window.localStorage.removeItem(AUTO_RECOVERY_LAST_ATTEMPT_KEY);
    toast.success(v ? "Auto-recuperación habilitada" : "Auto-recuperación deshabilitada");
  };

  const fmtDay = (iso: string) => {
    const d = new Date(iso + "T12:00:00Z");
    return d.toLocaleDateString("es-CO", { weekday: "short", day: "2-digit", month: "short" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <HeartPulse className="h-5 w-5 text-primary" />
          <h1 className="font-heading font-bold text-xl">Salud del cron de alertas</h1>
          <Badge variant="outline" className="text-[10px]">notify-routing-alerts-daily · 08:00 UTC</Badge>
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="outline" onClick={runManual} disabled={running || loading}>
            <Play className={`h-4 w-4 mr-1 ${running ? "animate-pulse" : ""}`} /> Disparar ahora
          </Button>
          <Button size="icon" variant="ghost" onClick={load} disabled={loading}>
            <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {slaBreach && !loading && (
        <div
          role="alert"
          className={`rounded-lg border p-4 flex items-start gap-3 ${
            slaCritical
              ? "border-destructive/40 bg-destructive/5 text-destructive"
              : "border-amber-500/40 bg-amber-500/5 text-amber-700 dark:text-amber-400"
          }`}
        >
          <ShieldAlert className="h-5 w-5 mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-sm">
              {slaCritical ? "SLA crítico" : "SLA en riesgo"} · cron sin actividad hace{" "}
              {isFinite(hoursSince) ? `${Math.round(hoursSince)}h` : "—"}
            </p>
            <p className="text-xs opacity-90 mt-0.5 flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {lastRunAt
                ? `Última notificación: ${new Date(lastRunAt).toLocaleString("es-CO")}`
                : `Sin notificaciones en los últimos ${DAYS_WINDOW} días.`}
              {" · "}umbral {SLA_HOURS}h.
              {slaCritical && " Se registró un health_event automático."}
            </p>
          </div>
          <Button size="sm" variant={slaCritical ? "destructive" : "outline"} onClick={runManual} disabled={running}>
            <Play className={`h-4 w-4 mr-1 ${running ? "animate-pulse" : ""}`} /> Disparar ahora
          </Button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Hoy ({today})</p>
            <p className="text-2xl font-bold mt-1">
              {ranToday ? `${ranToday.orgs.size}` : "0"}{" "}
              <span className="text-xs font-normal text-muted-foreground">orgs</span>
            </p>
            {!ranToday && <Badge variant="secondary" className="text-[10px] mt-1 gap-1"><AlertTriangle className="h-3 w-3" />Sin corrida aún</Badge>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Total notificaciones ({DAYS_WINDOW}d)</p>
            <p className="text-2xl font-bold mt-1">{rows.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Orgs únicas ({DAYS_WINDOW}d)</p>
            <p className="text-2xl font-bold mt-1">{totalOrgs}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground">Destinatarios totales</p>
            <p className="text-2xl font-bold mt-1">{rows.reduce((s, r) => s + r.recipients_count, 0)}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4" /> Corridas diarias ({days.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Cargando…</p>
          ) : days.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin notificaciones en los últimos {DAYS_WINDOW} días.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Día</TableHead>
                  <TableHead className="text-right">Orgs</TableHead>
                  <TableHead className="text-right">Reglas</TableHead>
                  <TableHead className="text-right">Impresoras</TableHead>
                  <TableHead>Canales</TableHead>
                  <TableHead className="text-right">Destinatarios</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {days.map((d) => (
                  <TableRow key={d.day}>
                    <TableCell className="font-medium">
                      {fmtDay(d.day)}
                      {d.day === today && <Badge variant="default" className="ml-2 text-[10px]">HOY</Badge>}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{d.orgs.size}</TableCell>
                    <TableCell className="text-right tabular-nums">{d.rules}</TableCell>
                    <TableCell className="text-right tabular-nums">{d.printers}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 flex-wrap">
                        {d.email > 0 && <Badge variant="outline" className="text-[10px] gap-1"><Mail className="h-3 w-3" />{d.email}</Badge>}
                        {d.whatsapp > 0 && <Badge variant="outline" className="text-[10px] gap-1"><MessageCircle className="h-3 w-3" />{d.whatsapp}</Badge>}
                        {d.both > 0 && <Badge variant="secondary" className="text-[10px]">ambos · {d.both}</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{d.recipients}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimas notificaciones</CardTitle>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">—</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  <TableHead>Organización</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Canal</TableHead>
                  <TableHead className="text-right">Destinatarios</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, 50).map((r) => {
                  const org = orgs[r.organization_id];
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-xs">{new Date(r.created_at).toLocaleString("es-CO")}</TableCell>
                      <TableCell className="text-sm">
                        {org ? (
                          <span>
                            <span className="font-medium">{org.name}</span>
                            <span className="text-muted-foreground"> · {org.slug}</span>
                          </span>
                        ) : (
                          <span className="text-muted-foreground">{r.organization_id.slice(0, 8)}…</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-[10px]">
                          {r.target_kind === "rule" ? "Regla" : "Impresora"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className="text-[10px]">{r.channel}</Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{r.recipients_count}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
