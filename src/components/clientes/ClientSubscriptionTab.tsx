import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, Star, Zap, Crown } from "lucide-react";
import { planLabel } from "@/data/licensePlans";
import { useWhatsAppConfig } from "@/hooks/useWhatsAppConfig";

interface LicenseInfo {
  plan_type: string;
  status: string;
  business_name: string;
  expires_at: string | null;
  start_date: string;
}

const SUPPORT_PLANS = [
  { name: "Autogestión", price: 0, priceLabel: "Gratis", description: "Ideal para quienes prefieren resolver problemas por su cuenta.", icon: Zap, highlighted: false, features: ["Videos de capacitación ilimitados", "Base de conocimiento completa", "Sistema de tickets (respuesta en 48-72h)", "Actualizaciones del software incluidas"] },
  { name: "Tranquilidad", price: 120000, priceLabel: "$120.000", period: "/mes", description: "Para negocios que necesitan soporte ágil y preventivo.", icon: Star, highlighted: true, badge: "Más popular", features: ["Todo lo de Autogestión", "Soporte remoto por TeamViewer/AnyDesk", "WhatsApp directo con técnico", "Mantenimiento preventivo mensual", "Respuesta en tickets < 12h"] },
  { name: "Socio Estratégico", price: 250000, priceLabel: "$250.000", period: "/mes", description: "Para negocios que necesitan un aliado tecnológico dedicado.", icon: Crown, highlighted: false, features: ["Todo lo de Tranquilidad", "Soporte VIP 24/7", "Visita presencial mensual", "Analítica de negocio personalizada", "Consultor dedicado", "Prioridad máxima en tickets"] },
];

export default function ClientSubscriptionTab() {
  const { user } = useAuth();
  const { buildUrl } = useWhatsAppConfig();
  const [license, setLicense] = useState<LicenseInfo | null>(null);
  const [activeSub, setActiveSub] = useState<{ plan: string; price_cop: number; current_period_end: string | null } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const sb = supabase as any;
    Promise.all([
      sb.from("licenses").select("plan_type, status, business_name, expires_at, start_date")
        .eq("contact_email", user.email ?? "").eq("status", "active")
        .order("created_at", { ascending: false }).limit(1),
      sb.from("support_subscriptions").select("plan, price_cop, current_period_end, target_audience")
        .eq("user_id", user.id).eq("status", "active").limit(1),
    ]).then(([licRes, subRes]: any[]) => {
      setLicense(licRes.data?.[0] ?? null);
      setActiveSub(subRes.data?.[0] ?? null);
      setLoading(false);
    });
  }, [user]);

  const activePlanKey = activeSub?.plan ?? "autogestion";

  function handleUpgrade(planName: string) {
    const msg = `Hola, me interesa el plan de soporte "${planName}" para mi negocio. Mi correo es ${user?.email}`;
    window.open(buildUrl(msg), "_blank");
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-lg font-semibold mb-3">Tu Licencia Actual</h3>
        {loading ? (
          <Card><CardContent className="py-6"><Skeleton className="h-16 w-full" /></CardContent></Card>
        ) : license ? (
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="py-6">
              <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Plan de Software</p>
                  <p className="text-xl font-bold">{planLabel(license.plan_type)}</p>
                  <p className="text-sm text-muted-foreground">{license.business_name}</p>
                </div>
                <div className="text-left sm:text-right">
                  <Badge variant={license.status === "active" ? "default" : "destructive"}>
                    {license.status === "active" ? "Activa" : license.status}
                  </Badge>
                  {license.expires_at && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Vence: {new Date(license.expires_at).toLocaleDateString("es-CO")}
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card><CardContent className="py-6 text-center text-muted-foreground">No tienes una licencia activa vinculada a tu correo.</CardContent></Card>
        )}
      </div>

      <div>
        <h3 className="text-lg font-semibold mb-1">Planes de Soporte Técnico</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Elige el nivel de acompañamiento que necesita tu negocio.
          {activeSub?.current_period_end && (
            <span className="block mt-1">Próximo cobro: {new Date(activeSub.current_period_end).toLocaleDateString("es-CO")}</span>
          )}
        </p>
        <div className="grid gap-4 md:grid-cols-3">
          {SUPPORT_PLANS.map((plan) => {
            const Icon = plan.icon;
            const isCurrent =
              (plan.price === 0 && activePlanKey === "autogestion") ||
              (plan.name === "Tranquilidad" && activePlanKey === "tranquilidad") ||
              (plan.name === "Socio Estratégico" && activePlanKey === "socio_estrategico");
            return (
              <Card key={plan.name} className={`relative flex flex-col transition-shadow hover:shadow-lg ${plan.highlighted ? "border-primary shadow-md ring-2 ring-primary/20" : ""}`}>
                {plan.badge && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="px-3 py-1 text-xs shadow-sm">{plan.badge}</Badge>
                  </div>
                )}
                <CardHeader className="text-center pt-6">
                  <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle className="text-lg">{plan.name}</CardTitle>
                  <CardDescription className="text-xs">{plan.description}</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 space-y-4">
                  <div className="text-center">
                    <span className="text-3xl font-bold">{plan.priceLabel}</span>
                    {plan.period && <span className="text-sm text-muted-foreground">{plan.period}</span>}
                  </div>
                  <ul className="space-y-2 text-sm">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <CardFooter className="pt-0">
                  {isCurrent ? (
                    <Button variant="outline" className="w-full" disabled>Plan Actual</Button>
                  ) : (
                    <Button className="w-full" onClick={() => handleUpgrade(plan.name)}>
                      {plan.price === 0 ? "Cambiar a este plan" : "Actualizar Plan"}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
