import { useEffect, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/context/OrganizationContext";
import { useAuth } from "@/context/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, ChevronRight, Loader2, Rocket } from "lucide-react";
import { toast } from "sonner";

const STEPS = [
  { key: "company", title: "Datos de la empresa" },
  { key: "location", title: "Tu primera sucursal" },
  { key: "modules", title: "Activar módulos" },
  { key: "einvoice", title: "Facturación DIAN (opcional)" },
];

export default function Onboarding() {
  const { user } = useAuth();
  const { currentOrg, loading: orgLoading } = useOrganization();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const planKey = params.get("plan") ?? "pro";

  const [step, setStep] = useState(0);
  const [progress, setProgress] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // form state
  const [companyName, setCompanyName] = useState("");
  const [nit, setNit] = useState("");
  const [locationName, setLocationName] = useState("Sede principal");
  const [city, setCity] = useState("Bucaramanga");
  const [enableTables, setEnableTables] = useState(false);
  const [enableEinvoice, setEnableEinvoice] = useState(true);

  useEffect(() => {
    document.title = "Onboarding · SURTÉ YA POS";
    if (!orgLoading && !user) navigate("/login?next=/onboarding");
  }, [user, orgLoading, navigate]);

  useEffect(() => {
    if (!currentOrg) return;
    setCompanyName(currentOrg.name ?? "");
    (async () => {
      const { data } = await supabase.from("onboarding_progress").select("*").eq("organization_id", currentOrg.id).maybeSingle();
      setProgress(data);
      if (data) {
        if (!data.location_done) setStep(1);
        else if (!data.modules_done) setStep(2);
        else if (!data.einvoice_done) setStep(3);
        else setStep(4);
      }
    })();
  }, [currentOrg]);

  const markStep = async (patch: Record<string, any>) => {
    if (!currentOrg) return;
    await supabase.from("onboarding_progress").update(patch).eq("organization_id", currentOrg.id);
    setProgress({ ...progress, ...patch });
  };

  const saveCompany = async () => {
    if (!currentOrg) return;
    setLoading(true);
    await supabase.from("organizations").update({ name: companyName }).eq("id", currentOrg.id);
    await markStep({ company_done: true });
    setLoading(false); setStep(1);
  };

  const saveLocation = async () => {
    if (!currentOrg) return;
    setLoading(true);
    const { data: existing } = await supabase.from("locations").select("id").eq("organization_id", currentOrg.id).limit(1).maybeSingle();
    if (!existing) {
      await supabase.from("locations").insert({
        organization_id: currentOrg.id, name: locationName, city, is_active: true,
      });
    }
    await markStep({ location_done: true });
    setLoading(false); setStep(2);
  };

  const saveModules = async () => {
    if (!currentOrg) return;
    setLoading(true);
    const mods = ["pos_counter", "inventory_multi_warehouse"];
    if (enableTables) mods.push("pos_tables", "kds");
    if (enableEinvoice) mods.push("einvoice_innapsis");
    for (const m of mods) {
      await supabase.from("organization_modules").upsert({
        organization_id: currentOrg.id, module_key: m, enabled: true,
      }, { onConflict: "organization_id,module_key" });
    }
    await markStep({ modules_done: true });
    setLoading(false); setStep(3);
  };

  const finish = async () => {
    await markStep({ einvoice_done: true, completed_at: new Date().toISOString() });
    toast.success("¡Listo! Vamos al POS");
    navigate("/pos");
  };

  if (orgLoading) return <div className="min-h-[100dvh] grid place-items-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  if (!currentOrg) return <div className="p-6 text-center"><p>Crea o únete a una organización para continuar.</p></div>;

  return (
    <div className="min-h-[100dvh] bg-muted/30 p-4 md:p-8">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center gap-2 mb-6">
          <Rocket className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold">Pongamos tu POS a vender</h1>
        </div>

        <div className="flex gap-2 mb-6">
          {STEPS.map((s, i) => (
            <div key={s.key} className="flex-1">
              <div className={`h-1.5 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`} />
              <p className={`text-xs mt-1 ${i === step ? "font-semibold" : "text-muted-foreground"}`}>{s.title}</p>
            </div>
          ))}
        </div>

        <Card className="p-5 space-y-4">
          {step === 0 && (
            <>
              <h2 className="font-semibold">Cuéntanos de tu negocio</h2>
              <div><Label>Nombre del negocio</Label><Input value={companyName} onChange={e => setCompanyName(e.target.value)} /></div>
              <div><Label>NIT (opcional)</Label><Input value={nit} onChange={e => setNit(e.target.value)} /></div>
              <Button onClick={saveCompany} disabled={loading || !companyName} className="w-full">Continuar <ChevronRight className="w-4 h-4 ml-1" /></Button>
            </>
          )}
          {step === 1 && (
            <>
              <h2 className="font-semibold">Tu primera sucursal</h2>
              <div><Label>Nombre</Label><Input value={locationName} onChange={e => setLocationName(e.target.value)} /></div>
              <div><Label>Ciudad</Label><Input value={city} onChange={e => setCity(e.target.value)} /></div>
              <Button onClick={saveLocation} disabled={loading} className="w-full">Continuar <ChevronRight className="w-4 h-4 ml-1" /></Button>
            </>
          )}
          {step === 2 && (
            <>
              <h2 className="font-semibold">¿Qué módulos usarás?</h2>
              <p className="text-xs text-muted-foreground">El POS de mostrador queda activo siempre. Activa más según tu negocio.</p>
              <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer">
                <input type="checkbox" checked={enableTables} onChange={e => setEnableTables(e.target.checked)} />
                <div><div className="font-medium">Restaurante (mesas + KDS)</div><div className="text-xs text-muted-foreground">Comanderas, cocina, transferencia de mesas</div></div>
              </label>
              <label className="flex items-center gap-2 p-3 border rounded-lg cursor-pointer">
                <input type="checkbox" checked={enableEinvoice} onChange={e => setEnableEinvoice(e.target.checked)} />
                <div><div className="font-medium">Facturación electrónica DIAN</div><div className="text-xs text-muted-foreground">Vía Innapsis (PTA autorizado)</div></div>
              </label>
              <Button onClick={saveModules} disabled={loading} className="w-full">Continuar <ChevronRight className="w-4 h-4 ml-1" /></Button>
            </>
          )}
          {step === 3 && (
            <>
              <h2 className="font-semibold">Facturación DIAN</h2>
              <p className="text-sm text-muted-foreground">
                Si activaste el módulo, configura tu NIT y resolución en la pantalla de Facturación. Puedes hacerlo luego.
              </p>
              <div className="flex gap-2">
                <Button asChild variant="outline" className="flex-1"><Link to="/facturacion">Configurar ahora</Link></Button>
                <Button onClick={finish} className="flex-1">Hacerlo después</Button>
              </div>
            </>
          )}
          {step >= 4 && (
            <div className="text-center py-6">
              <Check className="w-10 h-10 text-success mx-auto mb-2" />
              <h2 className="font-semibold">Onboarding completado</h2>
              <Button asChild className="mt-4"><Link to="/pos">Ir al POS</Link></Button>
            </div>
          )}
        </Card>

        <p className="text-xs text-muted-foreground text-center mt-4">Plan seleccionado: <strong>{planKey}</strong> · 14 días de prueba</p>
      </div>
    </div>
  );
}
