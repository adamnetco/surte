import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail, RefreshCw, Send, AlertTriangle, ShieldOff, Users, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, LineChart, Line } from "recharts";

type Kpis = {
  enrollments_30d: number;
  active: number;
  completed: number;
  suppressed_enroll: number;
  failed_enroll: number;
  sends_sent_30d: number;
  sends_failed_30d: number;
  sends_suppressed_30d: number;
};

type SeqRow = {
  sequence: string;
  enrollments: number;
  completed: number;
  active: number;
  failed_enroll: number;
  sent: number;
  failed: number;
  suppressed: number;
};

type DailyRow = { day: string; sequence: string; sent: number; failed: number; suppressed: number };

type AbRow = {
  sequence: string;
  step: number;
  variant_key: string;
  subject_sample: string | null;
  sent: number;
  failed: number;
  total: number;
  delivery_rate: number | null;
};

type SupRow = {
  sequence: string;
  suppressed_count: number;
  suppressed_unique: number;
  total_enrollments: number;
  suppression_rate: number | null;
};

const SEQ_LABEL: Record<string, string> = {
  trial_onboarding: "Trial onboarding",
  trial_ending: "Trial por vencer",
  winback_inactive: "Win-back inactivos",
  approaching_limit: "Cerca del límite",
  cancellation_followup: "Post-cancelación",
};

