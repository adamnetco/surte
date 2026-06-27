import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Activity, RefreshCw, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

type Drift = {
  organization_id: string;
  organization_name: string | null;
  limit_key: string;
  counter_used: number;
  real_used: number;
  drift: number;
  updated_at: string;
};

/**
 * Slice 6 — Divergencias entre tenant_usage_counters y la fuente real.
 * Cero filas = los triggers + cron auto-heal están haciendo su trabajo.
 */
export function UsageDivergencePanel() {
  const [rows, setRows] = useState<Drift[]>([]);
  const [loading, setLoading] = useState(false);
  const [healing, setHealing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("v_usage_counter_divergence")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(100);
    setRows((data as Drift[]) ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const heal = async () => {
    setHealing(true);
    const { data, error } = await supabase.functions.invoke("usage-counters-recompute");
    setHealing(false);
    if (error) { toast.error("Auto-heal falló"); return; }
    toast.success(`Recalculados ${data?.recomputed ?? 0} contadores`);
    void load();
  };

  return (
    <Card className="p-4 rounded-lg border-border/60">
      <div className="flex items-center justify-between mb-3 gap-2">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">Divergencias de contadores</h3>
          <Badge variant={rows.length === 0 ? "secondary" : "destructive"} className="text-[10px]">
            {rows.length}
          </Badge>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button size="sm" variant="outline" onClick={heal} disabled={healing}>
            Auto-heal
          </Button>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
          <CheckCircle2 className="w-4 h-4 text-success" />
          Todos los contadores coinciden con la fuente real.
        </div>
      ) : (
        <div className="space-y-1.5 max-h-64 overflow-y-auto">
          {rows.map((r) => (
            <div
              key={`${r.organization_id}-${r.limit_key}`}
              className="flex items-center justify-between text-xs bg-muted/30 rounded px-2 py-1.5"
            >
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{r.organization_name ?? r.organization_id.slice(0, 8)}</div>
                <div className="text-muted-foreground">{r.limit_key}</div>
              </div>
              <div className="text-right tabular-nums">
                <div>{r.counter_used} → <span className="text-foreground font-semibold">{r.real_used}</span></div>
                <div className={`text-[10px] ${r.drift > 0 ? "text-warning" : "text-destructive"}`}>
                  drift {r.drift > 0 ? "+" : ""}{r.drift}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

export default UsageDivergencePanel;
