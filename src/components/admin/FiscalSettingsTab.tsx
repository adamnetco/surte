import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Receipt, Save, Loader2, Building2, Percent, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

type Org = { id: string; name: string; slug: string };
type EInvCfg = {
  id?: string;
  organization_id: string;
  environment: string;
  nit: string;
  dv: string;
  razon_social: string;
  resolution_number: string;
  resolution_prefix: string;
  resolution_from: number | null;
  resolution_to: number | null;
  resolution_current: number | null;
  resolution_valid_from: string | null;
  resolution_valid_until: string | null;
  technical_key: string;
  contact_name: string;
  contact_email: string;
  contact_phone: string;
  is_active: boolean;
};

type TaxRate = { code: string; label: string; rate: number };

const blankCfg = (org_id: string): EInvCfg => ({
  organization_id: org_id, environment: "test", nit: "", dv: "", razon_social: "",
  resolution_number: "", resolution_prefix: "FE", resolution_from: null, resolution_to: null,
  resolution_current: null, resolution_valid_from: null, resolution_valid_until: null,
  technical_key: "", contact_name: "", contact_email: "", contact_phone: "", is_active: true,
});

const FiscalSettingsTab = () => {
  const qc = useQueryClient();
  const [orgId, setOrgId] = useState<string>("");
  const [cfg, setCfg] = useState<EInvCfg | null>(null);
  const [saving, setSaving] = useState(false);
  const [taxes, setTaxes] = useState<TaxRate[]>([]);
  const [savingTaxes, setSavingTaxes] = useState(false);

  const { data: orgs } = useQuery({
    queryKey: ["fiscal-orgs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations").select("id,name,slug").eq("is_active", true).order("name");
      if (error) throw error;
      return data as Org[];
    },
  });

  useEffect(() => {
    if (!orgId && orgs?.length) setOrgId(orgs[0].id);
  }, [orgs, orgId]);

  const { data: current, isLoading } = useQuery({
    queryKey: ["einvoice-cfg", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("einvoice_configs").select("*").eq("organization_id", orgId).maybeSingle();
      if (error) throw error;
      return data as EInvCfg | null;
    },
  });

  useEffect(() => {
    setCfg(current ?? (orgId ? blankCfg(orgId) : null));
  }, [current, orgId]);

  const { data: taxSetting } = useQuery({
    queryKey: ["app-tax-rates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings").select("value").eq("key", "tax_rates").maybeSingle();
      if (error) throw error;
      return (data?.value as unknown as TaxRate[] | null) || [
        { code: "IVA19", label: "IVA 19%", rate: 19 },
        { code: "IVA5", label: "IVA 5%", rate: 5 },
        { code: "EXENTO", label: "Exento", rate: 0 },
      ];
    },
  });

  useEffect(() => { if (taxSetting) setTaxes(taxSetting); }, [taxSetting]);

  const saveCfg = async () => {
    if (!cfg) return;
    if (!cfg.nit || !cfg.razon_social) return toast.error("NIT y Razón Social requeridos", { position: "top-center" });
    setSaving(true);
    const payload = {
      ...cfg,
      resolution_from: cfg.resolution_from ? Number(cfg.resolution_from) : null,
      resolution_to: cfg.resolution_to ? Number(cfg.resolution_to) : null,
      resolution_current: cfg.resolution_current ? Number(cfg.resolution_current) : null,
      resolution_valid_from: cfg.resolution_valid_from || null,
      resolution_valid_until: cfg.resolution_valid_until || null,
    };
    const { error } = cfg.id
      ? await supabase.from("einvoice_configs").update(payload as any).eq("id", cfg.id)
      : await supabase.from("einvoice_configs").insert(payload as any);
    setSaving(false);
    if (error) return toast.error(error.message, { position: "top-center" });
    toast.success("Configuración fiscal guardada", { position: "top-center" });
    qc.invalidateQueries({ queryKey: ["einvoice-cfg", orgId] });
  };

  const saveTaxes = async () => {
    setSavingTaxes(true);
    const { error } = await supabase
      .from("app_settings")
      .upsert({ key: "tax_rates", value: taxes as any }, { onConflict: "key" });
    setSavingTaxes(false);
    if (error) return toast.error(error.message, { position: "top-center" });
    toast.success("Impuestos guardados", { position: "top-center" });
    qc.invalidateQueries({ queryKey: ["app-tax-rates"] });
  };

  const update = (patch: Partial<EInvCfg>) => setCfg(c => c ? { ...c, ...patch } : c);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold flex items-center gap-2">
          <Receipt className="h-5 w-5" /> Configuración Fiscal
        </h2>
        <p className="text-sm text-muted-foreground">Resolución DIAN, datos fiscales por organización e impuestos globales.</p>
      </div>

      {/* Org selector */}
      <div className="border border-border rounded-lg p-3 bg-card">
        <Label className="text-xs flex items-center gap-1"><Building2 className="h-3 w-3" /> Organización</Label>
        <select
          className="w-full mt-1 border border-border rounded-md p-2 bg-background text-sm"
          value={orgId} onChange={e => setOrgId(e.target.value)}
        >
          {orgs?.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </div>

      {/* E-Invoice config */}
      <div className="border border-border rounded-lg p-4 bg-card space-y-3">
        <h3 className="font-semibold text-sm">Facturación Electrónica (DIAN)</h3>
        {isLoading || !cfg ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <>
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <Label>Ambiente</Label>
                <select className="w-full border border-border rounded-md p-2 bg-background text-sm"
                  value={cfg.environment} onChange={e => update({ environment: e.target.value })}>
                  <option value="test">Pruebas (Habilitación)</option>
                  <option value="production">Producción</option>
                </select>
              </div>
              <div>
                <Label>Razón Social</Label>
                <Input value={cfg.razon_social || ""} onChange={e => update({ razon_social: e.target.value })} />
              </div>
              <div>
                <Label>NIT</Label>
                <Input value={cfg.nit || ""} onChange={e => update({ nit: e.target.value })} />
              </div>
              <div>
                <Label>DV</Label>
                <Input value={cfg.dv || ""} onChange={e => update({ dv: e.target.value })} maxLength={1} />
              </div>
              <div>
                <Label>Resolución DIAN</Label>
                <Input value={cfg.resolution_number || ""} onChange={e => update({ resolution_number: e.target.value })} />
              </div>
              <div>
                <Label>Prefijo</Label>
                <Input value={cfg.resolution_prefix || ""} onChange={e => update({ resolution_prefix: e.target.value })} />
              </div>
              <div>
                <Label>Desde</Label>
                <Input type="number" value={cfg.resolution_from ?? ""} onChange={e => update({ resolution_from: e.target.value ? Number(e.target.value) : null })} />
              </div>
              <div>
                <Label>Hasta</Label>
                <Input type="number" value={cfg.resolution_to ?? ""} onChange={e => update({ resolution_to: e.target.value ? Number(e.target.value) : null })} />
              </div>
              <div>
                <Label>Consecutivo actual</Label>
                <Input type="number" value={cfg.resolution_current ?? ""} onChange={e => update({ resolution_current: e.target.value ? Number(e.target.value) : null })} />
              </div>
              <div>
                <Label>Clave técnica</Label>
                <Input value={cfg.technical_key || ""} onChange={e => update({ technical_key: e.target.value })} />
              </div>
              <div>
                <Label>Válida desde</Label>
                <Input type="date" value={cfg.resolution_valid_from || ""} onChange={e => update({ resolution_valid_from: e.target.value || null })} />
              </div>
              <div>
                <Label>Válida hasta</Label>
                <Input type="date" value={cfg.resolution_valid_until || ""} onChange={e => update({ resolution_valid_until: e.target.value || null })} />
              </div>
              <div>
                <Label>Contacto</Label>
                <Input value={cfg.contact_name || ""} onChange={e => update({ contact_name: e.target.value })} />
              </div>
              <div>
                <Label>Email contacto</Label>
                <Input type="email" value={cfg.contact_email || ""} onChange={e => update({ contact_email: e.target.value })} />
              </div>
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-border">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={cfg.is_active} onChange={e => update({ is_active: e.target.checked })} />
                Configuración activa
              </label>
              <Button onClick={saveCfg} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
                Guardar
              </Button>
            </div>
          </>
        )}
      </div>

      {/* Tax rates */}
      <div className="border border-border rounded-lg p-4 bg-card space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm flex items-center gap-2"><Percent className="h-4 w-4" /> Impuestos globales</h3>
          <Button size="sm" variant="outline" onClick={() => setTaxes(t => [...t, { code: "", label: "", rate: 0 }])}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Agregar
          </Button>
        </div>
        <div className="space-y-2">
          {taxes.map((t, i) => (
            <div key={i} className="grid grid-cols-12 gap-2 items-center">
              <Input className="col-span-3" placeholder="Código" value={t.code}
                onChange={e => setTaxes(arr => arr.map((x, idx) => idx === i ? { ...x, code: e.target.value } : x))} />
              <Input className="col-span-6" placeholder="Etiqueta" value={t.label}
                onChange={e => setTaxes(arr => arr.map((x, idx) => idx === i ? { ...x, label: e.target.value } : x))} />
              <Input className="col-span-2" type="number" step="0.01" placeholder="%" value={t.rate}
                onChange={e => setTaxes(arr => arr.map((x, idx) => idx === i ? { ...x, rate: Number(e.target.value) } : x))} />
              <Button className="col-span-1" size="sm" variant="ghost"
                onClick={() => { if (window.confirm("¿Eliminar impuesto?")) setTaxes(arr => arr.filter((_, idx) => idx !== i)); }}>
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          ))}
          {taxes.length === 0 && <p className="text-xs text-muted-foreground">Sin impuestos definidos.</p>}
        </div>
        <div className="flex justify-end pt-2 border-t border-border">
          <Button onClick={saveTaxes} disabled={savingTaxes}>
            {savingTaxes ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
            Guardar impuestos
          </Button>
        </div>
      </div>
    </div>
  );
};

export default FiscalSettingsTab;
