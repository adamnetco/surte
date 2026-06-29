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
import { RefreshCcw, Play, HeartPulse, AlertTriangle, Mail, MessageCircle, Bell, ShieldAlert, Clock, Wand2, History, CheckCircle2, XCircle, Info, Download, Filter, ChevronDown, ChevronRight, ExternalLink, Building2, Link2, Bookmark, BookmarkPlus, Trash2, Star, Pin, ScrollText, Plus, Pencil } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger, SheetDescription } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link, useSearchParams } from "react-router-dom";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type TimelineFilterKind = "all" | "sla" | "auto";
type TimelineFilterSev = "all" | "info" | "warning" | "error";

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
interface HealthEventRow {
  id: string;
  kind: string;
  severity: "info" | "warning" | "error" | string;
  payload: Record<string, any> | null;
  created_at: string;
}

const HEALTH_KINDS = ["routing_alerts_cron_sla_breach", "routing_alerts_auto_recovery"];

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
  const [events, setEvents] = useState<HealthEventRow[]>([]);
  const [searchParams, setSearchParams] = useSearchParams();
  const [tlKind, setTlKind] = useState<TimelineFilterKind>(() => {
    const v = searchParams.get("kind");
    return v === "sla" || v === "auto" ? v : "all";
  });
  const [tlSev, setTlSev] = useState<TimelineFilterSev>(() => {
    const v = searchParams.get("sev");
    return v === "info" || v === "warning" || v === "error" ? v : "all";
  });
  const [tlOrg, setTlOrg] = useState<string>(() => searchParams.get("org") ?? "all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Slice X — Presets personales (localStorage).
  // Slice Y — Presets de equipo compartidos vía DB (routing_alert_timeline_presets).
  type TimelinePreset = { name: string; kind: TimelineFilterKind; sev: TimelineFilterSev; org: string };
  type TeamPreset = TimelinePreset & { id: string; is_team_default?: boolean };
  const PRESETS_LS_KEY = "routing_alerts_timeline_presets_v1";
  const [presets, setPresets] = useState<TimelinePreset[]>(() => {
    if (typeof window === "undefined") return [];
    try { return JSON.parse(window.localStorage.getItem(PRESETS_LS_KEY) ?? "[]"); } catch { return []; }
  });
  const [teamPresets, setTeamPresets] = useState<TeamPreset[]>([]);
  const persistPresets = (next: TimelinePreset[]) => {
    setPresets(next);
    try { window.localStorage.setItem(PRESETS_LS_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };
  const loadTeamPresets = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from("routing_alert_timeline_presets")
      .select("id, name, filters, is_team_default")
      .order("name", { ascending: true });
    if (error) return;
    setTeamPresets((data ?? []).map((r: any) => ({
      id: r.id,
      name: r.name,
      kind: r.filters?.kind ?? "all",
      sev: r.filters?.sev ?? "all",
      org: r.filters?.org ?? "all",
      is_team_default: !!r.is_team_default,
    })));
  }, []);
  useEffect(() => { loadTeamPresets(); }, [loadTeamPresets]);

  const savePreset = async (scope: "personal" | "team") => {
    const name = window.prompt(
      scope === "team" ? "Nombre del preset (compartido con el equipo):" : "Nombre del preset personal:",
      ""
    )?.trim();
    if (!name) return;
    if (scope === "personal") {
      const next = presets.filter((p) => p.name !== name).concat({ name, kind: tlKind, sev: tlSev, org: tlOrg });
      persistPresets(next);
      toast.success(`Preset "${name}" guardado`);
      return;
    }
    const { data: u } = await supabase.auth.getUser();
    const { error } = await (supabase as any)
      .from("routing_alert_timeline_presets")
      .upsert(
        { name, filters: { kind: tlKind, sev: tlSev, org: tlOrg }, created_by: u?.user?.id },
        { onConflict: "name" }
      );
    if (error) { toast.error(error.message); return; }
    toast.success(`Preset de equipo "${name}" guardado`);
    loadTeamPresets();
  };
  const applyPreset = (p: TimelinePreset) => {
    setTlKind(p.kind); setTlSev(p.sev); setTlOrg(p.org);
    toast.message(`Preset "${p.name}" aplicado`);
  };
  const deletePreset = (name: string) => {
    persistPresets(presets.filter((p) => p.name !== name));
    if (defaultPresetRef === `personal:${name}`) persistDefaultPresetRef(null);
    toast.success(`Preset "${name}" eliminado`);
  };
  const deleteTeamPreset = async (id: string, name: string) => {
    const { error } = await (supabase as any)
      .from("routing_alert_timeline_presets").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    if (defaultPresetRef === `team:${id}`) persistDefaultPresetRef(null);
    toast.success(`Preset de equipo "${name}" eliminado`);
    loadTeamPresets();
  };
  const hasActiveFilters = !(tlKind === "all" && tlSev === "all" && tlOrg === "all");
  const totalPresetsCount = presets.length + teamPresets.length;

  // Slice Z — Preset por defecto (auto-aplicado al abrir sin query params).
  // Formato: "team:<id>" | "personal:<name>" | null. Persistido en localStorage.
  const DEFAULT_PRESET_LS_KEY = "routing_alerts_timeline_default_preset_v1";
  const [defaultPresetRef, setDefaultPresetRef] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return window.localStorage.getItem(DEFAULT_PRESET_LS_KEY);
  });
  const persistDefaultPresetRef = (ref: string | null) => {
    setDefaultPresetRef(ref);
    try {
      if (ref) window.localStorage.setItem(DEFAULT_PRESET_LS_KEY, ref);
      else window.localStorage.removeItem(DEFAULT_PRESET_LS_KEY);
    } catch { /* ignore */ }
  };
  const toggleDefaultPreset = (ref: string, name: string) => {
    if (defaultPresetRef === ref) {
      persistDefaultPresetRef(null);
      toast.success(`"${name}" ya no es el preset por defecto`);
    } else {
      persistDefaultPresetRef(ref);
      toast.success(`"${name}" marcado como preset por defecto`);
    }
  };

  // Slice AA — Default de equipo (compartido vía DB).
  // Cuando un preset de equipo está marcado is_team_default=true, todo el equipo
  // lo ve auto-aplicado al abrir el panel (sin query params en la URL y sin que
  // la persona haya elegido un default personal con prioridad). Solo puede haber
  // uno (enforced por índice único parcial en DB).
  const teamDefaultPreset = teamPresets.find((p) => p.is_team_default) ?? null;
  const toggleTeamDefault = async (id: string, name: string, isCurrentlyDefault: boolean) => {
    // Quitar default actual (si lo hay) para no chocar con el índice único parcial.
    const { error: clearErr } = await (supabase as any)
      .from("routing_alert_timeline_presets")
      .update({ is_team_default: false })
      .eq("is_team_default", true);
    if (clearErr) { toast.error(clearErr.message); return; }
    if (!isCurrentlyDefault) {
      const { error } = await (supabase as any)
        .from("routing_alert_timeline_presets")
        .update({ is_team_default: true })
        .eq("id", id);
      if (error) { toast.error(error.message); return; }
      toast.success(`"${name}" marcado como default del equipo`);
    } else {
      toast.success(`"${name}" ya no es default del equipo`);
    }
    loadTeamPresets();
  };

  // Slice BB — Audit log de cambios en presets de equipo.
  // Lee `routing_alert_timeline_preset_audit` (poblada por trigger AFTER INSERT/UPDATE/DELETE)
  // y muestra los últimos 50 cambios con autor, acción y diff resumido.
  interface PresetAuditRow {
    id: string;
    preset_id: string | null;
    preset_name: string | null;
    action: "create" | "update" | "delete";
    actor_id: string | null;
    diff: any;
    created_at: string;
  }
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditRows, setAuditRows] = useState<PresetAuditRow[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditActors, setAuditActors] = useState<Record<string, { name: string }>>({});
  // Slice CC — filtros + export CSV del audit log.
  const [auditActionFilter, setAuditActionFilter] = useState<"all" | "create" | "update" | "delete">("all");
  const [auditSearch, setAuditSearch] = useState("");
  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    const { data, error } = await (supabase as any)
      .from("routing_alert_timeline_preset_audit")
      .select("id, preset_id, preset_name, action, actor_id, diff, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) { toast.error(error.message); setAuditLoading(false); return; }
    const rows = (data ?? []) as PresetAuditRow[];
    setAuditRows(rows);
    const actorIds = Array.from(new Set(rows.map((r) => r.actor_id).filter(Boolean))) as string[];
    if (actorIds.length) {
      const { data: profs } = await (supabase as any)
        .from("profiles").select("user_id, full_name, business_name").in("user_id", actorIds);
      const map: Record<string, { name: string }> = {};
      for (const p of profs ?? []) map[(p as any).user_id] = { name: (p as any).full_name || (p as any).business_name || "—" };
      setAuditActors(map);
    }
    setAuditLoading(false);
  }, []);
  useEffect(() => { if (auditOpen) loadAudit(); }, [auditOpen, loadAudit]);

  const summarizeDiff = (row: PresetAuditRow): string => {
    const d = row.diff ?? {};
    if (row.action === "create") {
      const f = d?.new?.filters ?? {};
      return `kind=${f.kind ?? "?"} · sev=${f.sev ?? "?"} · org=${f.org ?? "?"}`;
    }
    if (row.action === "delete") {
      const f = d?.old?.filters ?? {};
      return `era kind=${f.kind ?? "?"} · sev=${f.sev ?? "?"} · org=${f.org ?? "?"}`;
    }
    // update — diff de campos relevantes
    const oldV = d?.old ?? {}; const newV = d?.new ?? {};
    const parts: string[] = [];
    if (oldV.name !== newV.name) parts.push(`name: "${oldV.name}" → "${newV.name}"`);
    if (!!oldV.is_team_default !== !!newV.is_team_default) {
      parts.push(newV.is_team_default ? "marcado default equipo" : "quitado default equipo");
    }
    const of = oldV.filters ?? {}; const nf = newV.filters ?? {};
    for (const k of ["kind", "sev", "org"] as const) {
      if (of[k] !== nf[k]) parts.push(`${k}: ${of[k] ?? "?"} → ${nf[k] ?? "?"}`);
    }
    return parts.join(" · ") || "cambio menor";
  };

  // Slice CC — derivados: filtrado + CSV.
  const auditFiltered = useMemo(() => {
    const q = auditSearch.trim().toLowerCase();
    return auditRows.filter((r) => {
      if (auditActionFilter !== "all" && r.action !== auditActionFilter) return false;
      if (!q) return true;
      const actorName = r.actor_id ? auditActors[r.actor_id]?.name ?? "" : "system";
      const hay = `${r.preset_name ?? ""} ${actorName} ${r.actor_id ?? ""} ${summarizeDiff(r)}`.toLowerCase();
      return hay.includes(q);
    });
  }, [auditRows, auditActionFilter, auditSearch, auditActors]);

  const exportAuditCsv = useCallback(() => {
    const esc = (v: any) => {
      const s = v == null ? "" : String(v);
      return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const headers = ["created_at", "action", "preset_name", "actor", "summary"];
    const lines = [headers.join(",")];
    for (const r of auditFiltered) {
      const actor = r.actor_id ? auditActors[r.actor_id]?.name ?? r.actor_id : "system";
      lines.push([r.created_at, r.action, r.preset_name ?? "", actor, summarizeDiff(r)].map(esc).join(","));
    }
    const blob = new Blob(["\ufeff" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `routing-preset-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
    toast.success(`Exportadas ${auditFiltered.length} filas`);
  }, [auditFiltered, auditActors]);





  // Auto-apply preset on mount when URL has no filter params.
  // Prioridad: team-default (DB) > personal-default (localStorage).
  const [defaultApplied, setDefaultApplied] = useState(false);
  useEffect(() => {
    if (defaultApplied) return;
    const hasUrlFilters = searchParams.get("kind") || searchParams.get("sev") || searchParams.get("org");
    if (hasUrlFilters) { setDefaultApplied(true); return; }

    // 1) Team default tiene prioridad para todo el equipo.
    if (teamDefaultPreset) {
      setTlKind(teamDefaultPreset.kind); setTlSev(teamDefaultPreset.sev); setTlOrg(teamDefaultPreset.org);
      setDefaultApplied(true);
      toast.message(`Default del equipo aplicado: "${teamDefaultPreset.name}"`);
      return;
    }

    // 2) Default personal (localStorage).
    if (!defaultPresetRef) {
      // Si aún no terminó la carga de team presets, esperar un ciclo antes de rendirse.
      if (teamPresets.length === 0) return;
      setDefaultApplied(true);
      return;
    }
    const [scope, key] = defaultPresetRef.split(":");
    let target: TimelinePreset | undefined;
    if (scope === "team") target = teamPresets.find((p) => p.id === key);
    else if (scope === "personal") target = presets.find((p) => p.name === key);
    if (target) {
      setTlKind(target.kind); setTlSev(target.sev); setTlOrg(target.org);
      setDefaultApplied(true);
      toast.message(`Preset por defecto aplicado: "${target.name}"`);
    } else if (scope === "team" && teamPresets.length === 0) {
      return;
    } else {
      setDefaultApplied(true);
    }
  }, [defaultPresetRef, teamPresets, teamDefaultPreset, presets, searchParams, defaultApplied]);


  // Sync filter state → URL query params (shareable deep-link).
  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    const set = (k: string, v: string) => { if (v && v !== "all") next.set(k, v); else next.delete(k); };
    set("kind", tlKind);
    set("sev", tlSev);
    set("org", tlOrg);
    if (next.toString() !== searchParams.toString()) {
      setSearchParams(next, { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tlKind, tlSev, tlOrg]);

  const load = useCallback(async () => {
    setLoading(true);
    const since = new Date(Date.now() - DAYS_WINDOW * 86400000).toISOString().slice(0, 10);
    const sinceIso = new Date(Date.now() - DAYS_WINDOW * 86400000).toISOString();
    const { data: notifs, error } = await (supabase as any)
      .from("routing_alert_notifications")
      .select("id, organization_id, target_kind, target_id, notified_on, channel, recipients_count, created_at")
      .gte("notified_on", since)
      .order("created_at", { ascending: false })
      .limit(2000);
    if (error) { toast.error(error.message); setLoading(false); return; }
    const list = (notifs ?? []) as NotificationRow[];
    setRows(list);

    const orgIds = new Set<string>(list.map((r) => r.organization_id));

    const { data: evRows } = await (supabase as any)
      .from("health_events")
      .select("id, kind, severity, payload, created_at")
      .in("kind", HEALTH_KINDS)
      .gte("created_at", sinceIso)
      .order("created_at", { ascending: false })
      .limit(100);
    const evList = (evRows ?? []) as HealthEventRow[];
    setEvents(evList);

    // Recolecta org_ids referenciados en payloads (orgs[].id o organization_id sueltos)
    for (const ev of evList) {
      const p = ev.payload ?? {};
      if (Array.isArray(p.orgs)) for (const o of p.orgs) { if (o?.id) orgIds.add(o.id); }
      if (p.organization_id) orgIds.add(p.organization_id);
    }

    if (orgIds.size) {
      const { data: orgsData } = await (supabase as any)
        .from("organizations")
        .select("id, name, slug")
        .in("id", Array.from(orgIds));
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
      const orgsBreakdown = results
        .filter((r: any) => !r.skipped && r.organization_id)
        .map((r: any) => ({
          id: r.organization_id,
          rules: r.rules_alerted ?? 0,
          printers: r.printers_alerted ?? 0,
          emails: r.emails ?? 0,
          whatsapps: r.whatsapps ?? 0,
        }));
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
              orgs: orgsBreakdown,
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
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 rounded-md border px-2 py-1">
            <Wand2 className="h-3.5 w-3.5 text-muted-foreground" />
            <Label htmlFor="auto-recovery" className="text-xs cursor-pointer">Auto-recuperación</Label>
            <Switch id="auto-recovery" checked={autoRecovery} onCheckedChange={toggleAutoRecovery} />
          </div>
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
              {slaCritical && autoRecovery && " · Auto-recuperación activa (cooldown 6h)."}
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

      <Card>
        <CardHeader className="flex flex-row items-start justify-between gap-3 flex-wrap">
          <CardTitle className="text-base flex items-center gap-2">
            <History className="h-4 w-4" /> Timeline de eventos del cron
            <Badge variant="outline" className="text-[10px] ml-1">SLA + auto-recuperación · {DAYS_WINDOW}d</Badge>
          </CardTitle>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1">
              <Filter className="h-3 w-3 text-muted-foreground" />
              <ToggleGroup type="single" size="sm" value={tlKind} onValueChange={(v) => v && setTlKind(v as TimelineFilterKind)}>
                <ToggleGroupItem value="all" className="h-7 px-2 text-xs">Todos</ToggleGroupItem>
                <ToggleGroupItem value="sla" className="h-7 px-2 text-xs">SLA</ToggleGroupItem>
                <ToggleGroupItem value="auto" className="h-7 px-2 text-xs">Auto</ToggleGroupItem>
              </ToggleGroup>
            </div>
            <ToggleGroup type="single" size="sm" value={tlSev} onValueChange={(v) => v && setTlSev(v as TimelineFilterSev)}>
              <ToggleGroupItem value="all" className="h-7 px-2 text-xs">·</ToggleGroupItem>
              <ToggleGroupItem value="info" className="h-7 px-2 text-xs">info</ToggleGroupItem>
              <ToggleGroupItem value="warning" className="h-7 px-2 text-xs">warn</ToggleGroupItem>
              <ToggleGroupItem value="error" className="h-7 px-2 text-xs">error</ToggleGroupItem>
            </ToggleGroup>
            {(() => {
              const orgIdSet = new Set<string>();
              for (const ev of events) {
                const p = ev.payload ?? {};
                if (Array.isArray(p.orgs)) for (const o of p.orgs) { if (o?.id) orgIdSet.add(o.id); }
                if (p.organization_id) orgIdSet.add(p.organization_id);
              }
              const options = Array.from(orgIdSet).map((id) => ({
                id, label: orgs[id]?.name ?? `${id.slice(0, 8)}…`,
              })).sort((a, b) => a.label.localeCompare(b.label));
              return (
                <Select value={tlOrg} onValueChange={setTlOrg}>
                  <SelectTrigger className="h-7 px-2 text-xs w-[180px]">
                    <Building2 className="h-3 w-3 mr-1" />
                    <SelectValue placeholder="Organización" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las orgs</SelectItem>
                    {options.map((o) => (
                      <SelectItem key={o.id} value={o.id}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              );
            })()}
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                const filtered = events.filter((ev) => {
                  if (tlKind === "sla" && ev.kind !== "routing_alerts_cron_sla_breach") return false;
                  if (tlKind === "auto" && ev.kind !== "routing_alerts_auto_recovery") return false;
                  if (tlSev !== "all" && ev.severity !== tlSev) return false;
                  if (tlOrg !== "all") {
                    const p = ev.payload ?? {};
                    const ids = new Set<string>();
                    if (Array.isArray(p.orgs)) for (const o of p.orgs) { if (o?.id) ids.add(o.id); }
                    if (p.organization_id) ids.add(p.organization_id);
                    if (!ids.has(tlOrg)) return false;
                  }
                  return true;
                });
                if (!filtered.length) { toast.info("Sin eventos para exportar"); return; }
                const header = ["created_at", "kind", "severity", "hours_since_last_run", "sent", "skipped", "duration_ms", "error"];
                const escape = (v: any) => {
                  const s = v == null ? "" : String(v);
                  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
                };
                const lines = [header.join(",")];
                for (const ev of filtered) {
                  const p = ev.payload ?? {};
                  lines.push([
                    ev.created_at, ev.kind, ev.severity,
                    p.hours_since_last_run ?? "", p.sent ?? "", p.skipped ?? "", p.duration_ms ?? "",
                    p.error ?? "",
                  ].map(escape).join(","));
                }
                const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                const suffix = tlOrg !== "all" ? `-${(orgs[tlOrg]?.slug ?? tlOrg.slice(0, 8))}` : "";
                a.download = `cron-timeline${suffix}-${new Date().toISOString().slice(0, 10)}.csv`;
                a.click();
                URL.revokeObjectURL(url);
                toast.success(`${filtered.length} eventos exportados`);
              }}
            >
              <Download className="h-3.5 w-3.5 mr-1" /> CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                const params = new URLSearchParams();
                if (tlKind !== "all") params.set("kind", tlKind);
                if (tlSev !== "all") params.set("sev", tlSev);
                if (tlOrg !== "all") params.set("org", tlOrg);
                const qs = params.toString();
                const url = `${window.location.origin}${window.location.pathname}${qs ? `?${qs}` : ""}`;
                try {
                  await navigator.clipboard.writeText(url);
                  toast.success("Link copiado al portapapeles");
                } catch {
                  toast.error("No se pudo copiar el link");
                }
              }}
              disabled={tlKind === "all" && tlSev === "all" && tlOrg === "all"}
              title="Copiar link compartible con los filtros actuales"
            >
              <Link2 className="h-3.5 w-3.5 mr-1" /> Link
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" title="Presets de filtros">
                  <Bookmark className="h-3.5 w-3.5 mr-1" /> Presets
                  {totalPresetsCount > 0 && (
                    <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{totalPresetsCount}</Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                <DropdownMenuLabel className="text-xs flex items-center gap-1">
                  <Building2 className="h-3 w-3" /> Equipo (compartidos)
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {teamPresets.length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    Aún no hay presets del equipo.
                  </div>
                )}
                {teamPresets.map((p) => {
                  const ref = `team:${p.id}`;
                  const isDefault = defaultPresetRef === ref;
                  const isTeamDefault = !!p.is_team_default;
                  return (
                  <DropdownMenuItem
                    key={p.id}
                    onSelect={(e) => { e.preventDefault(); applyPreset(p); }}
                    className="flex items-center justify-between gap-2"
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm truncate flex items-center gap-1">
                        {isTeamDefault && <Pin className="h-3 w-3 fill-sky-400 text-sky-500 shrink-0" />}
                        {isDefault && <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0" />}
                        {p.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground truncate">
                        {p.kind}·{p.sev}{p.org !== "all" ? `·${orgs[p.org]?.slug ?? p.org.slice(0, 6)}` : ""}
                        {isTeamDefault && <span className="ml-1 text-sky-600">· default equipo</span>}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); toggleTeamDefault(p.id, p.name, isTeamDefault); }}
                        className={isTeamDefault ? "text-sky-600 hover:text-sky-700" : "text-muted-foreground hover:text-sky-600"}
                        aria-label={isTeamDefault ? `Quitar default del equipo para ${p.name}` : `Marcar ${p.name} como default del equipo`}
                        title={isTeamDefault ? "Quitar default del equipo" : "Marcar como default del equipo (compartido)"}
                      >
                        <Pin className={`h-3.5 w-3.5 ${isTeamDefault ? "fill-sky-400" : ""}`} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); toggleDefaultPreset(ref, p.name); }}
                        className={isDefault ? "text-amber-500 hover:text-amber-600" : "text-muted-foreground hover:text-amber-500"}
                        aria-label={isDefault ? `Quitar preset por defecto ${p.name}` : `Marcar ${p.name} como preset por defecto`}
                        title={isDefault ? "Quitar como preset por defecto (personal)" : "Marcar como preset por defecto (personal)"}
                      >
                        <Star className={`h-3.5 w-3.5 ${isDefault ? "fill-amber-400" : ""}`} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); deleteTeamPreset(p.id, p.name); }}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label={`Eliminar preset de equipo ${p.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </DropdownMenuItem>
                  );
                })}
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-xs">Mis presets (este navegador)</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {presets.length === 0 && (
                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                    Aún no hay presets personales.
                  </div>
                )}
                {presets.map((p) => {
                  const ref = `personal:${p.name}`;
                  const isDefault = defaultPresetRef === ref;
                  return (
                  <DropdownMenuItem
                    key={p.name}
                    onSelect={(e) => { e.preventDefault(); applyPreset(p); }}
                    className="flex items-center justify-between gap-2"
                  >
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm truncate flex items-center gap-1">
                        {isDefault && <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0" />}
                        {p.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground truncate">
                        {p.kind}·{p.sev}{p.org !== "all" ? `·${orgs[p.org]?.slug ?? p.org.slice(0, 6)}` : ""}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); toggleDefaultPreset(ref, p.name); }}
                        className={isDefault ? "text-amber-500 hover:text-amber-600" : "text-muted-foreground hover:text-amber-500"}
                        aria-label={isDefault ? `Quitar preset por defecto ${p.name}` : `Marcar ${p.name} como preset por defecto`}
                        title={isDefault ? "Quitar como preset por defecto" : "Marcar como preset por defecto"}
                      >
                        <Star className={`h-3.5 w-3.5 ${isDefault ? "fill-amber-400" : ""}`} />
                      </button>
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); deletePreset(p.name); }}
                        className="text-muted-foreground hover:text-destructive"
                        aria-label={`Eliminar preset ${p.name}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </DropdownMenuItem>
                  );
                })}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={(e) => { e.preventDefault(); savePreset("personal"); }}
                  disabled={!hasActiveFilters}
                >
                  <BookmarkPlus className="h-3.5 w-3.5 mr-2" />
                  Guardar como personal
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={(e) => { e.preventDefault(); savePreset("team"); }}
                  disabled={!hasActiveFilters}
                >
                  <Building2 className="h-3.5 w-3.5 mr-2" />
                  Guardar y compartir con equipo
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Sheet open={auditOpen} onOpenChange={setAuditOpen}>
              <SheetTrigger asChild>
                <Button size="sm" variant="outline" title="Audit log de presets de equipo">
                  <ScrollText className="h-3.5 w-3.5 mr-1" /> Audit
                </Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-2">
                    <ScrollText className="h-4 w-4" /> Audit · Presets de equipo
                  </SheetTitle>
                  <SheetDescription>
                    Últimos 50 cambios (creación, edición, eliminación, default de equipo) registrados automáticamente.
                  </SheetDescription>
                </SheetHeader>
                <div className="mt-4 flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">
                    {auditFiltered.length}/{auditRows.length} eventos
                  </span>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={loadAudit} disabled={auditLoading} title="Refrescar">
                      <RefreshCcw className={`h-3.5 w-3.5 ${auditLoading ? "animate-spin" : ""}`} />
                    </Button>
                    <Button size="sm" variant="outline" onClick={exportAuditCsv} disabled={auditFiltered.length === 0} title="Exportar CSV">
                      <Download className="h-3.5 w-3.5 mr-1" /> CSV
                    </Button>
                  </div>
                </div>
                {/* Slice CC — filtros de audit */}
                <div className="mt-3 grid grid-cols-[140px_1fr] gap-2">
                  <Select value={auditActionFilter} onValueChange={(v) => setAuditActionFilter(v as any)}>
                    <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las acciones</SelectItem>
                      <SelectItem value="create">Creadas</SelectItem>
                      <SelectItem value="update">Editadas</SelectItem>
                      <SelectItem value="delete">Eliminadas</SelectItem>
                    </SelectContent>
                  </Select>
                  <input
                    type="search"
                    value={auditSearch}
                    onChange={(e) => setAuditSearch(e.target.value)}
                    placeholder="Buscar nombre, autor o diff…"
                    className="h-8 px-2 text-xs rounded-md border border-input bg-background"
                    aria-label="Buscar en audit log"
                  />
                </div>
                <ol className="mt-3 space-y-2">
                  {auditLoading && <li className="text-xs text-muted-foreground">Cargando…</li>}
                  {!auditLoading && auditFiltered.length === 0 && (
                    <li className="text-xs text-muted-foreground">
                      {auditRows.length === 0 ? "Sin actividad registrada." : "Ningún evento coincide con los filtros."}
                    </li>
                  )}
                  {auditFiltered.map((r) => {
                    const actor = r.actor_id ? auditActors[r.actor_id]?.name ?? r.actor_id.slice(0, 8) : "system";
                    const tone =
                      r.action === "create" ? "border-emerald-400/40 bg-emerald-50/40 dark:bg-emerald-950/20"
                      : r.action === "delete" ? "border-rose-400/40 bg-rose-50/40 dark:bg-rose-950/20"
                      : "border-sky-400/40 bg-sky-50/40 dark:bg-sky-950/20";
                    const Icon = r.action === "create" ? Plus : r.action === "delete" ? Trash2 : Pencil;
                    const label = r.action === "create" ? "Creado" : r.action === "delete" ? "Eliminado" : "Editado";
                    return (
                      <li key={r.id} className={`rounded-md border p-2 ${tone}`}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <Icon className="h-3.5 w-3.5 shrink-0" />
                            <span className="text-sm font-medium truncate">{r.preset_name ?? "(sin nombre)"}</span>
                            <Badge variant="outline" className="text-[10px] h-4 px-1">{label}</Badge>
                          </div>
                          <span className="text-[10px] text-muted-foreground shrink-0">
                            {new Date(r.created_at).toLocaleString()}
                          </span>
                        </div>
                        <p className="mt-1 text-[11px] text-muted-foreground truncate">
                          por <strong>{actor}</strong> · {summarizeDiff(r)}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              </SheetContent>
            </Sheet>
          </div>
        </CardHeader>
        <CardContent>
          {(() => {
            const filtered = events.filter((ev) => {
              if (tlKind === "sla" && ev.kind !== "routing_alerts_cron_sla_breach") return false;
              if (tlKind === "auto" && ev.kind !== "routing_alerts_auto_recovery") return false;
              if (tlSev !== "all" && ev.severity !== tlSev) return false;
              if (tlOrg !== "all") {
                const p = ev.payload ?? {};
                const ids = new Set<string>();
                if (Array.isArray(p.orgs)) for (const o of p.orgs) { if (o?.id) ids.add(o.id); }
                if (p.organization_id) ids.add(p.organization_id);
                if (!ids.has(tlOrg)) return false;
              }
              return true;
            });
            if (events.length === 0) return <p className="text-sm text-muted-foreground">Sin eventos registrados — el cron está sano.</p>;
            if (filtered.length === 0) return <p className="text-sm text-muted-foreground">Ningún evento coincide con los filtros activos.</p>;
            return (
              <>
                <p className="text-xs text-muted-foreground mb-3">{filtered.length} de {events.length} eventos</p>
                <ol className="relative border-l border-border ml-2 space-y-3">
                  {filtered.map((ev) => {
                    const isBreach = ev.kind === "routing_alerts_cron_sla_breach";
                    const sev = ev.severity;
                    const Icon = sev === "error" ? XCircle : sev === "warning" ? AlertTriangle : sev === "info" ? CheckCircle2 : Info;
                    const tone =
                      sev === "error" ? "text-destructive bg-destructive/10 border-destructive/30"
                      : sev === "warning" ? "text-amber-600 bg-amber-500/10 border-amber-500/30 dark:text-amber-400"
                      : sev === "info" ? "text-emerald-600 bg-emerald-500/10 border-emerald-500/30 dark:text-emerald-400"
                      : "text-muted-foreground bg-muted border-border";
                    const p = ev.payload ?? {};
                    const label = isBreach
                      ? `SLA en breach · ${p.hours_since_last_run ?? "?"}h sin corrida`
                      : `Auto-recuperación · ${p.sent ?? 0} notificadas · ${p.skipped ?? 0} sin cambios${p.duration_ms ? ` · ${Math.round(p.duration_ms)}ms` : ""}`;
                    const evOrgs: Array<{ id: string; rules?: number; printers?: number; emails?: number; whatsapps?: number }> =
                      Array.isArray(p.orgs) ? p.orgs : (p.organization_id ? [{ id: p.organization_id }] : []);
                    const canExpand = evOrgs.length > 0;
                    const isOpen = !!expanded[ev.id];
                    return (
                      <li key={ev.id} className="ml-4">
                        <span className={`absolute -left-[7px] mt-1 inline-flex h-3 w-3 rounded-full border ${tone}`} />
                        <div className="flex items-start gap-2 flex-wrap">
                          <Badge variant="outline" className={`text-[10px] gap-1 ${tone}`}>
                            <Icon className="h-3 w-3" />
                            {isBreach ? "SLA breach" : "Auto-recuperación"}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {new Date(ev.created_at).toLocaleString("es-CO")}
                          </span>
                          <span className="text-sm">{label}</span>
                          {p.error && (
                            <span className="text-xs text-destructive break-all">· {String(p.error).slice(0, 140)}</span>
                          )}
                          {canExpand && (
                            <button
                              type="button"
                              onClick={() => setExpanded((s) => ({ ...s, [ev.id]: !s[ev.id] }))}
                              className="ml-1 inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                              aria-expanded={isOpen}
                            >
                              {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                              <Building2 className="h-3 w-3" />
                              {evOrgs.length} org{evOrgs.length === 1 ? "" : "s"}
                            </button>
                          )}
                        </div>
                        {canExpand && isOpen && (
                          <ul className="mt-2 ml-1 space-y-1 border-l border-border/60 pl-3">
                            {evOrgs.map((o) => {
                              const org = orgs[o.id];
                              const slug = org?.slug;
                              return (
                                <li key={o.id} className="flex items-center gap-2 flex-wrap text-xs">
                                  <Building2 className="h-3 w-3 text-muted-foreground shrink-0" />
                                  {slug ? (
                                    <Link
                                      to={`/superadmin/t/${slug}`}
                                      className="font-medium text-primary hover:underline inline-flex items-center gap-1"
                                    >
                                      {org?.name ?? slug}
                                      <ExternalLink className="h-3 w-3" />
                                    </Link>
                                  ) : (
                                    <span className="font-mono text-muted-foreground">{o.id.slice(0, 8)}…</span>
                                  )}
                                  {(o.rules != null || o.printers != null) && (
                                    <span className="text-muted-foreground">
                                      · {o.rules ?? 0} reglas · {o.printers ?? 0} impresoras
                                    </span>
                                  )}
                                  {(o.emails || o.whatsapps) && (
                                    <span className="text-muted-foreground inline-flex items-center gap-1">
                                      {o.emails ? <><Mail className="h-3 w-3" />{o.emails}</> : null}
                                      {o.whatsapps ? <><MessageCircle className="h-3 w-3" />{o.whatsapps}</> : null}
                                    </span>
                                  )}
                                </li>
                              );
                            })}
                          </ul>
                        )}
                      </li>
                    );
                  })}
                </ol>
              </>
            );
          })()}
        </CardContent>
      </Card>

    </div>
  );
}
