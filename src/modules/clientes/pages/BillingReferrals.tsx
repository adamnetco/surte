import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Gift, Copy, Share2, Plus, Users, TrendingUp, Clock } from "lucide-react";
import { toast } from "sonner";

interface ReferralCode {
  id: string;
  code: string;
  campaign_name: string | null;
  is_active: boolean;
  uses_count: number;
  max_uses: number | null;
  expires_at: string | null;
  created_at: string;
}

interface Conversion {
  id: string;
  status: string;
  reward_amount: number;
  reward_currency: string;
  referee_email: string | null;
  created_at: string;
  qualified_at: string | null;
}

interface RewardConfig {
  referrer_reward_amount: number;
  referrer_reward_currency: string;
  referee_discount_pct: number;
  qualifying_period_days: number;
}

interface CreditBalance {
  currency: string;
  available_amount: number;
  consumed_amount: number;
  expired_amount: number;
  available_count: number;
}

const COP = (n: number) => "$" + Math.round(n || 0).toLocaleString("es-CO");

const STATUS_META: Record<string, { label: string; tone: string }> = {
  pending: { label: "Pendiente", tone: "bg-yellow-100 text-yellow-800" },
  qualified: { label: "Calificada", tone: "bg-blue-100 text-blue-800" },
  rewarded: { label: "Recompensada", tone: "bg-emerald-100 text-emerald-800" },
  expired: { label: "Expirada", tone: "bg-muted text-muted-foreground" },
  rejected: { label: "Rechazada", tone: "bg-destructive/10 text-destructive" },
};

