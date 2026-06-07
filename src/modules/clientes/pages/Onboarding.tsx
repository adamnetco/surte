/**
 * Onboarding del Dueño de tienda — conversacional, una pregunta por pantalla.
 * Comparte el WizardShell con el wizard del Superadmin para consistencia visual.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/context/OrganizationContext";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Check, PartyPopper } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { WizardShell } from "@/modules/onboarding/components/WizardShell";
import { BUSINESS_TEMPLATES, ALL_MODULES, getTemplate, type BusinessKey } from "@/modules/onboarding/lib/businessTemplates";
import { cn } from "@/lib/utils";

const TOTAL = 5;

export default function Onboarding() {
  const { user } = useAuth();
  const { currentOrg, loading: orgLoading } = useOrganization();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const planKey = params.get("plan") ?? "pro";

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [locationName, setLocationName] = useState("Sede principal");
  const [city, setCity] = useState("Bucaramanga");
  const [businessKey, setBusinessKey] = useState<BusinessKey>("retail");
  const [modules, setModules] = useState<string[]>(["pos", "inventario"]);
  const [enableEinvoice, setEnableEinvoice] = useState(true);

  const template = useMemo(() => getTemplate(businessKey), [businessKey]);

  useEffect(() => {
    document.title = "Configuremos tu POS · SistecPOS";
    if (!orgLoading && !user) navigate("/login?next=/onboarding");
  }, [user, orgLoading, navigate]);

  useEffect(() => {
    if (!currentOrg) return;
    setCompanyName(currentOrg.name ?? "");
  }, [currentOrg]);

  const toggleModule = (k: string) =>
    setModules((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));

  const back = () => setStep((s) => Math.max(1, s - 1));

  const canAdvance = (): boolean => {
    switch (step) {
      case 1: return companyName.trim().length > 1;
      case 2: return locationName.trim().length > 1 && city.trim().length > 1;
      case 3: return !!businessKey;
      case 4: return modules.length > 0;
      case 5: return true;
      default: return false;
    }
  };

  const next = async () => {
    if (!canAdvance() || !currentOrg) return;
    setSaving(true);
    try {
      if (step === 1) {
        await supabase.from("organizations").update({ name: companyName }).eq("id", currentOrg.id);
      } else if (step === 2) {
        const { data: existing } = await supabase.from("locations").select("id").eq("organization_id", currentOrg.id).limit(1).maybeSingle();
        if (!existing) {
          await supabase.from("locations").insert({ organization_id: currentOrg.id, name: locationName, city, is_active: true });
        }
      } else if (step === 3) {
        setModules(template.modules);
      } else if (step === 4) {
        const finalMods = enableEinvoice && !modules.includes("einvoice_innapsis") ? [...modules, "einvoice_innapsis"] : modules;
        for (const m of finalMods) {
          await supabase.from("organization_modules").upsert(
            { organization_id: currentOrg.id, module_key: m, enabled: true },
            { onConflict: "organization_id,module_key" },
          );
        }
      } else if (step === 5) {
        toast.success("¡Todo listo!");
        navigate("/pos");
        return;
      }
      setStep((s) => s + 1);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  if (orgLoading) {
    return (
      <div className="min-h-[100dvh] grid place-items-center">
        <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }
  if (!currentOrg) {
    return (
      <div className="min-h-[100dvh] grid place-items-center p-6 text-center">
        <p className="text-muted-foreground">Crea o únete a una organización para continuar.</p>
      </div>
    );
  }

  if (step === 1) {
    return (
      <WizardShell
        step={1} totalSteps={TOTAL}
        eyebrow={`Plan ${planKey}`}
        title={`Hola${user?.email ? `, ${user.email.split("@")[0]}` : ""} 👋`}
        subtitle="Vamos a poner tu POS a vender en menos de 2 minutos. Empecemos por el nombre de tu negocio."
        onNext={next} nextDisabled={!canAdvance()} loading={saving}
      >
        <div className="space-y-2">
          <Label htmlFor="company">Nombre del negocio</Label>
          <Input id="company" autoFocus value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="h-12 text-base" />
        </div>
      </WizardShell>
    );
  }

  if (step === 2) {
    return (
      <WizardShell
        step={2} totalSteps={TOTAL}
        eyebrow={companyName}
        title="¿Dónde está tu primera sucursal?"
        subtitle="Puedes agregar más sucursales luego desde Configuración."
        onBack={back} onNext={next} nextDisabled={!canAdvance()} loading={saving}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="loc">Nombre de la sucursal</Label>
            <Input id="loc" autoFocus value={locationName} onChange={(e) => setLocationName(e.target.value)} className="h-12 text-base" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">Ciudad</Label>
            <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} className="h-12 text-base" />
          </div>
        </div>
      </WizardShell>
    );
  }

  if (step === 3) {
    return (
      <WizardShell
        step={3} totalSteps={TOTAL}
        eyebrow="Cuéntanos cómo opera"
        title="¿Qué tipo de negocio tienes?"
        subtitle="Preconfiguramos los módulos típicos. Podrás ajustarlos en el siguiente paso."
        onBack={back} onNext={next} nextDisabled={!canAdvance()} loading={saving}
      >
        <div className="grid grid-cols-2 gap-3">
          {BUSINESS_TEMPLATES.map((t) => {
            const Icon = t.icon;
            const active = businessKey === t.key;
            return (
              <button
                key={t.key} type="button"
                onClick={() => { setBusinessKey(t.key); setModules(t.modules); }}
                className={cn(
                  "text-left rounded-xl border-2 p-4 transition-all hover:border-primary/50",
                  active ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-background",
                )}
              >
                <div className="flex items-start justify-between mb-2">
                  <Icon className={cn("h-6 w-6", active ? "text-primary" : "text-muted-foreground")} />
                  {active && <Check className="h-4 w-4 text-primary" />}
                </div>
                <div className="font-semibold text-sm">{t.label}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{t.tagline}</div>
              </button>
            );
          })}
        </div>
      </WizardShell>
    );
  }

  if (step === 4) {
    return (
      <WizardShell
        step={4} totalSteps={TOTAL}
        eyebrow={template.label}
        title="Ajusta lo que vas a usar"
        subtitle="Activa o desactiva módulos. Siempre podrás cambiarlo después."
        onBack={back} onNext={next} nextDisabled={!canAdvance()} loading={saving}
      >
        <div className="space-y-4">
          <div className="grid gap-2 sm:grid-cols-2">
            {ALL_MODULES.map((m) => {
              const active = modules.includes(m.key);
              return (
                <button
                  key={m.key} type="button" onClick={() => toggleModule(m.key)}
                  className={cn(
                    "flex items-center gap-3 rounded-lg border-2 px-3 py-2.5 text-left transition-colors",
                    active ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/40",
                  )}
                >
                  <div className={cn("h-5 w-5 rounded-md border-2 grid place-items-center shrink-0",
                    active ? "border-primary bg-primary" : "border-muted-foreground/40")}>
                    {active && <Check className="h-3 w-3 text-primary-foreground" />}
                  </div>
                  <span className="text-sm font-medium">{m.label}</span>
                </button>
              );
            })}
          </div>
          <label className="flex items-start gap-3 rounded-lg border-2 border-border bg-background p-3 cursor-pointer hover:border-primary/40">
            <input type="checkbox" checked={enableEinvoice} onChange={(e) => setEnableEinvoice(e.target.checked)} className="mt-0.5 h-4 w-4" />
            <div>
              <div className="text-sm font-semibold">Facturación electrónica DIAN</div>
              <div className="text-xs text-muted-foreground">Vía Innapsis (PTA autorizado). Configurable luego.</div>
            </div>
          </label>
        </div>
      </WizardShell>
    );
  }

  // step 5 — celebración
  return (
    <WizardShell
      step={5} totalSteps={TOTAL}
      eyebrow="Todo listo"
      title="¡Tu POS está listo para vender!"
      subtitle="Te llevamos al mostrador. Desde ahí controlas todo."
      onNext={next} nextLabel="Ir al POS" loading={saving}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 18 }}
        className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border p-6 text-center"
      >
        <div className="mx-auto h-16 w-16 rounded-full bg-success/15 grid place-items-center mb-3">
          <PartyPopper className="h-8 w-8 text-success" />
        </div>
        <p className="font-semibold">{companyName} configurado</p>
        <p className="text-sm text-muted-foreground mt-1">
          {modules.length} módulos activos · Sucursal en {city}
        </p>
        <div className="mt-4 flex flex-wrap gap-1.5 justify-center">
          {modules.slice(0, 6).map((m) => (
            <span key={m} className="text-[11px] px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
              {ALL_MODULES.find((x) => x.key === m)?.label ?? m}
            </span>
          ))}
        </div>
      </motion.div>
      <Button variant="ghost" className="w-full mt-3" onClick={() => navigate("/facturacion")}>
        Configurar DIAN ahora
      </Button>
    </WizardShell>
  );
}
