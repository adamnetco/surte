// Slice L+M — Alertas de enrutamiento con silenciamiento por TTL.
// Detecta dos condiciones operativas leyendo print_jobs últimos 7 días:
//   1. Reglas activas que NO se aplicaron hace ≥ 7 días (posible regla huérfana).
//   2. Impresoras activas SIN jobs en las últimas 24 h (posible agente caído).
// Slice M: cada alerta puede silenciarse 1h/24h/7d/30d con motivo opcional.
// Los silenciados se ocultan de la lista activa y se listan aparte con opción de reactivar.
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertTriangle, Printer as PrinterIcon, RefreshCcw, ShieldAlert, BellOff, Bell, Send,
} from "lucide-react";
import { toast } from "sonner";

interface Props {
  organizationId: string;
  printers: Array<{ id: string; name: string; role?: string }>;
  rules: Array<{
    id: string;
    printer_id: string;
    is_active: boolean;
    product_id: string | null;
    category_id: string | null;
    kitchen_station_id: string | null;
  }>;
  products: Array<{ id: string; name: string }>;
  categories: Array<{ id: string; name: string }>;
  stations: Array<{ id: string; name: string }>;
}

interface JobRow {
  printer_id: string | null;
  created_at: string;
  payload: { routing?: { rules?: Array<{ rule_id: string }> } } | null;
}

interface MuteRow {
  id: string;
  target_kind: "rule" | "printer";
  target_id: string;
  reason: string | null;
  muted_until: string;
}

const DAYS_RULE_IDLE = 7;
const HOURS_PRINTER_IDLE = 24;

const TTL_OPTIONS = [
  { id: "1h", label: "1 hora", ms: 3600_000 },
  { id: "24h", label: "24 horas", ms: 24 * 3600_000 },
  { id: "7d", label: "7 días", ms: 7 * 24 * 3600_000 },
  { id: "30d", label: "30 días", ms: 30 * 24 * 3600_000 },
];

