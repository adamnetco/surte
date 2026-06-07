import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useImageUpload } from "@/modules/admin-cms/hooks/useImageUpload";
import { Plus, Pencil, Trash2, Save, X, Upload, Loader2, Image as ImageIcon, ExternalLink, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import SortableList from "./SortableList";
import { brandSchema, type BrandFormValues } from "@/lib/schemas";
import { errorToMessage } from "@/lib/errors";

const slugify = (v: string) =>
  v.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");

const defaultValues: BrandFormValues = {
  name: "",
  slug: "",
  logo_url: "",
  website_url: "",
  sort_order: 0,
  is_active: true,
  meta_title: "",
  meta_description: "",
  og_image_url: "",
};

const BrandsTab = ({ queryClient }: { queryClient: any }) => {
  const { data: brands } = useQuery({
    queryKey: ["admin-brands"],
    queryFn: async () => {
      const { data, error } = await supabase.from("brands").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const [editing, setEditing] = useState<string | null>(null);
  const { upload, uploading } = useImageUpload();

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<BrandFormValues>({
    resolver: zodResolver(brandSchema),
    defaultValues,
    mode: "onBlur",
  });

  const logoUrl = watch("logo_url");
  const ogImageUrl = watch("og_image_url");
  const isActive = watch("is_active");

  const resetForm = () => {
    reset(defaultValues);
    setEditing(null);
  };

  const handleImg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await upload(file, "brands");
    if (url) setValue("logo_url", url, { shouldDirty: true, shouldValidate: true });
  };

  const handleOgImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await upload(file, "seo-images");
    if (url) setValue("og_image_url", url, { shouldDirty: true, shouldValidate: true });
  };

  const onSubmit = async (values: BrandFormValues) => {
    const finalSlug = values.slug || slugify(values.name);
    const payload = {
      name: values.name.trim(),
      logo_url: values.logo_url || null,
      website_url: values.website_url || null,
      sort_order: values.sort_order,
      is_active: values.is_active,
      slug: finalSlug,
      meta_title: values.meta_title || null,
      meta_description: values.meta_description || null,
      og_image_url: values.og_image_url || null,
    };

    try {
      if (editing && editing !== "new") {
        const { error } = await supabase.from("brands").update(payload).eq("id", editing);
        if (error) throw error;
        toast.success("Marca actualizada");
      } else {
        const { error } = await supabase.from("brands").insert(payload);
        if (error) throw error;
        toast.success("Marca creada");
      }
      queryClient.invalidateQueries({ queryKey: ["admin-brands"] });
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      resetForm();
    } catch (err) {
      toast.error(errorToMessage(err));
    }
  };

  const del = async (id: string) => {
    if (!confirm("¿Eliminar esta marca?")) return;
    try {
      const { error } = await supabase.from("brands").delete().eq("id", id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["admin-brands"] });
      queryClient.invalidateQueries({ queryKey: ["brands"] });
      toast.success("Marca eliminada");
    } catch (err) {
      toast.error(errorToMessage(err));
    }
  };

  const toggleActive = async (id: string, current: boolean) => {
    queryClient.setQueryData(["admin-brands"], (old: any[] | undefined) =>
      old?.map((b: any) => (b.id === id ? { ...b, is_active: !current } : b)),
    );
    try {
      const { error } = await supabase.from("brands").update({ is_active: !current }).eq("id", id);
      if (error) throw error;
      toast.success(!current ? "Marca visible" : "Marca oculta");
      queryClient.invalidateQueries({ queryKey: ["brands"] });
    } catch (err) {
      toast.error(errorToMessage(err));
      queryClient.invalidateQueries({ queryKey: ["admin-brands"] });
    }
  };

  const getBrandSlug = (b: any) => b.slug || slugify(b.name);

  const copyUrl = (b: any) => {
    navigator.clipboard.writeText(`https://surteya.com/hub/marca/${getBrandSlug(b)}`);
    toast.success("URL copiada");
  };

  const startEdit = (b: any) => {
    reset({
      name: b.name ?? "",
      slug: b.slug ?? "",
      logo_url: b.logo_url ?? "",
      website_url: b.website_url ?? "",
      sort_order: Number(b.sort_order || 0),
      is_active: !!b.is_active,
      meta_title: b.meta_title ?? "",
      meta_description: b.meta_description ?? "",
      og_image_url: b.og_image_url ?? "",
    });
    setEditing(b.id);
  };

  const activeCount = brands?.filter((b: any) => b.is_active).length || 0;
  const inactiveCount = (brands?.length || 0) - activeCount;

  const fieldCls = (hasError: boolean) =>
    `w-full bg-muted rounded-lg px-3 py-2.5 text-sm border focus:outline-none transition-colors ${
      hasError ? "border-destructive focus:border-destructive" : "border-transparent focus:border-accent"
    }`;

  const Err = ({ msg }: { msg?: string }) =>
    msg ? <p className="text-[11px] text-destructive font-medium">{msg}</p> : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-heading font-bold text-lg text-foreground">Marcas Aliadas ({brands?.length || 0})</h2>
          <p className="text-[11px] text-muted-foreground">
            <span className="text-accent">{activeCount} activas</span> · {inactiveCount} ocultas
          </p>
        </div>
        <button onClick={() => { reset(defaultValues); setEditing("new"); }} className="btn-surte text-xs px-3 py-2 flex items-center gap-1">
          <Plus size={14} /> Nueva
        </button>
      </div>

      {editing && (
        <form onSubmit={handleSubmit(onSubmit)} className="bg-card rounded-xl p-4 mb-4 space-y-3 border border-border" noValidate>
          <div className="flex justify-between items-center">
            <h3 className="font-heading font-semibold text-sm">{editing === "new" ? "Nueva Marca" : "Editar Marca"}</h3>
            <button type="button" onClick={resetForm}><X size={18} className="text-muted-foreground" /></button>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center overflow-hidden shrink-0 border-2 border-dashed border-border">
              {logoUrl ? (
                <img src={logoUrl} alt="Logo" className="w-full h-full object-contain p-1" />
              ) : (
                <ImageIcon size={24} className="text-muted-foreground/40" />
              )}
            </div>
            <div className="flex-1">
              <label className="flex items-center gap-2 cursor-pointer btn-surte text-xs px-3 py-2 w-fit">
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {uploading ? "Subiendo..." : "Subir logo"}
                <input type="file" accept="image/*" onChange={handleImg} className="hidden" disabled={uploading} />
              </label>
              <p className="text-[11px] text-muted-foreground mt-1">PNG transparente recomendado</p>
              <Err msg={errors.logo_url?.message} />
            </div>
          </div>

          <div>
            <input
              {...register("name", {
                onChange: (e) => {
                  // auto-slug si el slug está vacío o coincide con el slug previo del nombre
                  setValue("slug", slugify(e.target.value), { shouldValidate: true });
                },
              })}
              placeholder="Nombre de la marca *"
              aria-invalid={!!errors.name}
              className={fieldCls(!!errors.name)}
            />
            <Err msg={errors.name?.message} />
          </div>

          <div>
            <input {...register("slug")} placeholder="Slug (auto-generado)" aria-invalid={!!errors.slug} className={fieldCls(!!errors.slug)} />
            <Err msg={errors.slug?.message} />
          </div>

          <div>
            <input {...register("website_url")} placeholder="URL del sitio web (opcional)" aria-invalid={!!errors.website_url} className={fieldCls(!!errors.website_url)} />
            <Err msg={errors.website_url?.message} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <input
                {...register("sort_order", { valueAsNumber: true })}
                placeholder="Orden"
                type="number"
                aria-invalid={!!errors.sort_order}
                className={fieldCls(!!errors.sort_order)}
              />
              <Err msg={errors.sort_order?.message} />
            </div>
            <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2.5">
              <Switch checked={isActive} onCheckedChange={(v) => setValue("is_active", v, { shouldDirty: true })} />
              <span className="text-sm text-foreground">{isActive ? "Activa" : "Inactiva"}</span>
            </div>
          </div>

          {/* SEO */}
          <div className="border-t border-border pt-3 space-y-2">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">🔍 SEO Avanzado</p>
            <div>
              <input {...register("meta_title")} placeholder="Meta Título (ej: Productos La Unión)" aria-invalid={!!errors.meta_title} className={fieldCls(!!errors.meta_title)} />
              <Err msg={errors.meta_title?.message} />
            </div>
            <div>
              <textarea
                {...register("meta_description")}
                placeholder="Meta Descripción (máx. 160 caracteres)"
                rows={2}
                aria-invalid={!!errors.meta_description}
                className={`${fieldCls(!!errors.meta_description)} resize-none`}
              />
              <Err msg={errors.meta_description?.message} />
            </div>
            <div className="flex items-center gap-2">
              {ogImageUrl && <img src={ogImageUrl} alt="OG" className="w-16 h-10 object-cover rounded border border-border" />}
              <label className="flex items-center gap-1 cursor-pointer bg-accent/10 text-accent rounded-lg px-2.5 py-2 text-[11px] font-medium hover:bg-accent/20 transition-colors">
                {uploading ? <Loader2 size={12} className="animate-spin" /> : <ImageIcon size={12} />}
                {ogImageUrl ? "Cambiar imagen OG" : "Subir imagen OG"}
                <input type="file" accept="image/*" onChange={handleOgImage} className="hidden" disabled={uploading} />
              </label>
            </div>
            <Err msg={errors.og_image_url?.message} />
          </div>

          <div className="flex gap-2">
            <button type="submit" disabled={isSubmitting} className="btn-surte flex-1 text-sm py-2.5 flex items-center justify-center gap-1 disabled:opacity-60">
              {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar
            </button>
            <button type="button" onClick={resetForm} className="bg-muted rounded-xl px-4 py-2.5 text-sm text-muted-foreground font-medium hover:bg-muted/80 transition-colors">
              Cancelar
            </button>
          </div>
        </form>
      )}

      {brands?.length === 0 && !editing && (
        <div className="text-center py-12 bg-card rounded-xl border border-dashed border-border">
          <ImageIcon size={32} className="mx-auto text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground">No hay marcas aún</p>
          <p className="text-xs text-muted-foreground mt-1">Agrega marcas aliadas para mostrar en el inicio</p>
        </div>
      )}

      <SortableList
        items={brands || []}
        table="brands"
        queryKeys={["admin-brands", "brands"]}
        queryClient={queryClient}
        renderItem={(b) => (
          <div className={`flex items-center gap-3 bg-card rounded-xl p-3 border transition-all ${b.is_active ? "border-border" : "border-border opacity-50"}`}>
            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
              {b.logo_url ? (
                <img src={b.logo_url} alt={b.name} className="w-full h-full object-contain p-1" />
              ) : (
                <span className="text-sm font-bold text-muted-foreground/40">{b.name.substring(0, 2).toUpperCase()}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium text-foreground truncate">{b.name}</p>
                {!b.is_active && <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-medium">OCULTA</span>}
              </div>
              <p className="text-[11px] text-muted-foreground truncate">/hub/marca/{getBrandSlug(b)}</p>
            </div>
            <Switch checked={b.is_active} onCheckedChange={() => toggleActive(b.id, b.is_active)} />
            <button onClick={() => copyUrl(b)} className="text-muted-foreground hover:text-primary transition-colors" title="Copiar URL">
              <LinkIcon size={14} />
            </button>
            <a href={`/hub/marca/${getBrandSlug(b)}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors" title="Ver página">
              <ExternalLink size={14} />
            </a>
            <button onClick={() => startEdit(b)} className="text-muted-foreground hover:text-foreground transition-colors">
              <Pencil size={15} />
            </button>
            <button onClick={() => del(b.id)} className="text-muted-foreground hover:text-destructive transition-colors">
              <Trash2 size={15} />
            </button>
          </div>
        )}
      />
    </div>
  );
};

export default BrandsTab;
