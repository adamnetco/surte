import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Smile, MessageSquareWarning, RefreshCw, TrendingUp, Users, Ticket, MessageCircle, CheckCircle2, Download, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type KPIs = {
  nps_score: number | null;
  nps_responses: number;
  promoters: number;
  passives: number;
  detractors: number;
  csat_avg: number;
  csat_responses: number;
  total_responses: number;
};

type CampaignRow = {
  code: string;
  name: string;
  type: "nps" | "csat";
  is_active: boolean;
  shown: number;
  responses: number;
  response_rate: number;
  avg_score: number | null;
};

type Detractor = {
  id: string;
  score: number;
  comment: string | null;
  created_at: string;
  campaign_code: string;
  campaign_name: string;
  org_name: string | null;
  org_id: string | null;
  ticket_id: string | null;
  csm_alerted_at: string | null;
  user_id: string | null;
};

const RANGES = [
  { label: "7 días", value: 7 },
  { label: "30 días", value: 30 },
  { label: "90 días", value: 90 },
  { label: "12 meses", value: 365 },
];

const npsTone = (score: number | null) => {
  if (score === null) return "text-muted-foreground";
  if (score >= 50) return "text-emerald-600";
  if (score >= 0) return "text-amber-600";
  return "text-red-600";
};

export default function SurveysPanel() {
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [kpis, setKpis] = useState<KPIs | null>(null);
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [detractors, setDetractors] = useState<Detractor[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const createTicket = async (d: Detractor) => {
    setActionLoading(d.id + ":ticket");
    const { data, error } = await supabase.rpc("survey_create_detractor_ticket", { p_response_id: d.id });
    setActionLoading(null);
    if (error) return toast.error("No se pudo crear ticket", { description: error.message });
    toast.success("Ticket de soporte creado", { description: `ID ${String(data).slice(0, 8)}` });
    load();
  };

  const alertCsm = async (d: Detractor) => {
    setActionLoading(d.id + ":csm");
    try {
      const { data: setting } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "csm_whatsapp_phone")
        .maybeSingle();
      const phone = (setting?.value as any)?.phone || (setting?.value as any);
      if (!phone || typeof phone !== "string") {
        toast.error("Configura csm_whatsapp_phone en app_settings");
        setActionLoading(null);
        return;
      }
      const message =
        `🚨 Detractor ${d.campaign_code.toUpperCase()} score ${d.score}\n` +
        `Org: ${d.org_name ?? "(sin nombre)"}\n` +
        `Comentario: ${d.comment ?? "(sin comentario)"}\n` +
        `Fecha: ${new Date(d.created_at).toLocaleString("es-CO")}`;
      const { error } = await supabase.functions.invoke("send-ycloud-whatsapp", {
        body: { action: "send_text", to: phone, message },
      });
      if (error) throw error;
      await supabase.rpc("survey_mark_csm_alerted", { p_response_id: d.id });
      toast.success("CSM alertado por WhatsApp");
      load();
    } catch (e: any) {
      toast.error("No se pudo alertar al CSM", { description: e?.message });
    } finally {
      setActionLoading(null);
    }
  };

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("get_survey_analytics", { p_days: days });
    if (error) {
      toast.error("No se pudo cargar analítica de encuestas", { description: error.message });
      setLoading(false);
      return;
    }
    const payload = data as any;
    setKpis(payload?.kpis ?? null);
    setCampaigns((payload?.campaigns ?? []) as CampaignRow[]);
    setDetractors((payload?.detractors ?? []) as Detractor[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [days]);

  return (
    <div className="space-y-6 p-4 md:p-6">
      <header className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">NPS &amp; CSAT</h1>
          <p className="text-sm text-muted-foreground">
            Salud de la experiencia: score NPS, satisfacción media y detractores recientes.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {RANGES.map((r) => (
            <Button
              key={r.value}
              size="sm"
              variant={days === r.value ? "default" : "outline"}
              onClick={() => setDays(r.value)}
            >
              {r.label}
            </Button>
          ))}
          <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <TrendingUp className="h-4 w-4" /> NPS
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-9 w-24" />
            ) : (
              <div className={`text-4xl font-bold ${npsTone(kpis?.nps_score ?? null)}`}>
                {kpis?.nps_score ?? "—"}
              </div>
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              {kpis?.promoters ?? 0} promotores · {kpis?.passives ?? 0} pasivos · {kpis?.detractors ?? 0} detractores
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <Smile className="h-4 w-4" /> CSAT promedio
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-9 w-24" />
            ) : (
              <div className="text-4xl font-bold">{kpis?.csat_avg ?? 0} / 5</div>
            )}
            <p className="mt-1 text-xs text-muted-foreground">{kpis?.csat_responses ?? 0} respuestas</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" /> Respuestas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-9 w-24" />
            ) : (
              <div className="text-4xl font-bold">{kpis?.total_responses ?? 0}</div>
            )}
            <p className="mt-1 text-xs text-muted-foreground">Total en el periodo</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm text-muted-foreground">
              <MessageSquareWarning className="h-4 w-4" /> Alertas
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-9 w-24" />
            ) : (
              <div className="text-4xl font-bold text-red-600">{detractors.length}</div>
            )}
            <p className="mt-1 text-xs text-muted-foreground">Detractores listados abajo</p>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Campañas activas</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : campaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin campañas configuradas.</p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {campaigns.map((c) => (
                <li key={c.code} className="flex flex-col gap-2 p-3 md:flex-row md:items-center md:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant={c.is_active ? "default" : "outline"}>{c.type.toUpperCase()}</Badge>
                      <span className="font-medium">{c.name}</span>
                      <code className="text-xs text-muted-foreground">{c.code}</code>
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <span>
                      <strong>{c.responses}</strong>/{c.shown} respuestas
                    </span>
                    <span className="text-muted-foreground">
                      Tasa: <strong>{c.response_rate}%</strong>
                    </span>
                    {c.avg_score !== null && (
                      <span className="text-muted-foreground">
                        Promedio: <strong>{c.avg_score}</strong>
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Top detractores recientes</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : detractors.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin detractores en el periodo seleccionado. 🎉</p>
          ) : (
            <ul className="space-y-2">
              {detractors.map((d) => (
                <li key={d.id} className="rounded-lg border border-red-100 bg-red-50/40 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="destructive">{d.score}</Badge>
                      <span className="font-medium">{d.org_name ?? "Org sin nombre"}</span>
                      <span className="text-xs text-muted-foreground">{d.campaign_name}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {new Date(d.created_at).toLocaleString("es-CO")}
                    </span>
                  </div>
                  {d.comment && <p className="mt-2 text-sm text-foreground/80">"{d.comment}"</p>}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {d.ticket_id ? (
                      <Badge variant="outline" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" /> Ticket #{d.ticket_id.slice(0, 8)}
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionLoading === d.id + ":ticket"}
                        onClick={() => createTicket(d)}
                      >
                        <Ticket className="mr-1 h-4 w-4" /> Abrir ticket
                      </Button>
                    )}
                    {d.csm_alerted_at ? (
                      <Badge variant="outline" className="gap-1">
                        <CheckCircle2 className="h-3 w-3" /> CSM alertado
                      </Badge>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={actionLoading === d.id + ":csm"}
                        onClick={() => alertCsm(d)}
                      >
                        <MessageCircle className="mr-1 h-4 w-4" /> Alertar CSM
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