export default function LifecyclePanel() {
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [bySeq, setBySeq] = useState<SeqRow[]>([]);
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: k }, { data: s }, { data: d, error: de }] = await Promise.all([
      supabase.from("v_lifecycle_kpis_30d" as never).select("*").maybeSingle(),
      supabase.from("v_lifecycle_by_sequence_30d" as never).select("*"),
      supabase.from("v_lifecycle_daily_30d" as never).select("*").order("day", { ascending: true }),
    ]);
    if (de) toast.error(de.message);
    setKpis((k as Kpis) ?? null);
    setBySeq((s as SeqRow[]) ?? []);
    setDaily((d as DailyRow[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    document.title = "Lifecycle emails · Superadmin · SistecPOS";
    load();
  }, [load]);

  const trigger = async (fn: "lifecycle-orchestrator" | "lifecycle-enroller") => {
    setRunning(fn);
    const { data, error } = await supabase.functions.invoke(fn, { body: {} });
    setRunning(null);
    if (error) return toast.error(`${fn}: ${error.message}`);
    toast.success(`${fn} ejecutado`, { description: JSON.stringify(data).slice(0, 120) });
    load();
  };

  const dailyTotals = useMemo(() => {
    const map = new Map<string, { day: string; sent: number; failed: number; suppressed: number }>();
    daily.forEach((r) => {
      const cur = map.get(r.day) ?? { day: r.day, sent: 0, failed: 0, suppressed: 0 };
      cur.sent += r.sent; cur.failed += r.failed; cur.suppressed += r.suppressed;
      map.set(r.day, cur);
    });
    return Array.from(map.values());
  }, [daily]);

  const deliveryRate = kpis && kpis.sends_sent_30d + kpis.sends_failed_30d > 0
    ? Math.round((kpis.sends_sent_30d / (kpis.sends_sent_30d + kpis.sends_failed_30d)) * 100)
    : 0;

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Mail className="w-5 h-5 text-primary" /> Lifecycle emails
          </h1>
          <p className="text-sm text-muted-foreground">Inscripciones, envíos y conversión por secuencia (últimos 30 días).</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button onClick={() => trigger("lifecycle-enroller")} disabled={running !== null} size="sm" variant="outline">
            <Users className="w-4 h-4 mr-1" /> Correr enroller
          </Button>
          <Button onClick={() => trigger("lifecycle-orchestrator")} disabled={running !== null} size="sm" variant="outline">
            <Send className="w-4 h-4 mr-1" /> Correr orchestrator
          </Button>
          <Button onClick={load} disabled={loading} size="sm">
            <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} /> Refrescar
          </Button>
        </div>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3">
          <p className="text-[11px] uppercase text-muted-foreground">Inscripciones 30d</p>
          <p className="text-2xl font-bold">{kpis?.enrollments_30d ?? "—"}</p>
          <p className="text-[11px] text-muted-foreground">{kpis?.active ?? 0} activas</p>
        </Card>
        <Card className="p-3 border-success/30">
          <p className="text-[11px] uppercase text-muted-foreground flex items-center gap-1"><CheckCircle2 className="w-3 h-3 text-success" /> Enviados</p>
          <p className="text-2xl font-bold text-success">{kpis?.sends_sent_30d ?? 0}</p>
          <p className="text-[11px] text-muted-foreground">{deliveryRate}% delivery</p>
        </Card>
        <Card className="p-3 border-destructive/30">
          <p className="text-[11px] uppercase text-muted-foreground flex items-center gap-1"><AlertTriangle className="w-3 h-3 text-destructive" /> Fallidos</p>
          <p className="text-2xl font-bold text-destructive">{kpis?.sends_failed_30d ?? 0}</p>
        </Card>
        <Card className="p-3">
          <p className="text-[11px] uppercase text-muted-foreground flex items-center gap-1"><ShieldOff className="w-3 h-3" /> Suprimidos</p>
          <p className="text-2xl font-bold">{kpis?.sends_suppressed_30d ?? 0}</p>
          <p className="text-[11px] text-muted-foreground">bounces / unsubs</p>
        </Card>
      </div>

      {/* Daily chart */}
      <Card className="p-3">
        <h2 className="text-sm font-semibold mb-2">Envíos diarios (30d)</h2>
        {dailyTotals.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Aún sin envíos.</p>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyTotals}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="sent" stroke="hsl(var(--success))" name="Enviados" />
                <Line type="monotone" dataKey="failed" stroke="hsl(var(--destructive))" name="Fallidos" />
                <Line type="monotone" dataKey="suppressed" stroke="hsl(var(--muted-foreground))" name="Suprimidos" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Per-sequence breakdown */}
      <Card className="p-3">
        <h2 className="text-sm font-semibold mb-2">Por secuencia</h2>
        {bySeq.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Sin secuencias activas en 30d.</p>
        ) : (
          <>
            <div className="h-64 mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bySeq.map((r) => ({ ...r, label: SEQ_LABEL[r.sequence] ?? r.sequence }))}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="enrollments" fill="hsl(var(--primary))" name="Inscripciones" />
                  <Bar dataKey="sent" fill="hsl(var(--success))" name="Enviados" />
                  <Bar dataKey="failed" fill="hsl(var(--destructive))" name="Fallidos" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="space-y-2">
              {bySeq.map((row) => {
                const completionRate = row.enrollments > 0 ? Math.round((row.completed / row.enrollments) * 100) : 0;
                return (
                  <div key={row.sequence} className="border border-border rounded-lg p-3 text-sm">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{SEQ_LABEL[row.sequence] ?? row.sequence}</span>
                        <code className="text-[10px] text-muted-foreground">{row.sequence}</code>
                      </div>
                      <Badge variant="outline" className="text-[10px]">{completionRate}% completado</Badge>
                    </div>
                    <div className="mt-2 grid grid-cols-3 md:grid-cols-6 gap-2 text-[11px]">
                      <Stat label="Inscripciones" value={row.enrollments} />
                      <Stat label="Activas" value={row.active} />
                      <Stat label="Completadas" value={row.completed} />
                      <Stat label="Enviados" value={row.sent} tone="success" />
                      <Stat label="Fallidos" value={row.failed} tone="destructive" />
                      <Stat label="Suprimidos" value={row.suppressed} />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "success" | "destructive" }) {
  const color = tone === "success" ? "text-success" : tone === "destructive" ? "text-destructive" : "text-foreground";
  return (
    <div className="rounded-md bg-muted/40 px-2 py-1.5">
      <p className="text-[10px] uppercase text-muted-foreground leading-tight">{label}</p>
      <p className={`text-base font-bold leading-tight ${color}`}>{value}</p>
    </div>
  );
}
