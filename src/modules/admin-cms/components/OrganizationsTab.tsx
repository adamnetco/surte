import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { organizationSchema, type OrganizationFormValues } from "@/lib/schemas";
import { errorToMessage } from "@/lib/errors";

type ModuleRow = {
  key: string;
  name: string;
  description: string | null;
  category: string;
  sort_order: number;
};

const CATEGORY_LABELS: Record<string, string> = {
  core: "Núcleo",
  operations: "Operación",
  verticals: "Verticales",
  crm: "CRM & Ventas",
  admin: "Administración",
  general: "General",
};

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
  const [modulesOrg, setModulesOrg] = useState<Org | null>(null);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<OrganizationFormValues>({
    resolver: zodResolver(organizationSchema),
    defaultValues: { slug: "", name: "", business_type: "retail", country: "CO", currency: "COP" },
    mode: "onBlur",
  });

  const businessType = watch("business_type");
  const country = watch("country");

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

  const { data: moduleCatalog, isLoading: catalogLoading } = useQuery<ModuleRow[]>({
    queryKey: ["module-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("modules" as never)
        .select("key,name,description,category,sort_order")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ModuleRow[];
    },
  });

  const groupedCatalog = useMemo(() => {
    const groups = new Map<string, ModuleRow[]>();
    (moduleCatalog ?? []).forEach((m) => {
      const arr = groups.get(m.category) ?? [];
      arr.push(m);
      groups.set(m.category, arr);
    });
    return Array.from(groups.entries());
  }, [moduleCatalog]);

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

  const onCreate = handleSubmit(async (values) => {
    try {
      const { error } = await supabase.from("organizations").insert({
        slug: values.slug.toLowerCase().trim(),
        name: values.name.trim(),
        business_type: values.business_type,
        country: values.country,
        currency: values.currency,
        is_active: true,
      });
      if (error) throw error;
      toast.success("Organización creada", { position: "top-center" });
      setCreateOpen(false);
      reset({ slug: "", name: "", business_type: "retail", country: "CO", currency: "COP" });
      qc.invalidateQueries({ queryKey: ["admin-organizations"] });
    } catch (e) {
      toast.error(errorToMessage(e), { position: "top-center" });
    }
  });

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
    const next = !current;
    // Optimistic update
    qc.setQueryData(["org-modules", modulesOrg.id], (prev: Map<string, boolean> | undefined) => {
      const map = new Map(prev ?? []);
      map.set(mkey, next);
      return map;
    });
    const { error } = await supabase
      .from("organization_modules")
      .upsert(
        { organization_id: modulesOrg.id, module_key: mkey, enabled: next },
        { onConflict: "organization_id,module_key" }
      );
    if (error) {
      toast.error(`No se pudo ${next ? "activar" : "desactivar"}: ${error.message}`, { position: "top-center" });
      refetchModules();
      return;
    }
    toast.success(`${next ? "Activado" : "Desactivado"}`, { position: "top-center" });
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
            <form onSubmit={onCreate} noValidate className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="org-name">Nombre comercial</Label>
                <Input
                  id="org-name"
                  {...register("name")}
                  placeholder="Mi Tienda S.A.S."
                  autoFocus
                  aria-invalid={!!errors.name}
                />
                {errors.name && (
                  <p role="alert" className="text-xs text-destructive">{errors.name.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="org-slug">Slug (URL)</Label>
                <Input
                  id="org-slug"
                  {...register("slug", {
                    onChange: (e) => {
                      const v = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "");
                      setValue("slug", v, { shouldValidate: true });
                    },
                  })}
                  placeholder="mi-tienda"
                  aria-describedby="slug-hint"
                  aria-invalid={!!errors.slug}
                />
                {errors.slug ? (
                  <p role="alert" className="text-xs text-destructive">{errors.slug.message}</p>
                ) : (
                  <p id="slug-hint" className="text-xs text-muted-foreground">
                    Solo minúsculas, números y guiones. Aparecerá en la URL.
                  </p>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Tipo de negocio</Label>
                  <Select
                    value={businessType}
                    onValueChange={(v) => setValue("business_type", v as OrganizationFormValues["business_type"], { shouldValidate: true })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BUSINESS_TYPES.map((b) => (
                        <SelectItem key={b.value} value={b.value}>{b.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.business_type && (
                    <p role="alert" className="text-xs text-destructive">{errors.business_type.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label>País</Label>
                  <Select
                    value={country}
                    onValueChange={(v) => {
                      const c = COUNTRIES.find((x) => x.value === v);
                      setValue("country", v, { shouldValidate: true });
                      if (c) setValue("currency", c.currency, { shouldValidate: true });
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {COUNTRIES.map((c) => (
                        <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.country && (
                    <p role="alert" className="text-xs text-destructive">{errors.country.message}</p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} disabled={isSubmitting}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1.5" aria-hidden />
                  ) : (
                    <Save className="h-4 w-4 mr-1.5" aria-hidden />
                  )}
                  Crear tienda
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>

        {/* Modules Dialog */}
        <Dialog open={!!modulesOrg} onOpenChange={(v) => !v && setModulesOrg(null)}>
          <DialogContent className="sm:max-w-xl max-h-[90dvh] flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Settings2 className="h-5 w-5 text-primary" aria-hidden />
                Módulos
              </DialogTitle>
              <DialogDescription>
                <span className="font-medium text-foreground">{modulesOrg?.name}</span> — activa las capacidades contratadas. Los cambios se aplican al instante.
              </DialogDescription>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto -mx-6 px-6 space-y-5 py-2">
              {catalogLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-16 w-full rounded-lg" />
                  ))}
                </div>
              ) : groupedCatalog.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No hay módulos disponibles.
                </p>
              ) : (
                groupedCatalog.map(([category, items]) => (
                  <div key={category} className="space-y-2">
                    <h3 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground px-1">
                      {CATEGORY_LABELS[category] ?? category}
                    </h3>
                    <div className="space-y-1.5">
                      {items.map((m) => {
                        const enabled = modules?.get(m.key) ?? false;
                        const switchId = `mod-${m.key}`;
                        return (
                          <div
                            key={m.key}
                            className="flex items-center justify-between gap-3 rounded-lg border border-border/70 p-3 hover:bg-muted/40 transition-colors"
                          >
                            <div className="min-w-0 flex-1">
                              <Label htmlFor={switchId} className="font-medium text-sm block cursor-pointer">
                                {m.name}
                              </Label>
                              {m.description && (
                                <div className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                                  {m.description}
                                </div>
                              )}
                            </div>
                            <Switch
                              id={switchId}
                              checked={enabled}
                              onCheckedChange={() => toggleModule(m.key, enabled)}
                              aria-label={`${enabled ? "Desactivar" : "Activar"} ${m.name}`}
                            />
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
            <DialogFooter className="border-t pt-4">
              <Button variant="outline" onClick={() => setModulesOrg(null)}>Cerrar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </TooltipProvider>
  );
};

export default OrganizationsTab;
