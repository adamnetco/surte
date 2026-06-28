import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Gift, RefreshCw, TrendingUp, Wallet, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type KPIs = {
  active_codes: number;
  total_conversions: number;
  qualified_conversions: number;
  total_credits_issued: number;
  total_credits_available: number;
  total_credits_redeemed: number;
  total_credits_expired: number;
  total_applied_to_invoices: number;
};

type Top = {
  code: string;
  organization_id: string;
  organization_name: string | null;
  qualified_count: number;
  total_conversions: number;
  total_credits_earned: number;
  credits_available: number;
};

const fmt = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n || 0);

export default function ReferralsPanel() {
  const [loading, setLoading] = useState(true);
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [top, setTop] = useState<Top[]>([]);
  const [expiring, setExpiring] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: k }, { data: t }] = await Promise.all([
      supabase.from("v_referral_program_kpis").select("*").maybeSingle(),
      supabase.from("v_referral_top_referrers").select("*").limit(50),
    ]);
    setKpis(k as KPIs);
    setTop((t || []) as Top[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const runExpire = async () => {
    setExpiring(true);
    const { data, error } = await supabase.rpc("expire_referral_credits");
    setExpiring(false);
    if (error) {
      toast.error("No se pudo ejecutar la expiración", { description: error.message });
      return;
    }
    const row = Array.isArray(data) ? data[0] : data;
    toast.success(`Expirados ${row?.expired_count ?? 0} créditos`, {
      description: `Monto total: ${fmt(Number(row?.expired_amount ?? 0))}`,
    });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Gift className="size-6 text-primary" />
            Programa de referidos
          </h1>
          <p className="text-sm text-muted-foreground">
            KPIs globales · top referidores · expiración de créditos
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={load} disabled={loading}>
            <RefreshCw className={`size-4 mr-1 ${loading ? "animate-spin" : ""}`} />
            Refrescar
          </Button>
          <Button size="sm" onClick={runExpire} disabled={expiring}>
            <Clock className="size-4 mr-1" />
            {expiring ? "Expirando…" : "Expirar créditos vencidos"}
          </Button>
        </div>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {loading || !kpis ? (
          Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-lg" />)
        ) : (
          <>
            <KpiCard label="Códigos activos" value={kpis.active_codes} />
            <KpiCard label="Conversiones totales" value={kpis.total_conversions} />
            <KpiCard
              label="Calificadas"
              value={kpis.qualified_conversions}
              badge={
                kpis.total_conversions > 0
                  ? `${((kpis.qualified_conversions / kpis.total_conversions) * 100).toFixed(0)}%`
                  : undefined
              }
              icon={<TrendingUp className="size-4 text-emerald-600" />}
            />
            <KpiCard label="Aplicado a facturas" value={fmt(kpis.total_applied_to_invoices)} icon={<Wallet className="size-4 text-primary" />} />
            <KpiCard label="Créditos emitidos" value={fmt(kpis.total_credits_issued)} />
            <KpiCard label="Disponibles" value={fmt(kpis.total_credits_available)} accent="success" />
            <KpiCard label="Canjeados" value={fmt(kpis.total_credits_redeemed)} />
            <KpiCard label="Expirados" value={fmt(kpis.total_credits_expired)} accent="muted" />
          </>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top referidores (50)</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded" />)}
            </div>
          ) : top.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Aún no hay referidores con actividad.</p>
          ) : (
            <div className="divide-y border rounded-lg">
              {top.map((r) => (
                <div key={r.code} className="flex items-center justify-between gap-3 px-3 py-2 text-sm">
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{r.organization_name || "—"}</div>
                    <div className="text-xs text-muted-foreground font-mono">{r.code}</div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="secondary">{r.qualified_count}/{r.total_conversions} calificadas</Badge>
                    <Badge variant="outline">{fmt(Number(r.total_credits_earned))} ganados</Badge>
                    <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                      {fmt(Number(r.credits_available))} disp.
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({
  label,
  value,
  badge,
  icon,
  accent,
}: {
  label: string;
  value: number | string;
  badge?: string;
  icon?: React.ReactNode;
  accent?: "success" | "muted";
}) {
  const accentCls =
    accent === "success" ? "text-emerald-700" : accent === "muted" ? "text-muted-foreground" : "text-foreground";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          {icon}
          {label}
        </div>
        <div className={`text-xl font-semibold mt-1 ${accentCls}`}>{value}</div>
        {badge && <Badge variant="secondary" className="mt-1">{badge}</Badge>}
      </CardContent>
    </Card>
  );
}
