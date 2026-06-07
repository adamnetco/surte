import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, Save, X, Upload, Loader2, Image as ImageIcon, ExternalLink, Link as LinkIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import SortableList from "./SortableList";
import CategoryIcon, { AVAILABLE_ICONS, isCustomSvgUrl } from "@/modules/storefront/components/CategoryIcon";
import { useImageUpload } from "@/hooks/useImageUpload";
import { categorySchema, type CategoryFormValues } from "@/lib/schemas";
import { errorToMessage } from "@/lib/errors";

const DEFAULTS: CategoryFormValues = {
  name: "",
  slug: "",
  icon: "Package",
  sort_order: 0,
  color: "#5D7B50",
  meta_title: "",
  meta_description: "",
  og_image_url: "",
};

const CategoriesTab = ({ categories, queryClient }: { categories: any[]; queryClient: any }) => {
  const [editing, setEditing] = useState<string | null>(null);
  const { upload, uploading } = useImageUpload();

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categorySchema),
    defaultValues: DEFAULTS,
    mode: "onBlur",
  });

  const icon = watch("icon");
  const color = watch("color") || "#5D7B50";
  const ogImage = watch("og_image_url");

  const resetForm = () => {
    reset(DEFAULTS);
    setEditing(null);
  };

  const onSubmit = handleSubmit(async (values) => {
    const payload: any = {
      name: values.name,
      slug: values.slug,
      icon: values.icon,
      sort_order: values.sort_order,
      color: values.color || null,
      meta_title: values.meta_title || null,
      meta_description: values.meta_description || null,
      og_image_url: values.og_image_url || null,
    };

    try {
      if (editing && editing !== "new") {
        const { error } = await supabase.from("categories").update(payload).eq("id", editing);
        if (error) throw error;
        toast.success("Categoría actualizada");
      } else {
        const { error } = await supabase.from("categories").insert(payload);
        if (error) throw error;
        toast.success("Categoría creada");
      }
      queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
      queryClient.invalidateQueries({ queryKey: ["categories"] });
      resetForm();
    } catch (e) {
      toast.error(errorToMessage(e));
    }
  });

  const deleteCategory = async (id: string) => {
    if (!confirm("¿Eliminar esta categoría?")) return;
    const { error } = await supabase.from("categories").delete().eq("id", id);
    if (error) return toast.error(errorToMessage(error));
    queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
    toast.success("Categoría eliminada");
  };

  const toggleActive = async (id: string, current: boolean) => {
    queryClient.setQueryData(["admin-categories"], (old: any[] | undefined) =>
      old?.map((c: any) => (c.id === id ? { ...c, is_active: !current } : c))
    );
    const { error } = await supabase.from("categories").update({ is_active: !current }).eq("id", id);
    if (error) return toast.error(errorToMessage(error));
    toast.success(!current ? "Categoría visible" : "Categoría oculta");
    queryClient.invalidateQueries({ queryKey: ["categories"] });
  };

  const handleSvgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.includes("svg") && !file.name.endsWith(".svg")) {
      toast.error("Solo se permiten archivos SVG");
      return;
    }
    const url = await upload(file, "category-icons");
    if (url) {
      setValue("icon", url, { shouldValidate: true });
      toast.success("Icono SVG subido");
    }
  };

  const handleOgImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await upload(file, "seo-images");
    if (url) {
      setValue("og_image_url", url, { shouldValidate: true });
      toast.success("Imagen OG subida");
    }
  };

  const copyUrl = (slug: string) => {
    navigator.clipboard.writeText(`https://surteya.com/hub/categoria/${slug}`);
    toast.success("URL copiada");
  };

  const startEdit = (c: any) => {
    reset({
      name: c.name ?? "",
      slug: c.slug ?? "",
      icon: c.icon || "Package",
      sort_order: Number(c.sort_order ?? 0),
      color: c.color || "#5D7B50",
      meta_title: c.meta_title || "",
      meta_description: c.meta_description || "",
      og_image_url: c.og_image_url || "",
    });
    setEditing(c.id);
  };

  // Auto-deriva slug del name si el usuario no lo ha tocado manualmente.
  const nameVal = watch("name");
  useEffect(() => {
    if (!editing || editing !== "new") return;
    if (!nameVal) return;
    const current = watch("slug");
    // Solo autocompleta si el slug está vacío (no pisa cambios manuales).
    if (!current) {
      const auto = nameVal
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "");
      setValue("slug", auto, { shouldValidate: false });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nameVal, editing]);

  const activeCount = categories?.filter((c: any) => c.is_active !== false).length || 0;
  const inactiveCount = (categories?.length || 0) - activeCount;

  const errClass = (field: keyof CategoryFormValues) =>
    errors[field] ? "border-destructive" : "border-transparent";

  const FieldError = ({ name }: { name: keyof CategoryFormValues }) =>
    errors[name] ? (
      <p role="alert" className="text-[11px] text-destructive mt-1">
        {errors[name]?.message as string}
      </p>
    ) : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-heading font-bold text-lg text-foreground">Categorías ({categories?.length || 0})</h2>
          <p className="text-[11px] text-muted-foreground">
            <span className="text-accent">{activeCount} activas</span> · {inactiveCount} ocultas
          </p>
        </div>
        <button
          onClick={() => { reset(DEFAULTS); setEditing("new"); }}
          className="btn-surte text-xs px-3 py-2 flex items-center gap-1"
        >
          <Plus size={14} /> Nueva
        </button>
      </div>

      {editing && (
        <form onSubmit={onSubmit} noValidate className="bg-card rounded-xl p-4 mb-4 space-y-3 border border-border">
          <div className="flex justify-between items-center">
            <h3 className="font-heading font-semibold text-sm">{editing === "new" ? "Nueva Categoría" : "Editar"}</h3>
            <button type="button" onClick={resetForm} aria-label="Cerrar">
              <X size={18} className="text-muted-foreground" />
            </button>
          </div>

          <div>
            <input
              {...register("name")}
              placeholder="Nombre *"
              aria-invalid={!!errors.name}
              className={`w-full bg-muted rounded-lg px-3 py-2.5 text-sm border focus:border-accent focus:outline-none transition-colors ${errClass("name")}`}
            />
            <FieldError name="name" />
          </div>

          <div>
            <input
              {...register("slug")}
              placeholder="Slug (URL)"
              aria-invalid={!!errors.slug}
              className={`w-full bg-muted rounded-lg px-3 py-2.5 text-sm border focus:border-accent focus:outline-none transition-colors ${errClass("slug")}`}
            />
            <FieldError name="slug" />
          </div>

          {/* Icon selector */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground">Icono</label>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center border border-border shrink-0">
                <CategoryIcon icon={icon} size={22} color={color} />
              </div>
              {isCustomSvgUrl(icon) ? (
                <span className="text-xs text-muted-foreground flex-1 truncate">SVG personalizado</span>
              ) : (
                <select
                  {...register("icon")}
                  className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm border border-transparent focus:border-accent focus:outline-none"
                >
                  {AVAILABLE_ICONS.map((name) => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              )}
              <label className="flex items-center gap-1 cursor-pointer bg-accent/10 text-accent rounded-lg px-2.5 py-2 text-[11px] font-medium hover:bg-accent/20 transition-colors shrink-0">
                {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                SVG
                <input type="file" accept=".svg,image/svg+xml" onChange={handleSvgUpload} className="hidden" disabled={uploading} />
              </label>
              {isCustomSvgUrl(icon) && (
                <button
                  type="button"
                  onClick={() => setValue("icon", "Package", { shouldValidate: true })}
                  className="text-[10px] text-muted-foreground hover:text-destructive"
                >
                  Reset
                </button>
              )}
            </div>
            <FieldError name="icon" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <input
                {...register("sort_order")}
                placeholder="Orden"
                type="number"
                aria-invalid={!!errors.sort_order}
                className={`w-full bg-muted rounded-lg px-3 py-2.5 text-sm border focus:border-accent focus:outline-none transition-colors ${errClass("sort_order")}`}
              />
              <FieldError name="sort_order" />
            </div>
            <div className="flex items-center gap-2">
              <input
                {...register("color")}
                type="color"
                className="bg-muted rounded-lg h-[42px] cursor-pointer w-14"
              />
              <span className="text-xs text-muted-foreground">{color}</span>
            </div>
          </div>
          <FieldError name="color" />

          {/* SEO Fields */}
          <div className="border-t border-border pt-3 space-y-2">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">SEO Avanzado</p>
            <div>
              <input
                {...register("meta_title")}
                placeholder="Meta Título (máx. 60)"
                className={`w-full bg-muted rounded-lg px-3 py-2.5 text-sm border focus:border-accent focus:outline-none transition-colors ${errClass("meta_title")}`}
              />
              <FieldError name="meta_title" />
            </div>
            <div>
              <textarea
                {...register("meta_description")}
                placeholder="Meta Descripción (máx. 160)"
                rows={2}
                className={`w-full bg-muted rounded-lg px-3 py-2.5 text-sm border focus:border-accent focus:outline-none transition-colors resize-none ${errClass("meta_description")}`}
              />
              <FieldError name="meta_description" />
            </div>
            <div className="flex items-center gap-2">
              {ogImage && <img src={ogImage} alt="OG" className="w-16 h-10 object-cover rounded border border-border" />}
              <label className="flex items-center gap-1 cursor-pointer bg-accent/10 text-accent rounded-lg px-2.5 py-2 text-[11px] font-medium hover:bg-accent/20 transition-colors">
                {uploading ? <Loader2 size={12} className="animate-spin" /> : <ImageIcon size={12} />}
                {ogImage ? "Cambiar imagen OG" : "Subir imagen OG"}
                <input type="file" accept="image/*" onChange={handleOgImageUpload} className="hidden" disabled={uploading} />
              </label>
            </div>
            <FieldError name="og_image_url" />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-surte flex-1 text-sm py-2.5 flex items-center justify-center gap-1 disabled:opacity-60"
            >
              {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Guardar
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="bg-muted rounded-xl px-4 py-2.5 text-sm text-muted-foreground font-medium hover:bg-muted/80 transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      <SortableList
        items={categories || []}
        table="categories"
        queryKeys={["admin-categories", "categories"]}
        queryClient={queryClient}
        renderItem={(c) => (
          <div className={`flex items-center gap-3 bg-card rounded-xl p-3 border transition-all ${c.is_active ? "border-border" : "border-border opacity-50"}`}>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${c.color || '#ccc'}18` }}>
              <CategoryIcon icon={c.icon} size={20} color={c.color || undefined} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium text-foreground">{c.name}</p>
                {!c.is_active && <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-medium">OCULTA</span>}
              </div>
              <p className="text-[11px] text-muted-foreground">/{c.slug}</p>
            </div>
            <Switch checked={c.is_active} onCheckedChange={() => toggleActive(c.id, c.is_active)} />
            <button onClick={() => copyUrl(c.slug)} className="text-muted-foreground hover:text-primary transition-colors" title="Copiar URL">
              <LinkIcon size={14} />
            </button>
            <a href={`/hub/categoria/${c.slug}`} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors" title="Ver página">
              <ExternalLink size={14} />
            </a>
            <button onClick={() => startEdit(c)} className="text-muted-foreground hover:text-foreground transition-colors">
              <Pencil size={15} />
            </button>
            <button onClick={() => deleteCategory(c.id)} className="text-muted-foreground hover:text-destructive transition-colors">
              <Trash2 size={15} />
            </button>
          </div>
        )}
      />
    </div>
  );
};

export default CategoriesTab;