export default function BillingReferrals() {
  const { currentOrg } = useOrganization();
  const [codes, setCodes] = useState<ReferralCode[]>([]);
  const [conversions, setConversions] = useState<Conversion[]>([]);
  const [config, setConfig] = useState<RewardConfig | null>(null);
  const [balances, setBalances] = useState<CreditBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [campaignName, setCampaignName] = useState("");

  const orgId = currentOrg?.id;

  const load = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const [cRes, convRes, cfgRes, balRes] = await Promise.all([
      supabase.from("referral_codes" as never).select("*").eq("organization_id", orgId).order("created_at", { ascending: false }),
      supabase.from("referral_conversions" as never).select("*").eq("referrer_org_id", orgId).order("created_at", { ascending: false }).limit(50),
      supabase.from("referral_rewards_config" as never).select("*").eq("is_active", true).is("plan_code", null).maybeSingle(),
      supabase.from("v_referral_credit_balance" as never).select("*").eq("organization_id", orgId),
    ]);
    if (cRes.error) toast.error(cRes.error.message);
    setCodes((cRes.data as unknown as ReferralCode[]) ?? []);
    setConversions((convRes.data as unknown as Conversion[]) ?? []);
    setConfig((cfgRes.data as unknown as RewardConfig) ?? null);
    setBalances((balRes.data as unknown as CreditBalance[]) ?? []);
    setLoading(false);
  }, [orgId]);

  useEffect(() => {
    document.title = "Referidos · Billing · SistecPOS";
    load();
  }, [load]);

  const createCode = async () => {
    if (!orgId) return;
    setCreating(true);
    const { data: codeData, error: rpcErr } = await supabase.rpc("generate_referral_code" as never);
    if (rpcErr || !codeData) {
      setCreating(false);
      return toast.error(rpcErr?.message ?? "No se pudo generar el código");
    }
    const { data: userData } = await supabase.auth.getUser();
    const { error } = await supabase.from("referral_codes" as never).insert({
      organization_id: orgId,
      created_by: userData?.user?.id ?? null,
      code: codeData as unknown as string,
      campaign_name: campaignName.trim() || null,
    } as never);
    setCreating(false);
    if (error) return toast.error(error.message);
    toast.success("Código de referido creado");
    setCampaignName("");
    load();
  };

  const copyLink = async (code: string) => {
    const url = `${window.location.origin}/signup?ref=${code}`;
    await navigator.clipboard.writeText(url);
    toast.success("Enlace copiado", { description: url });
  };

  const share = async (code: string) => {
    const url = `${window.location.origin}/signup?ref=${code}`;
    const text = `Te invito a probar SistecPOS. Usa mi código ${code} y recibe ${config?.referee_discount_pct ?? 20}% de descuento en tu primer mes: ${url}`;
    if (navigator.share) {
      try { await navigator.share({ title: "SistecPOS", text, url }); } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(text);
      toast.success("Mensaje copiado al portapapeles");
    }
  };

  const stats = useMemo(() => {
    const totalConv = conversions.length;
    const qualified = conversions.filter((c) => ["qualified", "rewarded"].includes(c.status)).length;
    const earnedCop = conversions
      .filter((c) => c.status === "rewarded" && c.reward_currency === "COP")
      .reduce((a, c) => a + Number(c.reward_amount || 0), 0);
    const pendingRewards = conversions
      .filter((c) => c.status === "qualified" && c.reward_currency === "COP")
      .reduce((a, c) => a + Number(c.reward_amount || 0), 0);
    return { totalConv, qualified, earnedCop, pendingRewards };
  }, [conversions]);

  if (!orgId) {
    return <div className="p-4 text-sm text-muted-foreground">Selecciona una organización.</div>;
  }

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <header>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Gift className="w-5 h-5 text-primary" /> Programa de referidos
        </h1>
        <p className="text-sm text-muted-foreground">
          Invita otras tiendas y gana {config ? COP(config.referrer_reward_amount) : "—"} de crédito por cada conversión. Tus referidos reciben {config?.referee_discount_pct ?? 20}% de descuento en su primer mes.
        </p>
      </header>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3">
          <p className="text-[11px] uppercase text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" /> Referidos</p>
          <p className="text-2xl font-bold">{stats.totalConv}</p>
        </Card>
        <Card className="p-3">
          <p className="text-[11px] uppercase text-muted-foreground flex items-center gap-1"><TrendingUp className="w-3 h-3 text-success" /> Calificados</p>
          <p className="text-2xl font-bold text-success">{stats.qualified}</p>
        </Card>
        <Card className="p-3 border-success/30">
          <p className="text-[11px] uppercase text-muted-foreground">Recompensas ganadas</p>
          <p className="text-2xl font-bold text-success">{COP(stats.earnedCop)}</p>
        </Card>
        <Card className="p-3">
          <p className="text-[11px] uppercase text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" /> Por aprobar</p>
          <p className="text-2xl font-bold">{COP(stats.pendingRewards)}</p>
        </Card>
      </div>

      {/* Crear código */}
      <Card className="p-3">
        <h2 className="text-sm font-semibold mb-2">Crear nuevo código</h2>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="text-xs text-muted-foreground">Nombre de campaña (opcional)</label>
            <Input
              value={campaignName}
              onChange={(e) => setCampaignName(e.target.value)}
              placeholder="Ej: Black Friday 2026"
              maxLength={80}
            />
          </div>
          <Button onClick={createCode} disabled={creating}>
            <Plus className="w-4 h-4 mr-1" />
            {creating ? "Creando…" : "Generar código"}
          </Button>
        </div>
      </Card>

      {/* Códigos */}
      <Card className="p-3">
        <h2 className="text-sm font-semibold mb-2">Mis códigos</h2>
        {loading ? (
          <Skeleton className="h-24" />
        ) : codes.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Aún no tienes códigos. Crea uno arriba.</p>
        ) : (
          <div className="space-y-2">
            {codes.map((c) => (
              <div key={c.id} className="border border-border rounded-lg p-3 flex flex-wrap items-center gap-3">
                <code className="text-lg font-bold tracking-wider text-primary">{c.code}</code>
                {c.campaign_name && <span className="text-sm text-muted-foreground">· {c.campaign_name}</span>}
                <Badge variant={c.is_active ? "default" : "outline"} className="text-[10px]">
                  {c.is_active ? "Activo" : "Inactivo"}
                </Badge>
                <Badge variant="outline" className="text-[10px]">{c.uses_count} usos</Badge>
                <div className="ml-auto flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => copyLink(c.code)}>
                    <Copy className="w-3.5 h-3.5 mr-1" /> Copiar enlace
                  </Button>
                  <Button size="sm" onClick={() => share(c.code)}>
                    <Share2 className="w-3.5 h-3.5 mr-1" /> Compartir
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Conversiones */}
      <Card className="p-3">
        <h2 className="text-sm font-semibold mb-2">Historial de conversiones</h2>
        {loading ? (
          <Skeleton className="h-24" />
        ) : conversions.length === 0 ? (
          <p className="text-sm text-muted-foreground py-6 text-center">Aún no hay conversiones. Comparte tu código para empezar.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-left text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="py-1.5 pr-2">Fecha</th>
                  <th className="py-1.5 pr-2">Referido</th>
                  <th className="py-1.5 pr-2">Estado</th>
                  <th className="py-1.5 pr-2 text-right">Recompensa</th>
                </tr>
              </thead>
              <tbody>
                {conversions.map((c) => {
                  const meta = STATUS_META[c.status] ?? STATUS_META.pending;
                  return (
                    <tr key={c.id} className="border-b border-border/40">
                      <td className="py-2 pr-2">{new Date(c.created_at).toLocaleDateString("es-CO")}</td>
                      <td className="py-2 pr-2 truncate max-w-[220px]">{c.referee_email ?? "—"}</td>
                      <td className="py-2 pr-2">
                        <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-medium ${meta.tone}`}>{meta.label}</span>
                      </td>
                      <td className="py-2 pr-2 text-right font-semibold">{COP(c.reward_amount)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
