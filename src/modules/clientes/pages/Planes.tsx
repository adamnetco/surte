import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkles, ArrowUpRight } from "lucide-react";

interface Plan {
  id: string; key: string; name: string; description: string;
  price_monthly: number; price_yearly: number; modules: string[];
  limits: Record<string, number>; trial_days: number;
}

const MODULE_LABELS: Record<string, string> = {
  pos_counter: "POS mostrador", pos_tables: "POS mesas/Restaurante",
  kds: "Cocina (KDS)", inventory_multi_warehouse: "Inventario multi-bodega",
  einvoice_innapsis: "Facturación electrónica DIAN", reports_advanced: "Reportes avanzados",
  "*": "Todos los módulos",
};

const COP = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

export default function Planes() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [cycle, setCycle] = useState<"monthly" | "yearly">("monthly");
  const [params] = useSearchParams();

  // Contexto de upgrade venido del modal "Mejora tu plan"
  const highlight = params.get("highlight"); // plan_key sugerido
  const reason = params.get("reason");       // module_key bloqueado
  const returnTo = params.get("return_to");  // ruta a la que volver tras contratar

  useEffect(() => {
    document.title = "Planes y precios · SistecPOS";
    (async () => {
      const { data } = await supabase.from("saas_plans").select("*").eq("is_public", true).order("sort_order");
      setPlans((data as any) ?? []);
    })();
  }, []);

  const reasonLabel = useMemo(() => (reason ? MODULE_LABELS[reason] ?? reason : null), [reason]);

  return (
    <div className="min-h-[100dvh] bg-gradient-to-b from-background to-muted/30">
      <header className="max-w-7xl mx-auto px-4 py-12 text-center">
        <Badge variant="secondary" className="mb-3"><Sparkles className="w-3 h-3 mr-1" /> 14 días de prueba</Badge>
        <h1 className="text-3xl md:text-5xl font-bold tracking-tight">Un POS pensado para Colombia</h1>
        <p className="text-muted-foreground mt-3 max-w-2xl mx-auto">
          Vende, factura a la DIAN y controla tu inventario desde el celular o el computador. Sin instalación, sin amarres.
        </p>
        {highlight && reasonLabel && (
          <div className="mt-6 mx-auto max-w-xl rounded-lg border-2 border-primary/40 bg-primary/5 p-3 flex items-center gap-2 text-sm text-left">
            <ArrowUpRight className="h-4 w-4 text-primary shrink-0" />
            <span>
              Necesitas el plan <strong className="text-primary uppercase">{highlight}</strong> para activar{" "}
              <strong>{reasonLabel}</strong>.
            </span>
          </div>
        )}
        <div className="inline-flex bg-card border rounded-full p-1 mt-6">
          <button onClick={() => setCycle("monthly")} className={`px-4 py-1.5 rounded-full text-sm ${cycle === "monthly" ? "bg-primary text-primary-foreground" : ""}`}>Mensual</button>
          <button onClick={() => setCycle("yearly")} className={`px-4 py-1.5 rounded-full text-sm ${cycle === "yearly" ? "bg-primary text-primary-foreground" : ""}`}>Anual (-17%)</button>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-4 pb-16 grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        {plans.map((p) => {
          const price = cycle === "monthly" ? p.price_monthly : Math.round(p.price_yearly / 12);
          const isPro = p.key === "pro";
          const isHighlighted = highlight === p.key;
          return (
            <Card key={p.id} className={`p-6 flex flex-col ${isHighlighted ? "border-primary border-2 shadow-xl ring-2 ring-primary/30" : isPro ? "border-primary border-2 shadow-lg" : ""}`}>
              {isHighlighted ? <Badge className="self-start mb-2 bg-primary">Tu plan recomendado</Badge> : isPro && <Badge className="self-start mb-2">Recomendado</Badge>}
              <h3 className="text-xl font-bold">{p.name}</h3>
              <p className="text-sm text-muted-foreground mt-1 min-h-[40px]">{p.description}</p>
              <div className="mt-4">
                {p.price_monthly === 0 && p.key !== "enterprise" ? (
                  <div className="text-3xl font-bold">Gratis</div>
                ) : p.key === "enterprise" ? (
                  <div className="text-2xl font-bold">A la medida</div>
                ) : (
                  <>
                    <div className="text-3xl font-bold">{COP(price)}<span className="text-sm font-normal text-muted-foreground">/mes</span></div>
                    {cycle === "yearly" && <div className="text-xs text-muted-foreground">facturado anualmente</div>}
                  </>
                )}
              </div>
              <ul className="mt-4 space-y-2 text-sm flex-1">
                {p.modules.map((m) => (
                  <li key={m} className="flex gap-2"><Check className="w-4 h-4 text-success shrink-0 mt-0.5" /> {MODULE_LABELS[m] ?? m}</li>
                ))}
                {p.limits.locations && (
                  <li className="flex gap-2 text-muted-foreground">
                    <Check className="w-4 h-4 text-success shrink-0 mt-0.5" />
                    {p.limits.locations === -1 ? "Sucursales ilimitadas" : `${p.limits.locations} sucursal${p.limits.locations > 1 ? "es" : ""}`}
                  </li>
                )}
                {p.limits.einvoices_month !== undefined && p.limits.einvoices_month !== 0 && (
                  <li className="flex gap-2 text-muted-foreground">
                    <Check className="w-4 h-4 text-success shrink-0 mt-0.5" />
                    {p.limits.einvoices_month === -1 ? "Facturas DIAN ilimitadas" : `${p.limits.einvoices_month} facturas DIAN / mes`}
                  </li>
                )}
              </ul>
              <Button asChild className="mt-5 w-full" variant={isHighlighted || isPro ? "default" : "outline"}>
                <Link to={p.key === "enterprise" ? "/ayuda" : `/onboarding?plan=${p.key}${returnTo ? `&return_to=${encodeURIComponent(returnTo)}` : ""}`}>
                  {p.price_monthly === 0 ? "Empezar gratis" : `Probar ${p.trial_days} días`}
                </Link>
              </Button>
            </Card>
          );
        })}
      </section>
    </div>
  );
}
