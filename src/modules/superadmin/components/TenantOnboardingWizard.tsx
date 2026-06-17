/**
 * Wizard del Superadmin — Crear tienda y asociar plan.
 *
 * Flujo limpio (4 pasos + resultado):
 *   1. Tipo de negocio (plantilla)
 *   2. Identidad (nombre + URL + NIT opcional)        ← consolida los antiguos pasos 2 y 3
 *   3. Dueño (nombre + email + WhatsApp)
 *   4. Plan (saas_plans)                              ← el plan define los módulos automáticamente
 *   5. Resumen → submit → crea tenant + emite licencia → CredentialsCard
 *
 * Cambios vs versión anterior:
 *   - Eliminado el paso "seleccionar módulos" (duplicaba el wizard del dueño y confundía).
 *     Los módulos los hereda del plan elegido (plan_modules) — única fuente de verdad.
 *   - Identidad fiscal fusionada con la identidad comercial (un solo paso).
 *   - Se emite licencia del plan elegido en el mismo flujo (antes había que ir a /licencias).
 */
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Check, Sparkles } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { WizardShell } from "@/modules/onboarding/components/WizardShell";
import { SubdomainPreview, type SlugStatus } from "@/modules/onboarding/components/SubdomainPreview";
import { NitLookup } from "@/modules/onboarding/components/NitLookup";
import { CredentialsCard } from "@/modules/onboarding/components/CredentialsCard";
import { BUSINESS_TEMPLATES, getTemplate, type BusinessKey } from "@/modules/onboarding/lib/businessTemplates";
import { EntitlementsWizardStep } from "@/modules/platform/components/EntitlementsWizardStep";
import { cn } from "@/lib/utils";

type Result = {
  ok: boolean;
  slug: string;
  name: string;
  owner_email: string;
  owner_phone?: string | null;
  generated_password: string | null;
  modules: string[];
  domain: string | null;
  plan_key: string;
  license_key?: string | null;
  organization_id?: string | null;
};

type SaasPlan = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  price_monthly: number | null;
  currency: string | null;
  trial_days: number | null;
  sort_order: number | null;
};

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

const formatCOP = (n: number | null | undefined) => {
  if (!n) return "Gratis";
  return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n);
};

const TOTAL = 5;

