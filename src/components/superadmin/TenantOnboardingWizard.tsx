import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Loader2, Copy, CheckCircle2, Store, User, Boxes, Globe } from "lucide-react";

const MODULES = [
  { key: "pos", label: "POS / Caja" },
  { key: "inventario", label: "Inventario" },
  { key: "crm", label: "CRM Leads" },
  { key: "agenda", label: "Agenda / Citas" },
  { key: "horeca", label: "HORECA" },
  { key: "mesas", label: "Mesas" },
  { key: "kds", label: "KDS Cocina" },
  { key: "retail", label: "Retail / Tienda" },
  { key: "belleza", label: "Belleza & Estética" },
  { key: "spa", label: "Spa & Bienestar" },
  { key: "representantes", label: "Representantes" },
  { key: "licencias", label: "Licencias Desktop" },
];

type Step = 1 | 2 | 3 | 4;

type Result = {
  ok: boolean;
  slug: string;
  name: string;
  owner_email: string;
  generated_password: string | null;
  modules: string[];
  domain: string | null;
};

const slugify = (s: string) =>
  s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

const TenantOnboardingWizard = ({ onCreated }: { onCreated?: () => void }) => {
  const [step, setStep] = useState<Step>(1);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  // Step 1 — Tienda
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [taxId, setTaxId] = useState("");
  const [businessType, setBusinessType] = useState("retail");

  // Step 2 — Owner
  const [ownerName, setOwnerName] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerPhone, setOwnerPhone] = useState("");

  // Step 3 — Modules
  const [modules, setModules] = useState<string[]>(["pos", "inventario"]);

  // Step 4 — Domain
  const [domain, setDomain] = useState("");

  const toggleModule = (k: string) =>
    setModules((prev) => (prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]));

  const canNext = () => {
    if (step === 1) return name.trim().length > 1 && slug.trim().length > 1;
    if (step === 2) return /\S+@\S+\.\S+/.test(ownerEmail) && ownerName.trim().length > 1;
    return true;
  };

  const submit = async () => {
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("tenant-create-with-owner", {
        body: {
          slug, name, tax_id: taxId || null, business_type: businessType,
          owner_email: ownerEmail, owner_full_name: ownerName, owner_phone: ownerPhone || null,
          modules, domain: domain || null,
        },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.detail || data?.error || "Error desconocido");
      setResult(data as Result);
      toast.success("Tienda creada correctamente");
      onCreated?.();
    } catch (e: any) {
      toast.error(e?.message ?? "No se pudo crear la tienda");
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setStep(1); setResult(null);
    setName(""); setSlug(""); setTaxId(""); setBusinessType("retail");
    setOwnerName(""); setOwnerEmail(""); setOwnerPhone("");
    setModules(["pos", "inventario"]); setDomain("");
  };

  if (result) {
    return (
      <Card className="max-w-2xl">
        <CardHeader>
          <div className="flex items-center gap-2 text-success">
            <CheckCircle2 className="h-6 w-6" />
            <CardTitle>Tienda creada</CardTitle>
          </div>
          <CardDescription>Entrega estas credenciales al dueño de la tienda. La contraseña no se podrá volver a mostrar.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Row label="Tienda" value={result.name} />
          <Row label="Slug" value={result.slug} />
          <Row label="URL de acceso" value={`${result.slug}.sistecpos.com`} />
          <Row label="Usuario (email)" value={result.owner_email} />
          {result.generated_password ? (
            <Row label="Contraseña inicial" value={result.generated_password} mono />
          ) : (
            <div className="text-xs rounded-md bg-muted p-3">
              El usuario ya existía. Conserva su contraseña actual o usa "¿Olvidaste tu contraseña?".
            </div>
          )}
          <Row label="Módulos activos" value={result.modules.join(", ") || "(ninguno)"} />
          {result.domain ? <Row label="Dominio" value={result.domain} /> : null}
          <div className="flex gap-2 pt-2">
            <Button onClick={reset} variant="outline">Crear otra tienda</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-3xl">
      <CardHeader>
        <CardTitle>Nueva tienda — Onboarding</CardTitle>
        <CardDescription>Crea la organización, su dueño, módulos y dominio en una sola operación.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Stepper step={step} />

        {step === 1 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium"><Store className="h-4 w-4" /> Datos de la tienda</div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Nombre comercial</Label>
                <Input value={name} onChange={(e) => { setName(e.target.value); if (!slug) setSlug(slugify(e.target.value)); }} placeholder="Surteya" />
              </div>
              <div>
                <Label>Slug (id_negocio)</Label>
                <Input value={slug} onChange={(e) => setSlug(slugify(e.target.value))} placeholder="surteya" />
              </div>
              <div>
                <Label>NIT</Label>
                <Input value={taxId} onChange={(e) => setTaxId(e.target.value)} placeholder="901.234.567-8" />
              </div>
              <div>
                <Label>Tipo de negocio</Label>
                <select className="w-full h-10 rounded-md border bg-background px-3 text-sm" value={businessType} onChange={(e) => setBusinessType(e.target.value)}>
                  <option value="retail">Retail / Tienda</option>
                  <option value="horeca">Restaurante / HORECA</option>
                  <option value="belleza">Belleza / Spa</option>
                  <option value="servicios">Servicios</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium"><User className="h-4 w-4" /> Dueño de la tienda</div>
            <div className="grid gap-3 md:grid-cols-2">
              <div>
                <Label>Nombre completo</Label>
                <Input value={ownerName} onChange={(e) => setOwnerName(e.target.value)} placeholder="Eduardo Tovar" />
              </div>
              <div>
                <Label>Email</Label>
                <Input type="email" value={ownerEmail} onChange={(e) => setOwnerEmail(e.target.value)} placeholder="dueno@tienda.com" />
              </div>
              <div className="md:col-span-2">
                <Label>WhatsApp (opcional)</Label>
                <Input value={ownerPhone} onChange={(e) => setOwnerPhone(e.target.value)} placeholder="+57 300 000 0000" />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Se generará una contraseña inicial. Si el email ya existe, se asignará como dueño sin cambiar su contraseña.</p>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium"><Boxes className="h-4 w-4" /> Módulos activos</div>
            <div className="grid gap-2 md:grid-cols-2">
              {MODULES.map((m) => (
                <label key={m.key} className="flex items-center gap-2 rounded-md border p-2 cursor-pointer hover:bg-muted/50">
                  <Checkbox checked={modules.includes(m.key)} onCheckedChange={() => toggleModule(m.key)} />
                  <span className="text-sm">{m.label}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium"><Globe className="h-4 w-4" /> Dominio (opcional)</div>
            <div>
              <Label>Hostname</Label>
              <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder={`${slug || "tienda"}.sistecpos.com`} />
              <p className="text-xs text-muted-foreground mt-1">Se podrá configurar más tarde desde Dominios.</p>
            </div>
            <div className="rounded-md bg-muted p-4 text-sm space-y-1">
              <div><b>Resumen:</b></div>
              <div>• Tienda: {name} ({slug})</div>
              <div>• Dueño: {ownerName} — {ownerEmail}</div>
              <div>• Módulos: {modules.join(", ") || "(ninguno)"}</div>
              {domain ? <div>• Dominio: {domain}</div> : null}
            </div>
          </div>
        )}

        <div className="flex justify-between pt-2">
          <Button variant="outline" onClick={() => setStep((s) => (s > 1 ? ((s - 1) as Step) : s))} disabled={step === 1 || saving}>
            Atrás
          </Button>
          {step < 4 ? (
            <Button onClick={() => setStep((s) => ((s + 1) as Step))} disabled={!canNext()}>
              Siguiente
            </Button>
          ) : (
            <Button onClick={submit} disabled={saving}>
              {saving ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Creando…</> : "Crear tienda"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const Stepper = ({ step }: { step: Step }) => {
  const items = ["Tienda", "Dueño", "Módulos", "Dominio"];
  return (
    <div className="flex gap-2">
      {items.map((label, i) => {
        const idx = (i + 1) as Step;
        const active = idx === step;
        const done = idx < step;
        return (
          <div key={label} className={`flex-1 rounded-md border px-3 py-2 text-xs ${active ? "border-primary bg-primary/5" : done ? "border-success/40 bg-success/5" : "border-border"}`}>
            <div className="font-medium">{idx}. {label}</div>
          </div>
        );
      })}
    </div>
  );
};

const Row = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
  <div className="flex items-center justify-between gap-3 rounded-md border p-3">
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-sm ${mono ? "font-mono" : "font-medium"}`}>{value}</div>
    </div>
    <Button size="sm" variant="ghost" onClick={() => { navigator.clipboard.writeText(value); toast.success("Copiado"); }}>
      <Copy className="h-4 w-4" />
    </Button>
  </div>
);

export default TenantOnboardingWizard;
