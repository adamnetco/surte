import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TrendingUp, MousePointerClick, ShoppingCart, RefreshCw, Sparkles } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from "recharts";

type FunnelSummary = {
  window_days: number;
  denials: number;
  upgrade_clicks: number;
  addons_approved: number;
  subs_approved: number;
  tenants_denied: number;
  tenants_converted: number;
  click_through_rate: number;
  conversion_rate: number;
  by_reason: Array<{ key: string; metric: string; denials: number }>;
  daily: Array<{ day: string; denials: number; clicks: number }>;
};

const WINDOWS = [7, 14, 30, 90];

/**
 * ConversionFunnelPanel — PLG analytics: denials → upgrade clicks → Wompi approved.
 * Solo superadmin (RPC valida rol).
 */
export function ConversionFunnelPanel() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<FunnelSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = async (d = days) => {
    setLoading(true);
    setErr(null);
    const { data: res, error } = await (supabase as any).rpc("conversion_funnel_summary", {
      p_days: d,
    });
    if (error) setErr(error.message);
    else setData(res as FunnelSummary);
    setLoading(false);
  };

  useEffect(() => {
    void load(days);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  return (
    <section>
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <h2 className="text-sm font-semibold flex items-center gap-2">
          <Sparkles className="w-4 h-4" /> Embudo de conversión (PLG)
          <Badge variant="secondary" className="ml-1">Ola 17</Badge>
        </h2>
        <div className="flex items-center gap-1">
          {WINDOWS.map((w) => (
            <Button
              key={w}
              size="sm"
              variant={days === w ? "default" : "outline"}
              onClick={() => setDays(w)}
              className="h-7 px-2 text-xs"
            >
              {w}d
            </Button>
          ))}
          <Button onClick={() => load()} disabled={loading} variant="ghost" size="sm" className="h-7">
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      {err && (
        <Card className="p-3 border-destructive/40 bg-destructive/5 text-xs text-destructive mb-2">
          {err}
        </Card>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-3">
        <FunnelCard
          icon={<TrendingUp className="w-4 h-4 text-amber-600" />}
          label="Bloqueos"
          value={data?.denials ?? 0}
          sub={`${data?.tenants_denied ?? 0} tenants`}
        />
        <FunnelCard
          icon={<MousePointerClick className="w-4 h-4 text-blue-600" />}
          label="Clicks 'Mejorar'"
          value={data?.upgrade_clicks ?? 0}
          sub={`${data?.click_through_rate ?? 0}% CTR`}
        />
        <FunnelCard
          icon={<ShoppingCart className="w-4 h-4 text-green-600" />}
          label="Compras aprobadas"
          value={(data?.subs_approved ?? 0) + (data?.addons_approved ?? 0)}
          sub={`${data?.subs_approved ?? 0} subs · ${data?.addons_approved ?? 0} add-ons`}
        />
        <FunnelCard
          icon={<Sparkles className="w-4 h-4 text-purple-600" />}
          label="Tenants convertidos"
          value={data?.tenants_converted ?? 0}
          sub={`${data?.conversion_rate ?? 0}% conversión`}
        />
      </div>

      {data?.daily && data.daily.length > 0 && (
        <Card className="p-3 mb-3">
          <p className="text-[11px] uppercase text-muted-foreground mb-2">
            Bloqueos vs clicks · últimos {days} días
          </p>
          <div className="h-48 w-full">
            <ResponsiveContainer>
              <LineChart data={data.daily}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="denials" name="Bloqueos" stroke="#f59e0b" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="clicks" name="Clicks Mejorar" stroke="#3b82f6" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {data?.by_reason && data.by_reason.length > 0 && (
        <Card className="p-3">
          <p className="text-[11px] uppercase text-muted-foreground mb-2">Top razones de bloqueo</p>
          <div className="space-y-1">
            {data.by_reason.slice(0, 8).map((r, i) => (
              <div key={i} className="flex items-center justify-between text-xs gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Badge variant={r.metric === "limit_denied" ? "destructive" : "outline"} className="text-[10px] shrink-0">
                    {r.metric === "limit_denied" ? "Límite" : r.metric === "module_denied" ? "Módulo" : "Sub"}
                  </Badge>
                  <code className="font-mono text-[11px] bg-muted px-1.5 py-0.5 rounded truncate">{r.key}</code>
                </div>
                <span className="font-semibold tabular-nums">{r.denials}</span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </section>
  );
}

function FunnelCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: number; sub?: string }) {
  return (
    <Card className="p-3">
      <div className="flex items-center gap-1.5 mb-1">
        {icon}
        <p className="text-[11px] uppercase text-muted-foreground">{label}</p>
      </div>
      <p className="text-2xl font-bold tabular-nums">{value.toLocaleString()}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </Card>
  );
}

export default ConversionFunnelPanel;