const TenantOnboardingWizard = ({ onCreated }: { onCreated?: () => void }) => {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  // Datos
  const [businessKey, setBusinessKey] = useState<BusinessKey | null>(null);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugStatus, setSlugStatus] = useState<SlugStatus>("idle");
  const [taxId, setTaxId] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");
  const [planKey, setPlanKey] = useState<string>("");

  // Planes desde BD
  const [plans, setPlans] = useState<SaasPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("saas_plans")
        .select("id,key,name,description,price_monthly,currency,trial_days,sort_order")
        .eq("is_public", true)
        .order("sort_order", { ascending: true });
      if (cancelled) return;
      const rows = (data as SaasPlan[] | null) ?? [];
      setPlans(rows);
      // Preselección sensata: Pro si existe, si no el primero
      if (!planKey) {
        const pro = rows.find((p) => p.key === "pro");
        setPlanKey(pro?.key ?? rows[0]?.key ?? "");
      }
      setPlansLoading(false);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const template = useMemo(() => (businessKey ? getTemplate(businessKey) : null), [businessKey]);
  const selectedPlan = useMemo(() => plans.find((p) => p.key === planKey) ?? null, [plans, planKey]);

  const reset = () => {
    setStep(1); setResult(null);
    setBusinessKey(null); setName(""); setSlug(""); setSlugStatus("idle");
    setTaxId(""); setOwnerName(""); setOwnerEmail(""); setOwnerPhone("");
  };

  const back = () => setStep((s) => Math.max(1, s - 1));

  const canAdvance = (): boolean => {
    switch (step) {
      case 1: return !!businessKey;
      case 2: return name.trim().length > 1 && slug.length >= 3 && slugStatus === "available";
      case 3: return ownerName.trim().length > 1 && /\S+@\S+\.\S+/.test(ownerEmail);
      case 4: return !!planKey;
      case 5: return true;
      default: return false;
    }
  };

  const next = async () => {
    if (!canAdvance()) return;
    if (step < TOTAL) {
      setStep((s) => s + 1);
      return;
    }
    // Submit final
    setSaving(true);
    try {
      // 1) Resolver módulos del plan (única fuente de verdad)
      const plan = plans.find((p) => p.key === planKey);
      let planModules: string[] = [];
      if (plan) {
        const { data: pm } = await supabase
          .from("plan_modules")
          .select("module_key,included")
          .eq("plan_id", plan.id);
        planModules = (pm ?? []).filter((r: any) => r.included !== false).map((r: any) => r.module_key);
      }
      // Fallback razonable si el plan aún no tiene módulos mapeados
      if (planModules.length === 0 && template) {
        planModules = template.modules;
      }

      // 2) Crear tenant + dueño + módulos + dominio
      const { data, error } = await supabase.functions.invoke("tenant-create-with-owner", {
        body: {
          slug, name, tax_id: taxId || null, business_type: businessKey,
          owner_email: ownerEmail, owner_full_name: ownerName, owner_phone: ownerPhone || null,
          modules: planModules, domain: `${slug}.sistecpos.com`,
        },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.detail || data?.error || "Error desconocido");

      // 3) Emitir licencia del plan elegido en el mismo flujo
      let license_key: string | null = null;
      try {
        const { data: lic, error: licErr } = await supabase.functions.invoke("license-issue", {
          body: {
            organization_id: (data as any).organization_id,
            plan: planKey,
            max_terminals: 3,
            expires_at: null,
            notes: `Emitida automáticamente desde wizard de alta (${planKey})`,
          },
        });
        if (licErr) console.warn("license-issue warning:", licErr.message);
        else license_key = (lic as any)?.license_key ?? null;
      } catch (e) {
        console.warn("license-issue failed:", (e as Error).message);
      }

      setResult({
        ...(data as Result),
        owner_phone: ownerPhone || null,
        modules: planModules,
        plan_key: planKey,
        license_key,
        organization_id: (data as any).organization_id ?? null,
      });
      toast.success("Tienda creada y plan activado");
      onCreated?.();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo crear la tienda");
    } finally {
      setSaving(false);
    }
  };

  if (result) {
    return (
      <WizardShell
        step={TOTAL}
        totalSteps={TOTAL}
        eyebrow={`Plan ${result.plan_key}`}
        title={`${result.name} está activa`}
        subtitle="Comparte el acceso con su dueño. La licencia ya quedó emitida."
        hideFooter
      >
        <CredentialsCard
          storeName={result.name}
          slug={result.slug}
          ownerEmail={result.owner_email}
          ownerPhone={result.owner_phone}
          password={result.generated_password}
          loginUrl={`https://${result.slug}.sistecpos.com`}
          onCreateAnother={reset}
        />
        {result.license_key ? (
          <div className="mt-4 rounded-lg border bg-muted/40 p-3 text-xs">
            <div className="font-semibold mb-1 flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" /> Licencia emitida
            </div>
            <code className="block break-all font-mono text-[11px] text-foreground/80">{result.license_key}</code>
          </div>
        ) : null}
        {result.organization_id ? (
          <div className="mt-4 rounded-lg border bg-background p-3">
            <div className="text-xs font-semibold mb-2 text-muted-foreground uppercase tracking-wide">
              Módulos resueltos del plan
            </div>
            <EntitlementsWizardStep
              organizationId={result.organization_id}
              mode="plan-baseline"
            />
          </div>
        ) : null}
      </WizardShell>
    );
  }

  // ---------- Paso 1: Tipo de negocio ----------
  if (step === 1) {
    return (
      <WizardShell
        step={1}
        totalSteps={TOTAL}
        eyebrow="Nueva tienda"
        title="¿Qué tipo de negocio vamos a montar?"
        subtitle="Preconfiguramos lo típico para ahorrarte tiempo. Lo puedes ajustar luego."
        onNext={next}
        nextDisabled={!canAdvance()}
      >
        <div role="radiogroup" aria-label="Tipo de negocio" className="grid grid-cols-2 gap-3">
          {BUSINESS_TEMPLATES.map((t) => {
            const Icon = t.icon;
            const active = businessKey === t.key;
            return (
              <button
                key={t.key}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => setBusinessKey(t.key)}
                className={cn(
                  "text-left rounded-xl border-2 p-4 transition-all min-h-[88px]",
                  "hover:border-primary/50 hover:bg-primary/[0.02]",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                  active ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-background",
                )}
              >
                <div className="flex items-start justify-between mb-2">
                  <Icon className={cn("h-6 w-6", active ? "text-primary" : "text-muted-foreground")} aria-hidden />
                  {active && <Check className="h-4 w-4 text-primary" aria-hidden />}
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

  // ---------- Paso 2: Identidad (nombre + URL + NIT opcional) ----------
  if (step === 2) {
    return (
      <WizardShell
        step={2}
        totalSteps={TOTAL}
        eyebrow={template?.label}
        title="¿Cómo se llama tu tienda?"
        subtitle="Nombre comercial, dirección web y, si lo tienes a mano, el NIT."
        onBack={back}
        onNext={next}
        nextDisabled={!canAdvance()}
        reassurance={slugStatus === "available" ? "Esa dirección está libre." : undefined}
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name-input" className="text-sm font-medium">Nombre comercial</Label>
            <Input
              id="name-input"
              autoFocus
              autoComplete="organization"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slug || slug === slugify(name)) setSlug(slugify(e.target.value));
              }}
              placeholder="Surteya"
              className="h-12 text-base"
              required
              aria-required="true"
            />
          </div>

          <SubdomainPreview value={slug} onChange={setSlug} onStatusChange={setSlugStatus} />

          <details className="rounded-lg border border-dashed bg-muted/30 px-3 py-2 group">
            <summary className="cursor-pointer text-sm font-medium text-muted-foreground hover:text-foreground select-none">
              ¿Tienes el NIT a mano? <span className="text-xs">(opcional)</span>
            </summary>
            <div className="pt-3">
              <NitLookup
                value={taxId}
                onChange={setTaxId}
                onResolved={(r) => { if (r.legal_name && !name) setName(r.legal_name); }}
              />
            </div>
          </details>
        </div>
      </WizardShell>
    );
  }

  // ---------- Paso 3: Dueño ----------
  if (step === 3) {
    return (
      <WizardShell
        step={3}
        totalSteps={TOTAL}
        eyebrow="Dueño de la tienda"
        title="¿Quién va a operarla?"
        subtitle="Le creamos la cuenta y te mostramos sus credenciales al final."
        onBack={back}
        onNext={next}
        nextDisabled={!canAdvance()}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="own-name">Nombre completo</Label>
            <Input id="own-name" autoFocus autoComplete="name" value={ownerName}
              onChange={(e) => setOwnerName(e.target.value)} placeholder="Eduardo Tovar"
              className="h-12 text-base" required aria-required="true" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="own-email">Email</Label>
            <Input id="own-email" type="email" inputMode="email" autoComplete="email"
              value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value.trim().toLowerCase())}
              placeholder="dueno@tienda.com" className="h-12 text-base" required aria-required="true" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="own-phone">
              WhatsApp <span className="text-muted-foreground font-normal">(recomendado)</span>
            </Label>
            <Input id="own-phone" inputMode="tel" autoComplete="tel" value={ownerPhone}
              onChange={(e) => setOwnerPhone(e.target.value)} placeholder="+57 300 000 0000"
              className="h-12 text-base" aria-describedby="own-phone-help" />
            <p id="own-phone-help" className="text-xs text-muted-foreground">
              Le enviaremos sus credenciales con un toque.
            </p>
          </div>
        </div>
      </WizardShell>
    );
  }

  // ---------- Paso 4: Plan ----------
  if (step === 4) {
    return (
      <WizardShell
        step={4}
        totalSteps={TOTAL}
        eyebrow={name || "Plan y módulos"}
        title="Elige el plan"
        subtitle="El plan define automáticamente los módulos activos. Podrás cambiarlo en cualquier momento."
        onBack={back}
        onNext={next}
        nextDisabled={!canAdvance() || plansLoading}
      >
        {plansLoading ? (
          <div className="grid gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-20 rounded-xl border bg-muted/40 animate-pulse" />
            ))}
          </div>
        ) : plans.length === 0 ? (
          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            No hay planes públicos disponibles. Crea uno en <code className="font-mono">/superadmin/planes</code>.
          </div>
        ) : (
          <div role="radiogroup" aria-label="Plan" className="grid gap-2">
            {plans.map((p) => {
              const active = planKey === p.key;
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => setPlanKey(p.key)}
                  className={cn(
                    "flex items-center justify-between gap-3 rounded-xl border-2 px-4 py-3 text-left transition-all min-h-[64px]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
                    active ? "border-primary bg-primary/5 shadow-sm" : "border-border bg-background hover:border-primary/40",
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{p.name}</span>
                      {p.trial_days ? (
                        <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-success/15 text-success font-semibold">
                          {p.trial_days}d trial
                        </span>
                      ) : null}
                    </div>
                    {p.description ? (
                      <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{p.description}</div>
                    ) : null}
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-sm font-bold tabular-nums">{formatCOP(p.price_monthly)}</div>
                    {p.price_monthly ? <div className="text-[10px] text-muted-foreground">/ mes</div> : null}
                  </div>
                  <div className={cn(
                    "h-5 w-5 rounded-full border-2 grid place-items-center shrink-0",
                    active ? "border-primary bg-primary" : "border-muted-foreground/40",
                  )} aria-hidden>
                    {active && <Check className="h-3 w-3 text-primary-foreground" />}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </WizardShell>
    );
  }

  // ---------- Paso 5: Resumen ----------
  return (
    <WizardShell
      step={5}
      totalSteps={TOTAL}
      eyebrow="Último paso"
      title="Todo listo. ¿Creamos la tienda?"
      subtitle="Creamos la organización, el dueño, activamos los módulos del plan y emitimos su licencia, todo en una sola operación."
      onBack={back}
      onNext={next}
      nextLabel="Crear tienda"
      loading={saving}
      reassurance="Generaremos contraseña temporal y la verás al instante."
    >
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border bg-card divide-y">
        <SummaryRow label="Tipo de negocio" value={template?.label ?? "—"} />
        <SummaryRow label="Tienda" value={name} />
        <SummaryRow label="URL" value={`${slug}.sistecpos.com`} mono />
        <SummaryRow label="NIT" value={taxId || "Sin NIT"} />
        <SummaryRow label="Dueño" value={`${ownerName} · ${ownerEmail}`} />
        {ownerPhone ? <SummaryRow label="WhatsApp" value={ownerPhone} /> : null}
        <SummaryRow
          label="Plan"
          value={selectedPlan ? `${selectedPlan.name} · ${formatCOP(selectedPlan.price_monthly)}` : planKey}
        />
      </motion.div>
    </WizardShell>
  );
};

function SummaryRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 px-4 py-3">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
      <span className={cn("text-sm font-medium text-right truncate", mono && "font-mono")}>{value}</span>
    </div>
  );
}

export default TenantOnboardingWizard;