export function RoutingAlertsPanel({
  organizationId, printers, rules, products, categories, stations,
}: Props) {
  const [jobs, setJobs] = useState<JobRow[]>([]);
  const [mutes, setMutes] = useState<MuteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [muteTarget, setMuteTarget] = useState<{ kind: "rule" | "printer"; id: string; label: string } | null>(null);
  const [muteTtl, setMuteTtl] = useState("24h");
  const [muteReason, setMuteReason] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const since = new Date(Date.now() - DAYS_RULE_IDLE * 86400000).toISOString();
    const [{ data: jobsData }, { data: mutesData }] = await Promise.all([
      (supabase as any)
        .from("print_jobs")
        .select("printer_id, created_at, payload")
        .eq("organization_id", organizationId)
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(2000),
      (supabase as any)
        .from("routing_alert_mutes")
        .select("id, target_kind, target_id, reason, muted_until")
        .eq("organization_id", organizationId)
        .gt("muted_until", new Date().toISOString()),
    ]);
    setJobs((jobsData ?? []) as JobRow[]);
    setMutes((mutesData ?? []) as MuteRow[]);
    setLoading(false);
  }, [organizationId]);

  useEffect(() => { if (organizationId) load(); }, [organizationId, load]);

  const mutedRuleIds = useMemo(() => new Set(mutes.filter((m) => m.target_kind === "rule").map((m) => m.target_id)), [mutes]);
  const mutedPrinterIds = useMemo(() => new Set(mutes.filter((m) => m.target_kind === "printer").map((m) => m.target_id)), [mutes]);

  const { idleRules, idlePrinters } = useMemo(() => {
    const ruleLast = new Map<string, string>();
    const printerLast = new Map<string, string>();
    for (const j of jobs) {
      if (j.printer_id && !printerLast.has(j.printer_id)) printerLast.set(j.printer_id, j.created_at);
      const rs = j.payload?.routing?.rules ?? [];
      for (const r of rs) {
        if (r.rule_id && !ruleLast.has(r.rule_id)) ruleLast.set(r.rule_id, j.created_at);
      }
    }
    const now = Date.now();
    const idleRules = rules
      .filter((r) => r.is_active)
      .map((r) => ({ rule: r, lastAt: ruleLast.get(r.id) ?? null }))
      .filter((x) => !x.lastAt || (now - new Date(x.lastAt).getTime()) >= DAYS_RULE_IDLE * 86400000);

    const idlePrinters = printers
      .map((p) => ({ printer: p, lastAt: printerLast.get(p.id) ?? null }))
      .filter((x) => !x.lastAt || (now - new Date(x.lastAt).getTime()) >= HOURS_PRINTER_IDLE * 3600000);

    return { idleRules, idlePrinters };
  }, [jobs, rules, printers]);

  const describeRule = (r: Props["rules"][number]) => {
    if (r.product_id) return { kind: "Producto", label: products.find((p) => p.id === r.product_id)?.name ?? r.product_id };
    if (r.category_id) return { kind: "Categoría", label: categories.find((c) => c.id === r.category_id)?.name ?? r.category_id };
    if (r.kitchen_station_id) return { kind: "Estación", label: stations.find((s) => s.id === r.kitchen_station_id)?.name ?? r.kitchen_station_id };
    return { kind: "—", label: "—" };
  };

  const fmtAgo = (iso: string | null) => {
    if (!iso) return "nunca (últimos 7 días)";
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 60) return `hace ${mins} min`;
    const h = Math.floor(mins / 60);
    if (h < 48) return `hace ${h} h`;
    return `hace ${Math.floor(h / 24)} días`;
  };

  const fmtUntil = (iso: string) => {
    const mins = Math.floor((new Date(iso).getTime() - Date.now()) / 60000);
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    if (h < 48) return `${h} h`;
    return `${Math.floor(h / 24)} d`;
  };

  const visibleIdleRules = idleRules.filter((x) => !mutedRuleIds.has(x.rule.id));
  const visibleIdlePrinters = idlePrinters.filter((x) => !mutedPrinterIds.has(x.printer.id));

  const labelForMute = (m: MuteRow) => {
    if (m.target_kind === "rule") {
      const r = rules.find((x) => x.id === m.target_id);
      if (!r) return `Regla ${m.target_id.slice(0, 8)}`;
      const t = describeRule(r);
      return `${t.kind}: ${t.label}`;
    }
    return printers.find((p) => p.id === m.target_id)?.name ?? `Impresora ${m.target_id.slice(0, 8)}`;
  };

  const submitMute = async () => {
    if (!muteTarget) return;
    const ttl = TTL_OPTIONS.find((t) => t.id === muteTtl) ?? TTL_OPTIONS[1];
    const muted_until = new Date(Date.now() + ttl.ms).toISOString();
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await (supabase as any).from("routing_alert_mutes").upsert({
      organization_id: organizationId,
      target_kind: muteTarget.kind,
      target_id: muteTarget.id,
      reason: muteReason.trim() || null,
      muted_until,
      created_by: userData.user?.id ?? null,
    }, { onConflict: "organization_id,target_kind,target_id" });
    if (error) return toast.error(error.message);
    toast.success(`Silenciado por ${ttl.label}`);
    setMuteTarget(null);
    setMuteReason("");
    setMuteTtl("24h");
    load();
  };

  const unmute = async (id: string) => {
    const { error } = await (supabase as any).from("routing_alert_mutes").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Reactivada");
    load();
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-5 w-5 text-amber-600" />
          <h4 className="font-bold">Alertas de enrutamiento</h4>
          <Badge variant="outline" className="text-[10px]">7 días</Badge>
          {mutes.length > 0 && (
            <Badge variant="secondary" className="text-[10px] gap-1">
              <BellOff className="h-3 w-3" /> {mutes.length} silenciada{mutes.length === 1 ? "" : "s"}
            </Badge>
          )}
        </div>
        <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
          <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <section className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            Reglas sin uso ({visibleIdleRules.length})
          </div>
          {visibleIdleRules.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin alertas activas de reglas.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {visibleIdleRules.map(({ rule, lastAt }) => {
                const t = describeRule(rule);
                const printer = printers.find((p) => p.id === rule.printer_id);
                return (
                  <li key={rule.id} className="flex items-center justify-between gap-2 border rounded-md px-2 py-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <Badge variant="outline" className="text-[10px] shrink-0">{t.kind}</Badge>
                      <span className="truncate font-medium">{t.label}</span>
                      <span className="text-xs text-muted-foreground truncate">→ {printer?.name ?? "—"}</span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <span className="text-xs text-muted-foreground">{fmtAgo(lastAt)}</span>
                      <Button size="icon" variant="ghost" className="h-7 w-7" title="Silenciar"
                        onClick={() => setMuteTarget({ kind: "rule", id: rule.id, label: `${t.kind}: ${t.label}` })}>
                        <BellOff className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <PrinterIcon className="h-4 w-4 text-amber-600" />
            Impresoras inactivas ({visibleIdlePrinters.length})
          </div>
          {visibleIdlePrinters.length === 0 ? (
            <p className="text-xs text-muted-foreground">Sin alertas activas de impresoras.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {visibleIdlePrinters.map(({ printer, lastAt }) => (
                <li key={printer.id} className="flex items-center justify-between gap-2 border rounded-md px-2 py-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <PrinterIcon className="h-3 w-3 text-muted-foreground shrink-0" />
                    <span className="truncate font-medium">{printer.name}</span>
                    {printer.role && <Badge variant="secondary" className="text-[10px]">{printer.role}</Badge>}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <span className="text-xs text-muted-foreground">{fmtAgo(lastAt)}</span>
                    <Button size="icon" variant="ghost" className="h-7 w-7" title="Silenciar"
                      onClick={() => setMuteTarget({ kind: "printer", id: printer.id, label: printer.name })}>
                      <BellOff className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {mutes.length > 0 && (
        <section className="space-y-2 pt-2 border-t">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <BellOff className="h-4 w-4 text-muted-foreground" />
            Silenciadas ({mutes.length})
          </div>
          <ul className="space-y-1 text-sm">
            {mutes.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-2 border rounded-md px-2 py-1.5 bg-muted/30">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant="outline" className="text-[10px] shrink-0">{m.target_kind === "rule" ? "Regla" : "Impresora"}</Badge>
                  <span className="truncate font-medium">{labelForMute(m)}</span>
                  {m.reason && <span className="text-xs text-muted-foreground truncate">· {m.reason}</span>}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground">expira en {fmtUntil(m.muted_until)}</span>
                  <Button size="icon" variant="ghost" className="h-7 w-7" title="Reactivar" onClick={() => unmute(m.id)}>
                    <Bell className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Dialog open={!!muteTarget} onOpenChange={(o) => !o && setMuteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Silenciar alerta</DialogTitle>
            <DialogDescription>{muteTarget?.label}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Duración</Label>
              <Select value={muteTtl} onValueChange={setMuteTtl}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TTL_OPTIONS.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Motivo (opcional)</Label>
              <Input placeholder="Ej: temporada baja, impresora en mantenimiento…"
                value={muteReason} onChange={(e) => setMuteReason(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMuteTarget(null)}>Cancelar</Button>
            <Button onClick={submitMute}><BellOff className="h-4 w-4 mr-1" />Silenciar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
