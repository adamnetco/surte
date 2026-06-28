import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertOctagon, RefreshCw, Play, XCircle, Clock, TrendingDown, TrendingUp, AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";

type Kpis = {
  open_cases: number;
  paused_cases: number;
  recovered_cases: number;
  written_off_cases: number;
  canceled_cases: number;
  mrr_at_risk_cop: number;
  recovered_30d_cop: number;
  lost_30d_cop: number;
  recovery_rate_30d_pct: number;
};

type DailyRow = { day: string; opened: number; recovered: number; lost: number; amount_cop: number };

type Case = {
  id: string;
  organization_id: string;
  subscription_id: string | null;
  status: string;
  failure_reason: string | null;
  attempt_count: number;
  next_retry_at: string | null;
  opened_at: string;
  closed_at: string | null;
  total_amount_cop: number;
  grace_until: string | null;
  organizations?: { name: string | null; slug: string | null } | null;
};

const STATUS_BADGE: Record<string, { variant: "default"|"destructive"|"secondary"|"outline"; label: string }> = {
  open: { variant: "destructive", label: "Abierto" },
  paused: { variant: "outline", label: "Pausado" },
  recovered: { variant: "secondary", label: "Recuperado" },
  written_off: { variant: "outline", label: "Castigado" },
  canceled_nonpayment: { variant: "outline", label: "Cancelado" },
};

const fmtCop = (n: number) => new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n || 0);

