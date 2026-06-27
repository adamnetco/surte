import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Lock, TrendingUp, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Row = {
  organization_id: string;
  day: string;
  metric: string;
  key: string;
  denials: number;
  distinct_users: number;
  last_denial_at: string;
};

/**
 * GateDenialsPanel — PLG signal. Muestra qué tenants están topando con su plan
 * (módulo bloqueado o límite excedido) en los últimos 14 días.
 */
export function GateDenialsPanel() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - 14 * 86400_000).toISOString().slice(0, 10);
    const { data } = await (supabase as any)
      .from("v_gate_denials_daily")
      .select("*")
      .gte("day", since)
      .order("denials", { ascending: false })
      .limit(50);
    setRows((data as Row[]) ?? []);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const totalDenials = rows.reduce((s, r) => s + r.denials, 0);
  const tenantsHit = new Set(rows.map((r) => r.organization_id)).size;

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Lock className="w-4 h-4" /> Bloqueos por plan (últ. 14 días)
          <Badge variant="secondary" className="ml-1">PLG</Badge>
        </h2>
        <Button onClick={load} disabled={loading} variant="ghost" size="sm">
          <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refrescar
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-3">
        <Card className="p-3">
          <p className="text-[11px] uppercase text-muted-foreground">Total bloqueos</p>
          <p className="text-2xl font-bold">{totalDenials}</p>
        </Card>
        <Card className="p-3">
          <p className="text-[11px] uppercase text-muted-foreground">Tenants topando</p>
          <p className="text-2xl font-bold flex items-center gap-2">
            {tenantsHit} <TrendingUp className="w-4 h-4 text-success" />
          </p>
        </Card>
        <Card className="p-3">
          <p className="text-[11px] uppercase text-muted-foreground">Líneas (top 50)</p>
          <p className="text-2xl font-bold">{rows.length}</p>
        </Card>
      </div>

      {rows.length === 0 ? (
        <Card className="p-4 text-sm text-muted-foreground text-center">
          Sin bloqueos registrados en los últimos 14 días.
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((r, i) => (
            <Card key={i} className="p-3 flex items-center justify-between gap-3 text-sm">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-0.5">
                  <code className="text-xs font-mono bg-muted px-1.5 py-0.5 rounded">{r.key}</code>
                  <Badge variant={r.metric === "limit_denied" ? "destructive" : "outline"} className="text-[10px]">
                    {r.metric === "limit_denied" ? "Límite" : "Módulo"}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground truncate">
                  org <code>{r.organization_id.slice(0, 8)}…</code> · {r.day} · {r.distinct_users} usuario(s)
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xl font-bold">{r.denials}</p>
                <p className="text-[10px] text-muted-foreground">bloqueos</p>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}

export default GateDenialsPanel;
