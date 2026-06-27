import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Award, Heart, AlertTriangle, Moon, Sparkles, RefreshCw, Download, Users2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import RfmCampaignSheet from "./RfmCampaignSheet";

const SEGMENTS = [
  { key: "Champions", icon: Award, color: "bg-emerald-500/10 text-emerald-700 border-emerald-300" },
  { key: "Loyal", icon: Heart, color: "bg-blue-500/10 text-blue-700 border-blue-300" },
  { key: "New", icon: Sparkles, color: "bg-violet-500/10 text-violet-700 border-violet-300" },
  { key: "Potential", icon: Users2, color: "bg-slate-500/10 text-slate-700 border-slate-300" },
  { key: "At Risk", icon: AlertTriangle, color: "bg-orange-500/10 text-orange-700 border-orange-300" },
  { key: "Hibernating", icon: Moon, color: "bg-zinc-500/10 text-zinc-700 border-zinc-300" },
] as const;

const fmtCop = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n || 0);

const SegmentsTab = () => {
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;
  const qc = useQueryClient();
  const [active, setActive] = useState<string>("Champions");
  const [campaignOpen, setCampaignOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["customer-segments", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customer_segments")
        .select("id,profile_id,segment,recency_days,frequency,monetary,r_score,f_score,m_score,last_purchase_at,computed_at,profiles!inner(full_name,phone,city,customer_code)")
        .eq("organization_id", orgId!)
        .order("monetary", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return data || [];
    },
  });

  const recompute = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.rpc("recompute_rfm", { p_organization_id: orgId! });
      if (error) throw error;
      return data as any;
    },
    onSuccess: (r) => {
      toast.success(`Segmentación actualizada (${r?.updated ?? 0} clientes)`);
      qc.invalidateQueries({ queryKey: ["customer-segments", orgId] });
    },
    onError: (e: any) => toast.error(e.message || "Error al recalcular"),
  });

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    (data || []).forEach((r: any) => map.set(r.segment, (map.get(r.segment) || 0) + 1));
    return map;
  }, [data]);

  const rows = useMemo(() => (data || []).filter((r: any) => r.segment === active), [data, active]);

  const exportCsv = () => {
    if (rows.length === 0) return;
    const header = "nombre,telefono,ciudad,codigo,frecuencia,monetario,dias_sin_comprar,ultima_compra\n";
    const csv = rows.map((r: any) =>
      [
        r.profiles?.full_name || "",
        r.profiles?.phone || "",
        r.profiles?.city || "",
        r.profiles?.customer_code || "",
        r.frequency,
        r.monetary,
        r.recency_days ?? "",
        r.last_purchase_at ? new Date(r.last_purchase_at).toISOString().slice(0, 10) : "",
      ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(",")
    ).join("\n");
    const blob = new Blob([header + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `segmento-${active.toLowerCase().replace(/\s/g, "-")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!currentOrg) {
    return <div className="p-4 text-sm text-muted-foreground">Selecciona una organización.</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Users2 className="h-5 w-5" /> Segmentación RFM
          </h2>
          <p className="text-sm text-muted-foreground">
            Recency · Frequency · Monetary — clasificación automática para campañas.
          </p>
        </div>
        <Button onClick={() => recompute.mutate()} disabled={recompute.isPending} size="sm" className="gap-1">
          <RefreshCw className={`h-4 w-4 ${recompute.isPending ? "animate-spin" : ""}`} /> Recalcular
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2">
        {SEGMENTS.map((s) => {
          const Icon = s.icon;
          const c = counts.get(s.key) || 0;
          const isActive = active === s.key;
          return (
            <button
              key={s.key}
              onClick={() => setActive(s.key)}
              className={`rounded-lg border p-2.5 text-left transition ${s.color} ${isActive ? "ring-2 ring-primary" : "opacity-80 hover:opacity-100"}`}
            >
              <div className="flex items-center gap-1.5 text-xs font-medium">
                <Icon className="h-3.5 w-3.5" /> {s.key}
              </div>
              <div className="text-2xl font-bold mt-1">{c}</div>
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{active} ({rows.length})</h3>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={rows.length === 0} className="gap-1">
          <Download className="h-3.5 w-3.5" /> CSV
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-14 w-full" />)}</div>
      ) : rows.length === 0 ? (
        <div className="text-center py-10 text-sm text-muted-foreground border border-dashed border-border rounded-lg">
          Sin clientes en este segmento. Recalcula si acabas de registrar ventas.
        </div>
      ) : (
        <div className="space-y-1.5 max-h-[60vh] overflow-y-auto">
          {rows.map((r: any) => (
            <div key={r.id} className="border border-border rounded-lg p-2.5 bg-card flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium text-sm truncate">{r.profiles?.full_name || "Sin nombre"}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {[r.profiles?.customer_code, r.profiles?.phone, r.profiles?.city].filter(Boolean).join(" · ") || "—"}
                </div>
              </div>
              <div className="text-right shrink-0 text-xs">
                <div className="font-semibold text-sm">{fmtCop(Number(r.monetary))}</div>
                <div className="text-muted-foreground">
                  {r.frequency}× · {r.recency_days != null ? `${r.recency_days}d` : "—"}
                </div>
                <div className="flex gap-1 mt-0.5 justify-end">
                  <Badge variant="outline" className="text-[10px] px-1">R{r.r_score}</Badge>
                  <Badge variant="outline" className="text-[10px] px-1">F{r.f_score}</Badge>
                  <Badge variant="outline" className="text-[10px] px-1">M{r.m_score}</Badge>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default SegmentsTab;
