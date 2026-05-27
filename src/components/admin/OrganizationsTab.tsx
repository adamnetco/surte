import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, Plus, Loader2, ToggleLeft, ToggleRight, Save, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

const MODULE_CATALOG = [
  { key: "pos", label: "POS / Caja" },
  { key: "agenda", label: "Agenda / Citas" },
  { key: "inventory", label: "Inventario avanzado" },
  { key: "purchases", label: "Compras / Proveedores" },
  { key: "ecommerce", label: "Tienda online" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "fiscal", label: "Facturación electrónica" },
  { key: "kds", label: "KDS Cocina" },
];

type Org = {
  id: string;
  slug: string;
  name: string;
  business_type: string | null;
  country: string | null;
  currency: string | null;
  is_active: boolean;
};

const OrganizationsTab = () => {
  const qc = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ slug: "", name: "", business_type: "retail", country: "CO", currency: "COP" });
  const [saving, setSaving] = useState(false);
  const [modulesOrg, setModulesOrg] = useState<Org | null>(null);

  const { data: orgs, isLoading } = useQuery({
    queryKey: ["admin-organizations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organizations")
        .select("id,slug,name,business_type,country,currency,is_active")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as Org[];
    },
  });

  const { data: modules, refetch: refetchModules } = useQuery({
    queryKey: ["org-modules", modulesOrg?.id],
    enabled: !!modulesOrg?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("organization_modules")
        .select("module_key,enabled")
        .eq("organization_id", modulesOrg!.id);
      if (error) throw error;
      return new Map((data || []).map((m: any) => [m.module_key, m.enabled]));
    },
  });

  const createOrg = async () => {
    if (!form.slug || !form.name) return toast.error("Slug y nombre son requeridos");
    setSaving(true);
    const { error } = await supabase.from("organizations").insert({
      slug: form.slug.toLowerCase().trim(),
      name: form.name.trim(),
      business_type: form.business_type,
      country: form.country,
      currency: form.currency,
      is_active: true,
    });
    setSaving(false);
    if (error) return toast.error(error.message, { position: "top-center" });
    toast.success("Organización creada", { position: "top-center" });
    setCreateOpen(false);
    setForm({ slug: "", name: "", business_type: "retail", country: "CO", currency: "COP" });
    qc.invalidateQueries({ queryKey: ["admin-organizations"] });
  };

  const toggleActive = async (org: Org) => {
    if (!window.confirm(`${org.is_active ? "Desactivar" : "Activar"} ${org.name}?`)) return;
    const { error } = await supabase
      .from("organizations").update({ is_active: !org.is_active }).eq("id", org.id);
    if (error) return toast.error(error.message, { position: "top-center" });
    toast.success("Estado actualizado", { position: "top-center" });
    qc.invalidateQueries({ queryKey: ["admin-organizations"] });
  };

  const toggleModule = async (mkey: string, current: boolean) => {
    if (!modulesOrg) return;
    const { error } = await supabase
      .from("organization_modules")
      .upsert(
        { organization_id: modulesOrg.id, module_key: mkey, enabled: !current },
        { onConflict: "organization_id,module_key" }
      );
    if (error) return toast.error(error.message, { position: "top-center" });
    refetchModules();
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="h-5 w-5" /> Organizaciones / Tiendas
          </h2>
          <p className="text-sm text-muted-foreground">Alta de negocios y gestión de módulos contratados.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Nueva tienda
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full" />)}</div>
      ) : (
        <div className="grid gap-2">
          {(orgs || []).map(o => (
            <div key={o.id} className="border border-border rounded-lg p-3 flex items-center justify-between bg-card">
              <div className="min-w-0">
                <div className="font-medium truncate">{o.name}</div>
                <div className="text-xs text-muted-foreground">
                  /{o.slug} · {o.business_type || "—"} · {o.country} · {o.currency}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded ${o.is_active ? "bg-green-100 text-green-700" : "bg-muted text-muted-foreground"}`}>
                  {o.is_active ? "Activa" : "Inactiva"}
                </span>
                <Button variant="outline" size="sm" onClick={() => setModulesOrg(o)}>Módulos</Button>
                <Button variant="ghost" size="sm" onClick={() => toggleActive(o)}>
                  {o.is_active ? <ToggleRight className="h-4 w-4 text-green-600" /> : <ToggleLeft className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          ))}
          {!orgs?.length && <p className="text-sm text-muted-foreground text-center py-8">Sin organizaciones aún.</p>}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nueva organización</DialogTitle>
            <DialogDescription>Da de alta una tienda nueva en SistecPOS.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Slug (URL)</Label>
              <Input value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value }))} placeholder="mi-tienda" />
            </div>
            <div>
              <Label>Nombre</Label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Mi Tienda S.A.S." />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <Label>Tipo</Label>
                <Input value={form.business_type} onChange={e => setForm(f => ({ ...f, business_type: e.target.value }))} />
              </div>
              <div>
                <Label>País</Label>
                <Input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} />
              </div>
              <div>
                <Label>Moneda</Label>
                <Input value={form.currency} onChange={e => setForm(f => ({ ...f, currency: e.target.value }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancelar</Button>
            <Button onClick={createOrg} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Save className="h-4 w-4 mr-1" />}
              Crear
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modules Dialog */}
      <Dialog open={!!modulesOrg} onOpenChange={(v) => !v && setModulesOrg(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Módulos · {modulesOrg?.name}</DialogTitle>
            <DialogDescription>Activa o desactiva las capacidades contratadas.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {MODULE_CATALOG.map(m => {
              const enabled = modules?.get(m.key) ?? false;
              return (
                <div key={m.key} className="flex items-center justify-between border border-border rounded-lg p-2">
                  <div>
                    <div className="font-medium text-sm">{m.label}</div>
                    <div className="text-xs text-muted-foreground">{m.key}</div>
                  </div>
                  <button
                    onClick={() => toggleModule(m.key, enabled)}
                    className={`p-1 rounded ${enabled ? "text-green-600" : "text-muted-foreground"}`}
                    aria-label={`Toggle ${m.label}`}
                  >
                    {enabled ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6" />}
                  </button>
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setModulesOrg(null)}>
              <X className="h-4 w-4 mr-1" /> Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrganizationsTab;
