import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2, Plus, Loader2, Save, Search, Settings2, ExternalLink, Globe, Coins,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";

const MODULE_CATALOG = [
  { key: "pos", label: "POS / Caja", hint: "Ventas y caja" },
  { key: "agenda", label: "Agenda / Citas", hint: "Reservas" },
  { key: "inventory", label: "Inventario avanzado", hint: "Stock multi-bodega" },
  { key: "purchases", label: "Compras / Proveedores", hint: "Órdenes de compra" },
  { key: "ecommerce", label: "Tienda online", hint: "E-commerce" },
  { key: "whatsapp", label: "WhatsApp", hint: "Mensajería" },
  { key: "fiscal", label: "Facturación electrónica", hint: "Cumplimiento DIAN" },
  { key: "kds", label: "KDS Cocina", hint: "Pantalla de cocina" },
];

const BUSINESS_TYPES = [
  { value: "retail", label: "Retail" },
  { value: "restaurant", label: "Restaurante" },
  { value: "salon", label: "Salón / Spa" },
  { value: "service", label: "Servicios" },
  { value: "wholesale", label: "Mayorista" },
];

const COUNTRIES = [
  { value: "CO", label: "Colombia (COP)", currency: "COP" },
  { value: "MX", label: "México (MXN)", currency: "MXN" },
  { value: "PE", label: "Perú (PEN)", currency: "PEN" },
  { value: "CL", label: "Chile (CLP)", currency: "CLP" },
  { value: "AR", label: "Argentina (ARS)", currency: "ARS" },
  { value: "ES", label: "España (EUR)", currency: "EUR" },
  { value: "US", label: "USA (USD)", currency: "USD" },
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
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

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

  const filtered = useMemo(() => {
    const list = orgs || [];
    return list.filter((o) => {
      if (statusFilter === "active" && !o.is_active) return false;
      if (statusFilter === "inactive" && o.is_active) return false;
      if (!query.trim()) return true;
      const q = query.toLowerCase();
      return o.name.toLowerCase().includes(q) || o.slug.toLowerCase().includes(q);
    });
  }, [orgs, query, statusFilter]);

  const stats = useMemo(() => ({
    total: orgs?.length || 0,
    active: orgs?.filter(o => o.is_active).length || 0,
    inactive: orgs?.filter(o => !o.is_active).length || 0,
  }), [orgs]);

  const createOrg = async () => {
    if (!form.slug || !form.name) return toast.error("Slug y nombre son requeridos", { position: "top-center" });
    if (!/^[a-z0-9-]+$/.test(form.slug)) {
      return toast.error("Slug solo puede tener minúsculas, números y guiones", { position: "top-center" });
    }
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

  const initials = (name: string) =>
    name.split(/\s+/).slice(0, 2).map(p => p[0]?.toUpperCase() ?? "").join("") || "?";

  return (
    <TooltipProvider delayDuration={150}>
      <div className="space-y-6">
        {/* Header */}
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary">
                <Building2 className="h-5 w-5" aria-hidden />
              </span>
              Organizaciones
            </h1>
            <p className="text-sm text-muted-foreground">
              Gestiona las tiendas, sus módulos y su estado operativo.
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)} size="default" className="shrink-0">
            <Plus className="h-4 w-4 mr-1.5" aria-hidden /> Nueva tienda
          </Button>
        </header>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Total", value: stats.total, tone: "bg-muted text-foreground" },
            { label: "Activas", value: stats.active, tone: "bg-primary/10 text-primary" },
            { label: "Inactivas", value: stats.inactive, tone: "bg-destructive/10 text-destructive" },
          ].map((s) => (
            <Card key={s.label} className="border-border/60">
              <CardContent className="p-4">
                <div className="text-xs uppercase tracking-wide text-muted-foreground">{s.label}</div>
                <div className={`mt-1 text-2xl font-bold tabular-nums`}>{s.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Toolbar */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" aria-hidden />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar por nombre o slug…"
              className="pl-9"
              aria-label="Buscar organizaciones"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
            <SelectTrigger className="sm:w-44" aria-label="Filtrar por estado">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              <SelectItem value="active">Solo activas</SelectItem>
              <SelectItem value="inactive">Solo inactivas</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* List */}
        {isLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="py-12 text-center space-y-3">
              <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <Building2 className="h-6 w-6 text-muted-foreground" aria-hidden />
              </div>
              <p className="text-sm text-muted-foreground">
                {orgs?.length ? "No hay resultados para tu búsqueda." : "Sin organizaciones aún."}
              </p>
              {!orgs?.length && (
                <Button onClick={() => setCreateOpen(true)} size="sm" variant="outline">
                  <Plus className="h-4 w-4 mr-1.5" aria-hidden /> Crear la primera
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" role="list">
            {filtered.map((o) => (
              <li key={o.id}>
                <Card className="group h-full transition-all hover:shadow-md hover:border-primary/40 focus-within:ring-2 focus-within:ring-ring">
                  <CardContent className="p-4 flex flex-col gap-3 h-full">
                    <div className="flex items-start gap-3">
                      <div
                        className="w-11 h-11 rounded-lg bg-gradient-to-br from-primary to-accent text-primary-foreground flex items-center justify-center font-semibold shrink-0"
                        aria-hidden
                      >
                        {initials(o.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <Link
                          to={`/superadmin/t/${o.slug}`}
                          className="font-semibold truncate block hover:underline focus:outline-none focus-visible:underline"
                        >
                          {o.name}
                        </Link>
                        <div className="text-xs text-muted-foreground truncate">/{o.slug}</div>
                      </div>
                      <Badge
                        variant={o.is_active ? "default" : "secondary"}
                        className={o.is_active
                          ? "bg-primary/15 text-primary hover:bg-primary/20 border-transparent"
                          : "bg-muted text-muted-foreground border-transparent"}
                      >
                        {o.is_active ? "Activa" : "Inactiva"}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-1.5 text-xs">
                      {o.business_type && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                          {o.business_type}
                        </span>
                      )}
                      {o.country && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                          <Globe className="h-3 w-3" aria-hidden /> {o.country}
                        </span>
                      )}
                      {o.currency && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-muted-foreground">
                          <Coins className="h-3 w-3" aria-hidden /> {o.currency}
                        </span>
                      )}
                    </div>

                    <div className="mt-auto flex items-center justify-between gap-2 pt-2 border-t border-border/60">
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={o.is_active}
                          onCheckedChange={() => toggleActive(o)}
                          aria-label={`Estado de ${o.name}`}
                          id={`active-${o.id}`}
                        />
                        <Label htmlFor={`active-${o.id}`} className="text-xs text-muted-foreground cursor-pointer">
                          {o.is_active ? "Activa" : "Inactiva"}
                        </Label>
                      </div>
                      <div className="flex items-center gap-1">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setModulesOrg(o)}
                              aria-label={`Módulos de ${o.name}`}
                            >
                              <Settings2 className="h-4 w-4" aria-hidden />
                              <span className="ml-1 hidden sm:inline">Módulos</span>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Configurar módulos</TooltipContent>
                        </Tooltip>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="sm" asChild>
                              <Link to={`/superadmin/t/${o.slug}`} aria-label={`Abrir ${o.name}`}>
                                <ExternalLink className="h-4 w-4" aria-hidden />
                                <span className="ml-1 hidden sm:inline">Abrir</span>
                              </Link>
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>Abrir panel de la tienda</TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </li>
            ))}
          </ul>
        )}

        {/* Create Dialog */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Nueva organización</DialogTitle>
              <DialogDescription>Da de alta una tienda nueva en SistecPOS.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="org-name">Nombre comercial</Label>
                <Input
                  id="org-name"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Mi Tienda S.A.S."
                  autoFocus
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="org-slug">Slug (URL)</Label>
                <Input
                  id="org-slug"
                  value={form.slug}
                  onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))}
                  placeholder="mi-tienda"
                  aria-describedby="slug-hint"
                />
                <p id="slug-hint" className="text-xs text-muted-foreground">
                  Solo minúsculas, números y guiones. Aparecerá en la URL.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Tipo de negocio</Label>
                  <Select value={form.business_type} onValueChange={(v) => setForm((f) => ({ ...f, business_type: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BUSINESS_TYPES.map((b) => (
                        <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>País</Label>
                  <Select
                    value={form.country}
                    onValueChange={(v) => {
                      const c = COUNTRIES.find((x) => x.value === v);
                      setForm((f) => ({ ...f, country: v, currency: c?.currency || f.currency }));
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateOpen(false)} disabled={saving}>
                Cancelar
              </Button>
              <Button onClick={createOrg} disabled={saving}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-1.5" aria-hidden />
                ) : (
                  <Save className="h-4 w-4 mr-1.5" aria-hidden />
                )}
                Crear tienda
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Modules Dialog */}
        <Dialog open={!!modulesOrg} onOpenChange={(v) => !v && setModulesOrg(null)}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>Módulos</DialogTitle>
              <DialogDescription>
                {modulesOrg?.name} — activa las capacidades contratadas.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
              {MODULE_CATALOG.map((m) => {
                const enabled = modules?.get(m.key) ?? false;
                const switchId = `mod-${m.key}`;
                return (
                  <div
                    key={m.key}
                    className="flex items-center justify-between gap-3 rounded-lg border border-border/70 p-3 hover:bg-muted/40 transition-colors"
                  >
                    <div className="min-w-0">
                      <Label htmlFor={switchId} className="font-medium text-sm block cursor-pointer">
                        {m.label}
                      </Label>
                      <div className="text-xs text-muted-foreground">{m.hint}</div>
                    </div>
                    <Switch
                      id={switchId}
                      checked={enabled}
                      onCheckedChange={() => toggleModule(m.key, enabled)}
                      aria-label={`Activar ${m.label}`}
                    />
                  </div>
                );
              })}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setModulesOrg(null)}>Cerrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  );
};

export default OrganizationsTab;
