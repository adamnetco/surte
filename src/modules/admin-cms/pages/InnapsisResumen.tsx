// /admin/innapsis/resumen — Reporte agregado de facturación electrónica
// POS-innapsis-emision-pos AC11: emitidas / rechazadas / pendientes por rango.
// Cierre Ola 1 (Standup 2026-06-24).
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileText, CheckCircle2, XCircle, Clock, AlertTriangle, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import AdminHeader from "@/modules/admin-cms/components/AdminHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "sonner";

const COP = new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 });

const RANGE_PRESETS = [
  { key: "today", label: "Hoy", days: 0 },
  { key: "7d", label: "Últimos 7 días", days: 7 },
  { key: "30d", label: "Últimos 30 días", days: 30 },
  { key: "90d", label: "Últimos 90 días", days: 90 },
] as const;

type RangeKey = (typeof RANGE_PRESETS)[number]["key"];

function rangeBounds(key: RangeKey): { from: string; to: string } {
  const to = new Date();
  const from = new Date();
  if (key === "today") {
    from.setHours(0, 0, 0, 0);
  } else {
    const days = RANGE_PRESETS.find((r) => r.key === key)!.days;
    from.setDate(from.getDate() - days);
    from.setHours(0, 0, 0, 0);
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

export default function InnapsisResumen() {
  const navigate = useNavigate();
  const { currentOrg } = useOrganization();
  const [range, setRange] = useState<RangeKey>("7d");

  const bounds = useMemo(() => rangeBounds(range), [range]);

  const { data, isLoading } = useQuery({
    queryKey: ["innapsis-resumen", currentOrg?.id, range],
    queryFn: async () => {
      if (!currentOrg?.id) return null;
      const { data, error } = await supabase
        .from("electronic_invoices")
        .select("id, status, total, is_contingency, transmitted_at, created_at, document_type")
        .eq("organization_id", currentOrg.id)
        .gte("created_at", bounds.from)
        .lte("created_at", bounds.to)
        .limit(5000);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!currentOrg?.id,
    refetchInterval: 30_000,
  });

  const stats = useMemo(() => {
    const rows = data ?? [];
    const accepted = rows.filter((r) => r.status === "accepted");
    const rejected = rows.filter((r) => r.status === "rejected" || r.status === "error" || r.status === "dead_letter");
    const pending = rows.filter((r) => ["pending", "retrying", "in_progress"].includes(r.status));
    const contingency = rows.filter((r) => r.is_contingency && !r.transmitted_at);
    const sum = (xs: typeof rows) => xs.reduce((acc, r) => acc + Number(r.total ?? 0), 0);
    return {
      total: rows.length,
      accepted: { count: accepted.length, sum: sum(accepted) },
      rejected: { count: rejected.length, sum: sum(rejected) },
      pending: { count: pending.length, sum: sum(pending) },
      contingency: { count: contingency.length, sum: sum(contingency) },
    };
  }, [data]);

  const exportCsv = () => {
    if (!data || data.length === 0) {
      toast.error("Sin datos para exportar");
      return;
    }
    const header = "id,status,total,is_contingency,transmitted_at,created_at,document_type\n";
    const body = data
      .map((r) => [r.id, r.status, r.total, r.is_contingency, r.transmitted_at ?? "", r.created_at, r.document_type ?? ""].join(","))
      .join("\n");
    const blob = new Blob([header + body], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `innapsis-resumen-${range}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV descargado");
  };

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />
      <div className="mx-auto w-full max-w-7xl px-4 py-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => navigate("/admin/innapsis")}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="w-4 h-4" /> Volver
          </button>
          <button
            onClick={exportCsv}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg border border-gray-100 hover:bg-gray-50"
          >
            <Download className="w-4 h-4" /> Exportar CSV
          </button>
        </div>

        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Resumen de facturación electrónica</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Vista agregada por rango: emitidas, rechazadas, pendientes y contingencias.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {RANGE_PRESETS.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`px-3 py-1.5 text-sm rounded-lg border ${
                range === r.key
                  ? "bg-primary text-primary-foreground border-primary"
                  : "border-gray-100 hover:bg-gray-50"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-lg" />)}
          </div>
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Sin facturas en el rango"
            description="No se emitieron documentos en el período seleccionado."
          />
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard icon={CheckCircle2} label="Aceptadas" count={stats.accepted.count} sum={stats.accepted.sum} tone="success" />
              <StatCard icon={XCircle} label="Rechazadas" count={stats.rejected.count} sum={stats.rejected.sum} tone="error" />
              <StatCard icon={Clock} label="Pendientes" count={stats.pending.count} sum={stats.pending.sum} tone="warning" />
              <StatCard icon={AlertTriangle} label="Contingencia" count={stats.contingency.count} sum={stats.contingency.sum} tone="warning" />
            </div>

            <div className="rounded-lg border border-gray-100 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total de documentos</p>
                  <p className="text-2xl font-semibold">{stats.total}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-muted-foreground">Monto total aceptado</p>
                  <p className="text-2xl font-semibold text-emerald-600">{COP.format(stats.accepted.sum)}</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  count,
  sum,
  tone,
}: {
  icon: typeof FileText;
  label: string;
  count: number;
  sum: number;
  tone: "success" | "error" | "warning";
}) {
  const toneClass = {
    success: "text-emerald-600 bg-emerald-50",
    error: "text-red-600 bg-red-50",
    warning: "text-amber-600 bg-amber-50",
  }[tone];
  return (
    <div className="rounded-lg border border-gray-100 p-4">
      <div className="flex items-center gap-2">
        <div className={`p-1.5 rounded-md ${toneClass}`}>
          <Icon className="w-4 h-4" />
        </div>
        <span className="text-sm text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-semibold mt-2">{count}</p>
      <p className="text-xs text-muted-foreground mt-1">{COP.format(sum)}</p>
    </div>
  );
}