export default function DunningPanel() {
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [daily, setDaily] = useState<DailyRow[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: k }, { data: d }, { data: c, error: ce }] = await Promise.all([
      supabase.from("v_dunning_global_kpis" as never).select("*").maybeSingle(),
      supabase.from("v_dunning_daily" as never).select("*").order("day", { ascending: true }),
      supabase
        .from("dunning_cases")
        .select("id, organization_id, subscription_id, status, failure_reason, attempt_count, next_retry_at, opened_at, closed_at, total_amount_cop, grace_until, organizations(name, slug)")
        .order("opened_at", { ascending: false })
        .limit(200),
    ]);
    if (ce) toast.error(ce.message);
    setKpis((k as Kpis) ?? null);
    setDaily((d as DailyRow[]) ?? []);
    setCases((c as unknown as Case[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => {
    document.title = "Dunning & morosidad · Superadmin · SistecPOS";
    load();
  }, [load]);

  const filtered = useMemo(() => {
    return cases.filter((c) => {
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const name = c.organizations?.name?.toLowerCase() ?? "";
        const slug = c.organizations?.slug?.toLowerCase() ?? "";
        if (!name.includes(q) && !slug.includes(q) && !c.id.includes(q)) return false;
      }
      return true;
    });
  }, [cases, statusFilter, search]);

  const forceRetry = async (id: string) => {
    if (!confirm("¿Forzar reintento inmediato de este caso?")) return;
    setBusyId(id);
    const { error } = await supabase.rpc("dunning_force_retry" as never, { p_case_id: id } as never);
    setBusyId(null);
    if (error) return toast.error(error.message);
    toast.success("Reintento agendado");
    load();
  };

  const writeOff = async (id: string) => {
    const reason = prompt("Motivo del castigo (write-off):", "Cliente no contesta tras 4 intentos");
    if (reason === null) return;
    setBusyId(id);
    const { error } = await supabase.rpc("dunning_write_off" as never, { p_case_id: id, p_reason: reason } as never);
    setBusyId(null);
    if (error) return toast.error(error.message);
    toast.success("Caso castigado");
    load();
  };

  const extendGrace = async (id: string) => {
    const days = prompt("Días extra de gracia (1–60):", "7");
    if (!days) return;
    const n = parseInt(days, 10);
    if (!n || n < 1 || n > 60) return toast.error("Días inválidos");
    setBusyId(id);
    const { error } = await supabase.rpc("dunning_extend_grace" as never, { p_case_id: id, p_extra_days: n } as never);
    setBusyId(null);
    if (error) return toast.error(error.message);
    toast.success(`Gracia extendida ${n} días`);
    load();
  };

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <AlertOctagon className="w-5 h-5 text-destructive" /> Dunning & morosidad
          </h1>
          <p className="text-sm text-muted-foreground">Casos abiertos, recuperación y churn involuntario.</p>
        </div>
        <Button onClick={load} disabled={loading} variant="outline" size="sm">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refrescar
        </Button>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3 border-destructive/40">
          <p className="text-[11px] uppercase text-muted-foreground">Casos abiertos</p>
          <p className="text-2xl font-bold text-destructive">{kpis?.open_cases ?? "—"}</p>
          <p className="text-[11px] text-muted-foreground">+ {kpis?.paused_cases ?? 0} pausados</p>
        </Card>
        <Card className="p-3">
          <p className="text-[11px] uppercase text-muted-foreground">MRR en riesgo</p>
          <p className="text-xl font-bold">{fmtCop(kpis?.mrr_at_risk_cop ?? 0)}</p>
        </Card>
        <Card className="p-3 border-success/30">
          <p className="text-[11px] uppercase text-muted-foreground flex items-center gap-1"><TrendingUp className="w-3 h-3 text-success" /> Recuperado (30d)</p>
          <p className="text-xl font-bold text-success">{fmtCop(kpis?.recovered_30d_cop ?? 0)}</p>
          <p className="text-[11px] text-muted-foreground">{kpis?.recovery_rate_30d_pct ?? 0}% tasa</p>
        </Card>
        <Card className="p-3">
          <p className="text-[11px] uppercase text-muted-foreground flex items-center gap-1"><TrendingDown className="w-3 h-3 text-destructive" /> Perdido (30d)</p>
          <p className="text-xl font-bold">{fmtCop(kpis?.lost_30d_cop ?? 0)}</p>
          <p className="text-[11px] text-muted-foreground">{(kpis?.written_off_cases ?? 0) + (kpis?.canceled_cases ?? 0)} casos</p>
        </Card>
      </div>

      {/* Cohort chart */}
      <Card className="p-3">
        <h2 className="text-sm font-semibold mb-2">Cohorte últimos 60 días</h2>
        {daily.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">Sin datos.</p>
        ) : (
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={daily}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="opened" stroke="hsl(var(--destructive))" name="Abiertos" />
                <Line type="monotone" dataKey="recovered" stroke="hsl(var(--success))" name="Recuperados" />
                <Line type="monotone" dataKey="lost" stroke="hsl(var(--muted-foreground))" name="Perdidos" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los estados</SelectItem>
            <SelectItem value="open">Abiertos</SelectItem>
            <SelectItem value="paused">Pausados</SelectItem>
            <SelectItem value="recovered">Recuperados</SelectItem>
            <SelectItem value="written_off">Castigados</SelectItem>
            <SelectItem value="canceled_nonpayment">Cancelados</SelectItem>
          </SelectContent>
        </Select>
        <Input
          placeholder="Buscar por tienda o id…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-9 max-w-xs"
        />
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} / {cases.length}</span>
      </div>

      {/* Cases list (mobile-first vertical cards) */}
      <div className="space-y-2">
        {loading && cases.length === 0 && <Card className="h-24 animate-pulse bg-muted/40" />}
        {!loading && filtered.length === 0 && (
          <Card className="p-6 text-center text-sm text-muted-foreground">Sin casos con estos filtros.</Card>
        )}
        {filtered.map((c) => {
          const badge = STATUS_BADGE[c.status] ?? { variant: "outline" as const, label: c.status };
          const isOpen = c.status === "open" || c.status === "paused";
          return (
            <Card key={c.id} className="p-3 text-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant={badge.variant} className="text-[10px]">{badge.label}</Badge>
                    <span className="font-semibold truncate">{c.organizations?.name ?? c.organization_id.slice(0, 8)}</span>
                    {c.organizations?.slug && <code className="text-[10px] text-muted-foreground">/{c.organizations.slug}</code>}
                    <Badge variant="outline" className="text-[10px]">intento {c.attempt_count}/4</Badge>
                  </div>
                  <div className="mt-1 text-[12px] text-muted-foreground flex flex-wrap gap-x-3 gap-y-1">
                    <span>Abierto: {new Date(c.opened_at).toLocaleString("es-CO")}</span>
                    {c.next_retry_at && <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> próx. {new Date(c.next_retry_at).toLocaleString("es-CO")}</span>}
                    {c.grace_until && <span>Gracia hasta {new Date(c.grace_until).toLocaleDateString("es-CO")}</span>}
                  </div>
                  {c.failure_reason && (
                    <p className="mt-1 text-[12px] flex items-start gap-1 text-destructive">
                      <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" /> {c.failure_reason}
                    </p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-base font-bold">{fmtCop(c.total_amount_cop)}</p>
                </div>
              </div>
              {isOpen && (
                <div className="mt-2 flex flex-wrap gap-2 justify-end">
                  <Button size="sm" variant="outline" disabled={busyId === c.id} onClick={() => extendGrace(c.id)}>
                    <Clock className="w-3.5 h-3.5 mr-1" /> Extender gracia
                  </Button>
                  <Button size="sm" variant="outline" disabled={busyId === c.id} onClick={() => writeOff(c.id)}>
                    <XCircle className="w-3.5 h-3.5 mr-1" /> Castigar
                  </Button>
                  <Button size="sm" disabled={busyId === c.id} onClick={() => forceRetry(c.id)}>
                    <Play className="w-3.5 h-3.5 mr-1" /> Forzar retry
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}
