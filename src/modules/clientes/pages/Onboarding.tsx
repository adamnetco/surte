/**
 * Onboarding del Dueño de tienda — conversacional, una pregunta por pantalla.
 * Comparte el WizardShell con el wizard del Superadmin para consistencia visual.
 *
 * Flujo (6 pasos):
 *   1. Nombre del negocio
 *   2. Primera sucursal (nombre + ciudad)
 *   3. Tipo de negocio (preselecciona módulos)
 *   4. Ajuste de módulos
 *   5. Selección de plan (después de configurar la tienda, como acordó UX)
 *   6. Celebración → /pos
 *
 * Auto-resiliencia: si el usuario llega sin organización (signup nuevo, sin
 * tenant vinculado por trigger), creamos una org personal con un slug derivado
 * del email para que el wizard no muestre pantalla en blanco (fix audit H12).
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, PartyPopper, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { WizardShell } from "@/modules/onboarding/components/WizardShell";
import { BUSINESS_TEMPLATES, ALL_MODULES, getTemplate, type BusinessKey } from "@/modules/onboarding/lib/businessTemplates";
import { EntitlementsWizardStep } from "@/modules/platform/components/EntitlementsWizardStep";
import { cn } from "@/lib/utils";

const TOTAL = 7;
const COP = (n: number) => "$" + Math.round(n).toLocaleString("es-CO");

interface PlanRow {
  id: string;
  key: string;
  name: string;
  description: string | null;
  price_monthly: number;
  trial_days: number | null;
  modules: string[] | null;
  sort_order: number | null;
}

function slugFromEmail(email: string): string {
  const base = (email.split("@")[0] || "tienda").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base || "tienda"}-${suffix}`;
}

export default function Onboarding() {
  const { user } = useAuth();
  const { currentOrg, orgs, switchOrg, refresh, loading: orgLoading } = useOrganization();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const planParam = params.get("plan");
  const orgParam = params.get("org");

  // Permite que superadmin opere sobre cualquier org pasada por ?org=
  useEffect(() => {
    if (orgParam && currentOrg?.id !== orgParam && orgs.some((o) => o.id === orgParam)) {
      switchOrg(orgParam);
    }
  }, [orgParam, currentOrg?.id, orgs, switchOrg]);

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [provisioning, setProvisioning] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [locationName, setLocationName] = useState("Sede principal");
  const [city, setCity] = useState("");
  const [businessKey, setBusinessKey] = useState<BusinessKey>("retail");
  const [modules, setModules] = useState<string[]>(["pos", "inventario"]);
  const [enableEinvoice, setEnableEinvoice] = useState(true);

  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<string>(planParam ?? "pro");

  // Step 5: primer producto (opcional)
  const [productName, setProductName] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productSku, setProductSku] = useState("");


  const template = useMemo(() => getTemplate(businessKey), [businessKey]);

  // Fix H6/H12: si no hay sesión → login; si hay sesión pero sin org → crearla.
  useEffect(() => {
    document.title = "Configura tu POS · SistecPOS";
    if (!orgLoading && !user) navigate("/login?next=/onboarding");
  }, [user, orgLoading, navigate]);

  // SuperAdmin = personal de la plataforma. NUNCA debe auto-crear un tenant aquí;
  // gestiona tiendas existentes desde /superadmin. Si llega sin org, lo redirigimos.
  const isPlatformSuperadmin = (user?.user_metadata as any)?.role === "superadmin";

  useEffect(() => {
    if (orgLoading || !user || currentOrg || provisioning) return;
    if (orgs.length > 0) return;
    if (isPlatformSuperadmin) {
      toast.info("Como SuperAdmin no creas tiendas aquí. Vamos al panel de plataforma.");
      navigate("/superadmin", { replace: true });
      return;
    }
    // Crear org personal de arranque — el dueño podrá renombrarla en el paso 1.
    (async () => {
      setProvisioning(true);
      try {
        const slug = slugFromEmail(user.email ?? "tienda");
        const tentativeName = (user.user_metadata?.full_name as string | undefined)?.trim() || "Mi negocio";
        const { data, error } = await supabase
          .from("organizations")
          .insert({
            name: tentativeName,
            slug,
            business_type: "retail",
            is_active: true,
          })
          .select("id")
          .single();
        if (error) throw error;
        if (data?.id) {
          await supabase.from("organization_members").insert({
            organization_id: data.id,
            user_id: user.id,
            role: "owner",
            is_active: true,
          });
        }
        await refresh();
      } catch (e: any) {
        console.error("[Onboarding] auto-create org failed", e);
        toast.error("No pudimos crear tu organización. Contacta a soporte.");
      } finally {
        setProvisioning(false);
      }
    })();
  }, [orgLoading, user, currentOrg, orgs.length, provisioning, refresh, isPlatformSuperadmin, navigate]);

  useEffect(() => {
    if (!currentOrg) return;
    setCompanyName((prev) => prev || currentOrg.name || "");
  }, [currentOrg]);

  // Cargar planes públicos cuando llegamos al paso de planes (6)
  useEffect(() => {
    if (step !== 6 || plans.length > 0) return;
    setPlansLoading(true);
    supabase
      .from("saas_plans")
      .select("id, key, name, description, price_monthly, trial_days, modules, sort_order")
      .eq("is_public", true)
      .order("sort_order")
      .then(({ data, error }) => {
        if (error) {
          console.error("[Onboarding] saas_plans fetch failed", error);
          toast.error("No pudimos cargar los planes.");
        } else {
          setPlans((data as PlanRow[]) ?? []);
        }
        setPlansLoading(false);
      });
  }, [step, plans.length]);


  const toggleModule = (k: string) =>
    setModules((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));

  const back = () => setStep((s) => Math.max(1, s - 1));

  const canAdvance = (): boolean => {
    switch (step) {
      case 1: return companyName.trim().length > 1;
      case 2: return locationName.trim().length > 1 && city.trim().length > 1;
      case 3: return !!businessKey;
      case 4: return modules.length > 0;
      case 5: return !!selectedPlan;
      case 6: return true;
      default: return false;
    }
  };

  const next = async () => {
    if (!canAdvance() || !currentOrg) return;
    setSaving(true);
    try {
      const progressPatch: Record<string, boolean | string> = {};
      if (step === 1) {
        await supabase.from("organizations").update({ name: companyName }).eq("id", currentOrg.id);
        progressPatch.company_done = true;
      } else if (step === 2) {
        const { data: existing } = await supabase.from("locations").select("id").eq("organization_id", currentOrg.id).limit(1).maybeSingle();
        if (!existing) {
          await supabase.from("locations").insert({ organization_id: currentOrg.id, name: locationName, city, is_active: true });
        }
        progressPatch.location_done = true;
      } else if (step === 3) {
        setModules(template.modules);
        await supabase.from("organizations").update({ business_type: businessKey }).eq("id", currentOrg.id);
      } else if (step === 4) {
        // Módulos: el toggling escribe a tenant_module_overrides desde EntitlementsWizardStep.
        // Aquí solo registramos el progreso. NUNCA escribir a organization_modules (DEPRECADA).
        progressPatch.modules_done = true;
        if (enableEinvoice) {
          await supabase.from("tenant_module_overrides" as any).upsert(
            {
              organization_id: currentOrg.id,
              module_key: "einvoice_innapsis",
              enabled: true,
              reason: "cliente_onboarding_einvoice",
            },
            { onConflict: "organization_id,module_key" },
          );
          progressPatch.einvoice_done = true;
        }
      } else if (step === 5) {
        // El plan elegido queda en estado local; la suscripción se crea al
        // entrar a Facturación/Checkout. No persistimos aquí porque
        // organizations no tiene columna plan (la fuente de verdad es subscriptions).
      } else if (step === 6) {
        await supabase.from("onboarding_progress").upsert(
          { organization_id: currentOrg.id, catalog_done: true, completed_at: new Date().toISOString() },
          { onConflict: "organization_id" },
        );
        toast.success("¡Todo listo!");
        navigate("/pos");
        return;
      }
      if (Object.keys(progressPatch).length > 0) {
        await supabase.from("onboarding_progress").upsert(
          { organization_id: currentOrg.id, ...progressPatch },
          { onConflict: "organization_id" },
        );
      }
      setStep((s) => s + 1);
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo guardar");
    } finally {
      setSaving(false);
    }
  };

  if (orgLoading || provisioning) {
    return (
      <div className="min-h-[100dvh] grid place-items-center">
        <div className="text-center space-y-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">
            {provisioning ? "Preparando tu cuenta…" : "Cargando…"}
          </p>
        </div>
      </div>
    );
  }
  if (!currentOrg) {
    return (
      <div className="min-h-[100dvh] grid place-items-center p-6 text-center">
        <div className="space-y-3 max-w-sm">
          <p className="text-muted-foreground">No encontramos una organización vinculada a tu cuenta.</p>
          <Button onClick={() => window.location.reload()}>Reintentar</Button>
        </div>
      </div>
    );
  }

  if (step === 1) {
    return (
      <WizardShell
        step={1} totalSteps={TOTAL}
        eyebrow="Empecemos"
        title={`Hola${user?.email ? `, ${user.email.split("@")[0]}` : ""} 👋`}
        subtitle="Vamos a poner tu POS a vender en menos de 2 minutos. ¿Cómo se llama tu negocio?"
        onNext={next} nextDisabled={!canAdvance()} loading={saving}
      >
        <div className="space-y-2">
          <Label htmlFor="company">Nombre del negocio</Label>
          <Input id="company" autoFocus value={companyName} onChange={(e) => setCompanyName(e.target.value)} className="h-12 text-base" placeholder="Ej: Tienda Don Carlos" />
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
            <Input id="city" value={city} onChange={(e) => setCity(e.target.value)} className="h-12 text-base" placeholder="Ej: Bogotá" />
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
          <EntitlementsWizardStep
            organizationId={currentOrg.id}
            mode="override-only"
            onChange={setModules}
          />
          <p className="text-[11px] text-muted-foreground px-1">
            Los módulos disponibles dependen de tu plan. Los bloqueados te llevarán a comparar planes.
          </p>
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

  if (step === 5) {
    return (
      <WizardShell
        step={5} totalSteps={TOTAL}
        eyebrow="Casi listo"
        title="Elige tu plan"
        subtitle="Empieza gratis 14 días. Sin tarjeta. Cancela cuando quieras."
        onBack={back} onNext={next} nextDisabled={!canAdvance()} loading={saving}
        nextLabel="Continuar"
      >
        {plansLoading ? (
          <div className="grid sm:grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-40 rounded-xl bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : plans.length === 0 ? (
          <div className="rounded-lg border border-warning/40 bg-warning/5 p-4 text-sm">
            No hay planes publicados todavía. Continúa y elige uno más tarde desde Facturación.
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            {plans.map((p) => {
              const active = selectedPlan === p.key;
              const isFree = p.price_monthly === 0;
              const isEnterprise = p.key === "enterprise";
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPlan(p.key)}
                  className={cn(
                    "text-left rounded-xl border-2 p-4 transition-all hover:border-primary/50 relative",
                    active ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-background",
                  )}
                >
                  {p.key === "pro" && (
                    <Badge className="absolute -top-2 right-3 text-[10px] gap-1">
                      <Sparkles className="h-3 w-3" /> Recomendado
                    </Badge>
                  )}
                  <div className="flex items-start justify-between mb-2">
                    <div className="font-semibold text-sm">{p.name}</div>
                    {active && <Check className="h-4 w-4 text-primary" />}
                  </div>
                  <div className="text-xl font-bold">
                    {isEnterprise ? "A la medida" : isFree ? "Gratis" : (
                      <>
                        {COP(p.price_monthly)}
                        <span className="text-xs font-normal text-muted-foreground">/mes</span>
                      </>
                    )}
                  </div>
                  {!isFree && !isEnterprise && (
                    <div className="text-[11px] text-success font-medium mt-0.5">
                      Gratis {p.trial_days ?? 14} días
                    </div>
                  )}
                  {p.description && (
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{p.description}</p>
                  )}
                </button>
              );
            })}
          </div>
        )}
        <p className="text-[11px] text-muted-foreground px-1 mt-3">
          Puedes cambiar de plan en cualquier momento desde Configuración.
        </p>
      </WizardShell>
    );
  }

  // step 6 — celebración
  const chosenPlan = plans.find((p) => p.key === selectedPlan);
  return (
    <WizardShell
      step={6} totalSteps={TOTAL}
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
          Plan {chosenPlan?.name ?? selectedPlan} · {modules.length} módulos · Sucursal en {city}
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
