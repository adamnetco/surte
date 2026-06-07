import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CreditCard, Calendar, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";

const COP = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

export default function Billing() {
  const { currentOrg } = useOrganization();
  const [sub, setSub] = useState<any>(null);
  const [plan, setPlan] = useState<any>(null);
  const [invoices, setInvoices] = useState<any[]>([]);
  const [plans, setPlans] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!currentOrg) return;
    const { data: s } = await supabase.from("subscriptions").select("*, saas_plans(*)").eq("organization_id", currentOrg.id).maybeSingle();
    setSub(s); setPlan((s as any)?.saas_plans ?? null);
    const { data: inv } = await supabase.from("subscription_invoices").select("*").eq("organization_id", currentOrg.id).order("created_at", { ascending: false }).limit(12);
    setInvoices(inv ?? []);
    const { data: p } = await supabase.from("saas_plans").select("*").eq("is_public", true).order("sort_order");
    setPlans(p ?? []);
  };

  useEffect(() => { load(); document.title = "Facturación SaaS · SURTÉ YA POS"; /* eslint-disable-next-line */ }, [currentOrg]);

  const changePlan = async (planId: string) => {
    if (!sub) return;
    setLoading(true);
    const { error } = await supabase.from("subscriptions").update({
      plan_id: planId,
      status: "active",
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
    }).eq("id", sub.id);
    setLoading(false);
    if (error) toast.error(error.message); else { toast.success("Plan actualizado"); load(); }
  };

  if (!currentOrg) return <div className="p-6">Selecciona una organización</div>;

  const statusBadge: Record<string, "default" | "destructive" | "secondary" | "outline"> = {
    trial: "secondary", active: "default", past_due: "destructive", canceled: "outline", suspended: "destructive",
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-4">
      <div className="flex items-center gap-3">
        <CreditCard className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Facturación y plan</h1>
      </div>

      <Card className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-muted-foreground uppercase">Plan actual</p>
            <h2 className="text-xl font-bold flex items-center gap-2">
              {plan?.name ?? "—"}
              {sub && <Badge variant={statusBadge[sub.status] ?? "secondary"}>{sub.status}</Badge>}
            </h2>
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
              <Calendar className="w-3 h-3" /> Próxima renovación: {sub?.current_period_end ? new Date(sub.current_period_end).toLocaleDateString("es-CO") : "—"}
            </p>
          </div>
          <Button asChild variant="outline"><Link to="/planes">Ver todos los planes <ArrowUpRight className="w-4 h-4 ml-1" /></Link></Button>
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold mb-3">Cambiar plan</h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-3">
          {plans.map((p) => (
            <div key={p.id} className={`border rounded-lg p-3 ${p.id === sub?.plan_id ? "border-primary bg-primary/5" : ""}`}>
              <h4 className="font-semibold">{p.name}</h4>
              <p className="text-sm font-bold">{p.price_monthly === 0 ? "Gratis" : COP(p.price_monthly) + "/mes"}</p>
              <Button size="sm" className="w-full mt-2" disabled={loading || p.id === sub?.plan_id} onClick={() => changePlan(p.id)}>
                {p.id === sub?.plan_id ? "Plan actual" : "Cambiar"}
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <Card className="p-5">
        <h3 className="font-semibold mb-3">Facturas de suscripción</h3>
        {invoices.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aún no hay facturas. Durante el período de prueba no se generan cobros.</p>
        ) : (
          <div className="space-y-2">
            {invoices.map((i) => (
              <div key={i.id} className="flex items-center justify-between border rounded p-3 text-sm">
                <div>
                  <div className="font-medium">{COP(i.amount)} {i.currency}</div>
                  <div className="text-xs text-muted-foreground">Vence {new Date(i.due_date).toLocaleDateString("es-CO")}</div>
                </div>
                <Badge variant={i.status === "paid" ? "default" : i.status === "failed" ? "destructive" : "secondary"}>{i.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
