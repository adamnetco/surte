/**
 * Wizard del Superadmin para crear una nueva tienda (organización + dueño
 * + módulos + dominio) de forma conversacional.
 *
 * Pasos:
 *  1. Tipo de negocio (plantilla) → preselecciona módulos
 *  2. Identidad (nombre + slug con check de disponibilidad)
 *  3. Identificación fiscal (NIT con autocompletar opcional)
 *  4. Dueño (nombre, email, WhatsApp)
 *  5. Módulos (preselección de la plantilla, ajustable)
 *  6. Confirmación → submit → CredentialsCard
 */
import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { WizardShell } from "@/components/onboarding/WizardShell";
import { SubdomainPreview, type SlugStatus } from "@/components/onboarding/SubdomainPreview";
import { NitLookup } from "@/components/onboarding/NitLookup";
import { CredentialsCard } from "@/components/onboarding/CredentialsCard";
import { BUSINESS_TEMPLATES, ALL_MODULES, getTemplate, type BusinessKey } from "@/lib/onboarding/businessTemplates";
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
};

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

const TOTAL = 6;

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
  const [modules, setModules] = useState<string[]>([]);

  const template = useMemo(() => (businessKey ? getTemplate(businessKey) : null), [businessKey]);

  const toggleModule = (k: string) =>
    setModules((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));

  const reset = () => {
    setStep(1); setResult(null);
    setBusinessKey(null); setName(""); setSlug(""); setSlugStatus("idle");
    setTaxId(""); setOwnerName(""); setOwnerEmail(""); setOwnerPhone(""); setModules([]);
  };

  const back = () => setStep((s) => Math.max(1, s - 1));

  const canAdvance = (): boolean => {
    switch (step) {
      case 1: return !!businessKey;
      case 2: return name.trim().length > 1 && slug.length >= 3 && slugStatus === "available";
      case 3: return true; // NIT opcional
      case 4: return ownerName.trim().length > 1 && /\S+@\S+\.\S+/.test(ownerEmail);
      case 5: return modules.length > 0;
      case 6: return true;
      default: return false;
    }
  };

  const next = async () => {
    if (!canAdvance()) return;
    if (step < TOTAL) {
      setStep((s) => s + 1);
      return;
    }
    // Submit
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("tenant-create-with-owner", {
        body: {
          slug, name, tax_id: taxId || null, business_type: businessKey,
          owner_email: ownerEmail, owner_full_name: ownerName, owner_phone: ownerPhone || null,
          modules, domain: `${slug}.sistecpos.com`,
        },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.detail || data?.error || "Error desconocido");
      setResult({ ...(data as Result), owner_phone: ownerPhone || null });
      toast.success("Tienda creada correctamente");
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
        eyebrow="Listo"
        title={`${result.name} está activa`}
        subtitle="Comparte el acceso con su dueño."
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
      </WizardShell>
    );
  }

  // ---- Steps ----

  if (step === 1) {
    return (
      <WizardShell
        step={1}
        totalSteps={TOTAL}
        eyebrow="Nueva tienda"
        title="¿Qué tipo de negocio vamos a montar?"
        subtitle="Preconfiguramos los módulos típicos para ahorrarte tiempo."
        onNext={next}
        nextDisabled={!canAdvance()}
      >
        <div className="grid grid-cols-2 gap-3">
          {BUSINESS_TEMPLATES.map((t) => {
            const Icon = t.icon;
            const active = businessKey === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => {
                  setBusinessKey(t.key);
                  setModules(t.modules);
                }}
                className={cn(
                  "text-left rounded-xl border-2 p-4 transition-all",
                  "hover:border-primary/50 hover:bg-primary/[0.02]",
                  active
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border bg-background",
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

  if (step === 2) {
    return (
      <WizardShell
        step={2}
        totalSteps={TOTAL}
        eyebrow={template?.label}
        title="¿Cómo se llama tu tienda?"
        subtitle="El nombre comercial que verán los clientes y la dirección de su tienda online."
        onBack={back}
        onNext={next}
        nextDisabled={!canAdvance()}
        reassurance={slugStatus === "available" ? "Listo, esa dirección está disponible." : undefined}
      >
        <div className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name-input" className="text-sm font-medium">Nombre comercial</Label>
            <Input
              id="name-input"
              autoFocus
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slug || slug === slugify(name)) setSlug(slugify(e.target.value));
              }}
              placeholder="Surteya"
              className="h-12 text-base"
            />
          </div>

          <SubdomainPreview value={slug} onChange={setSlug} onStatusChange={setSlugStatus} />
        </div>
      </WizardShell>
    );
  }

  if (step === 3) {
    return (
      <WizardShell
        step={3}
        totalSteps={TOTAL}
        eyebrow={name}
        title="Identificación fiscal"
        subtitle="Si nos das el NIT, autocompletamos los datos legales. Puedes saltarlo."
        onBack={back}
        onNext={next}
        nextLabel={taxId ? "Continuar" : "Saltar"}
      >
        <NitLookup
          value={taxId}
          onChange={setTaxId}
          onResolved={(r) => {
            if (r.legal_name && !name) setName(r.legal_name);
          }}
        />
      </WizardShell>
    );
  }

  if (step === 4) {
    return (
      <WizardShell
        step={4}
        totalSteps={TOTAL}
        eyebrow="Dueño de la tienda"
        title="¿Quién va a operarla?"
        subtitle="Le crearemos su cuenta y le enviarás las credenciales al final."
        onBack={back}
        onNext={next}
        nextDisabled={!canAdvance()}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="own-name">Nombre completo</Label>
            <Input id="own-name" autoFocus value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Eduardo Tovar" className="h-12 text-base" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="own-email">Email</Label>
            <Input id="own-email" type="email" inputMode="email" autoComplete="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value.trim().toLowerCase())} placeholder="dueno@tienda.com" className="h-12 text-base" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="own-phone">
              WhatsApp <span className="text-muted-foreground font-normal">(recomendado)</span>
            </Label>
            <Input id="own-phone" inputMode="tel" autoComplete="tel" value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} placeholder="+57 300 000 0000" className="h-12 text-base" />
            <p className="text-xs text-muted-foreground">Le enviaremos sus credenciales por WhatsApp con un toque.</p>
          </div>
        </div>
      </WizardShell>
    );
  }

  if (step === 5) {
    return (
      <WizardShell
        step={5}
        totalSteps={TOTAL}
        eyebrow={template?.label}
        title="Confirma los módulos activos"
        subtitle="Preseleccionamos los típicos para tu tipo de negocio. Puedes ajustar."
        onBack={back}
        onNext={next}
        nextDisabled={!canAdvance()}
      >
        <div className="grid gap-2 sm:grid-cols-2">
          {ALL_MODULES.map((m) => {
            const active = modules.includes(m.key);
            return (
              <button
                key={m.key}
                type="button"
                onClick={() => toggleModule(m.key)}
                className={cn(
                  "flex items-center gap-3 rounded-lg border-2 px-3 py-2.5 text-left transition-colors",
                  active ? "border-primary bg-primary/5" : "border-border bg-background hover:border-primary/40",
                )}
              >
                <div className={cn(
                  "h-5 w-5 rounded-md border-2 grid place-items-center shrink-0",
                  active ? "border-primary bg-primary" : "border-muted-foreground/40",
                )}>
                  {active && <Check className="h-3 w-3 text-primary-foreground" />}
                </div>
                <span className="text-sm font-medium">{m.label}</span>
              </button>
            );
          })}
        </div>
      </WizardShell>
    );
  }

  // step 6 — confirm
  return (
    <WizardShell
      step={6}
      totalSteps={TOTAL}
      eyebrow="Último paso"
      title="Todo listo. ¿Creamos la tienda?"
      subtitle="Vamos a crear la organización, el usuario dueño y activar los módulos en una sola operación."
      onBack={back}
      onNext={next}
      nextLabel="Crear tienda"
      loading={saving}
      reassurance="Generaremos una contraseña temporal y te la mostraremos al instante."
    >
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-xl border bg-card divide-y">
        <SummaryRow label="Tipo de negocio" value={template?.label ?? "—"} />
        <SummaryRow label="Tienda" value={name} />
        <SummaryRow label="URL" value={`${slug}.sistecpos.com`} mono />
        <SummaryRow label="NIT" value={taxId || "Sin NIT"} />
        <SummaryRow label="Dueño" value={`${ownerName} · ${ownerEmail}`} />
        {ownerPhone ? <SummaryRow label="WhatsApp" value={ownerPhone} /> : null}
        <SummaryRow label="Módulos" value={`${modules.length} activos`} />
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
