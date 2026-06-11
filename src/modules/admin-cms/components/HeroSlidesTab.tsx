import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useImageUpload } from "@/modules/admin-cms/hooks/useImageUpload";
import { Plus, Trash2, Save, X, Upload, Loader2, Image as ImageIcon, Pencil, Globe, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import SortableList from "./SortableList";
import { heroSlideSchema, type HeroSlideFormValues } from "@/lib/schemas";
import { errorToMessage } from "@/lib/errors";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import { scopedFrom } from "@/modules/tenant/lib/tenantScope";

const CITIES = ["", "Bucaramanga", "Floridablanca", "Girón", "Piedecuesta"];

const defaultValues: HeroSlideFormValues = {
  title: "",
  subtitle: "",
  image_url: "",
  image_mobile_url: "",
  cta_text: "Ver Catálogo",
  cta_link: "/catalogo",
  city: "",
  sort_order: 0,
};

const HeroSlidesTab = ({ queryClient }: { queryClient: any }) => {
  const { currentOrg } = useOrganization();
  const { data: slides } = useQuery({
    queryKey: ["admin-hero-slides", currentOrg?.id],
    enabled: !!currentOrg?.id,
    queryFn: async () => {
      const { data, error } = await scopedFrom("hero_slides", currentOrg!.id).order("sort_order");
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
  } = useForm<HeroSlideFormValues>({
    resolver: zodResolver(heroSlideSchema),
    defaultValues,
    mode: "onBlur",
  });

  const imageUrl = watch("image_url");
  const imageMobileUrl = watch("image_mobile_url");
  const city = watch("city");

  const handleImg = async (e: React.ChangeEvent<HTMLInputElement>, field: "image_url" | "image_mobile_url") => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await upload(file, "hero");
    if (url) setValue(field, url, { shouldDirty: true, shouldValidate: true });
  };

  const onSubmit = async (values: HeroSlideFormValues) => {
    const payload = {
      title: values.title.trim(),
      subtitle: values.subtitle || null,
      image_url: values.image_url || null,
      image_mobile_url: values.image_mobile_url || null,
      cta_text: values.cta_text || null,
      cta_link: values.cta_link || "/catalogo",
      city: values.city || null,
      sort_order: values.sort_order,
    };
    try {
      if (editing && editing !== "new") {
        const { error } = await supabase.from("hero_slides").update(payload).eq("id", editing);
        if (error) throw error;
      } else {
        if (!currentOrg?.id) { toast.error("Selecciona una organización"); return; }
        const { error } = await supabase.from("hero_slides").insert({ ...payload, organization_id: currentOrg.id });
        if (error) throw error;
      }
      toast.success("Slide guardado");
      queryClient.invalidateQueries({ queryKey: ["admin-hero-slides"] });
      queryClient.invalidateQueries({ queryKey: ["hero_slides"] });
      setEditing(null);
      reset(defaultValues);
    } catch (err) {
      toast.error(errorToMessage(err));
    }
  };

  const del = async (id: string) => {
    if (!confirm("¿Eliminar slide?")) return;
    try {
      const { error } = await supabase.from("hero_slides").delete().eq("id", id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["admin-hero-slides"] });
      queryClient.invalidateQueries({ queryKey: ["hero_slides"] });
      toast.success("Eliminado");
    } catch (err) {
      toast.error(errorToMessage(err));
    }
  };

  const toggleActive = async (id: string, current: boolean) => {
    try {
      const { error } = await supabase.from("hero_slides").update({ is_active: !current }).eq("id", id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["admin-hero-slides"] });
      queryClient.invalidateQueries({ queryKey: ["hero_slides"] });
    } catch (err) {
      toast.error(errorToMessage(err));
    }
  };

  const startEdit = (s: any) => {
    reset({
      title: s.title ?? "",
      subtitle: s.subtitle ?? "",
      image_url: s.image_url ?? "",
      image_mobile_url: s.image_mobile_url ?? "",
      cta_text: s.cta_text ?? "",
      cta_link: s.cta_link ?? "/catalogo",
      city: s.city ?? "",
      sort_order: Number(s.sort_order || 0),
    });
    setEditing(s.id);
  };

  const fieldCls = (hasError: boolean) =>
    `w-full bg-muted rounded-lg px-3 py-2 text-sm border focus:outline-none ${
      hasError ? "border-destructive" : "border-transparent focus:border-accent"
    }`;

  const Err = ({ msg }: { msg?: string }) =>
    msg ? <p className="text-[11px] text-destructive font-medium mt-0.5">{msg}</p> : null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-heading font-semibold text-foreground">Hero Slides ({slides?.length || 0})</h3>
        <button
          onClick={() => { reset(defaultValues); setEditing("new"); }}
          className="btn-surte text-xs px-3 py-2 flex items-center gap-1"
        >
          <Plus size={14} /> Nuevo
        </button>
      </div>

      {editing && (
        <form onSubmit={handleSubmit(onSubmit)} className="bg-card rounded-xl p-4 mb-4 space-y-3 border border-border" noValidate>
          <div className="flex justify-between">
            <span className="font-heading font-semibold text-sm">{editing === "new" ? "Nuevo" : "Editar"} Slide</span>
            <button type="button" onClick={() => { setEditing(null); reset(defaultValues); }}><X size={18} className="text-muted-foreground" /></button>
          </div>

          {/* Desktop image */}
          <div>
            <label className="text-[10px] text-muted-foreground font-medium flex items-center gap-1 mb-1"><Globe size={10} /> Imagen Desktop (1920×600 recomendado)</label>
            <div className="flex items-center gap-3">
              <div className="w-24 h-14 rounded-lg bg-muted flex items-center justify-center overflow-hidden border-2 border-dashed border-border">
                {imageUrl ? <img src={imageUrl} className="w-full h-full object-cover" alt="" /> : <ImageIcon size={20} className="text-muted-foreground/40" />}
              </div>
              <label className="flex items-center gap-1 cursor-pointer btn-surte text-xs px-3 py-1.5">
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Subir
                <input type="file" accept="image/*" onChange={(e) => handleImg(e, "image_url")} className="hidden" disabled={uploading} />
              </label>
            </div>
            <Err msg={errors.image_url?.message} />
          </div>

          {/* Mobile image */}
          <div>
            <label className="text-[10px] text-muted-foreground font-medium flex items-center gap-1 mb-1"><Smartphone size={10} /> Imagen Móvil (750×500 recomendado)</label>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center overflow-hidden border-2 border-dashed border-border">
                {imageMobileUrl ? <img src={imageMobileUrl} className="w-full h-full object-cover" alt="" /> : <Smartphone size={16} className="text-muted-foreground/40" />}
              </div>
              <label className="flex items-center gap-1 cursor-pointer btn-surte text-xs px-3 py-1.5">
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Subir
                <input type="file" accept="image/*" onChange={(e) => handleImg(e, "image_mobile_url")} className="hidden" disabled={uploading} />
              </label>
            </div>
            <Err msg={errors.image_mobile_url?.message} />
          </div>

          <div>
            <input {...register("title")} placeholder="Título *" aria-invalid={!!errors.title} className={fieldCls(!!errors.title)} />
            <Err msg={errors.title?.message} />
          </div>
          <div>
            <input {...register("subtitle")} placeholder="Subtítulo" aria-invalid={!!errors.subtitle} className={fieldCls(!!errors.subtitle)} />
            <Err msg={errors.subtitle?.message} />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <input {...register("cta_text")} placeholder="Texto botón" aria-invalid={!!errors.cta_text} className={fieldCls(!!errors.cta_text)} />
              <Err msg={errors.cta_text?.message} />
            </div>
            <div>
              <input {...register("cta_link")} placeholder="Link destino" aria-invalid={!!errors.cta_link} className={fieldCls(!!errors.cta_link)} />
              <Err msg={errors.cta_link?.message} />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-muted-foreground font-medium mb-1 block">Ciudad objetivo (vacío = todas)</label>
            <select
              value={city ?? ""}
              onChange={(e) => setValue("city", e.target.value, { shouldDirty: true })}
              className="w-full bg-muted rounded-lg px-3 py-2 text-sm border border-transparent focus:border-accent focus:outline-none"
            >
              {CITIES.map((c) => <option key={c} value={c}>{c || "🌐 Todas las ciudades"}</option>)}
            </select>
          </div>

          <div>
            <input
              {...register("sort_order", { valueAsNumber: true })}
              type="number"
              placeholder="Orden"
              aria-invalid={!!errors.sort_order}
              className={fieldCls(!!errors.sort_order)}
            />
            <Err msg={errors.sort_order?.message} />
          </div>

          <button type="submit" disabled={isSubmitting} className="btn-surte w-full text-sm py-2 flex items-center justify-center gap-1 disabled:opacity-60">
            {isSubmitting ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} Guardar
          </button>
        </form>
      )}

      <SortableList
        items={slides || []}
        table="hero_slides"
        queryKeys={["admin-hero-slides", "hero_slides"]}
        queryClient={queryClient}
        renderItem={(s: any) => (
          <div className={`flex items-center gap-3 bg-card rounded-xl p-3 border transition-colors ${s.is_active ? "border-border" : "border-border opacity-50"}`}>
            <div className="w-16 h-10 rounded-lg bg-muted overflow-hidden shrink-0">
              {s.image_url ? <img src={s.image_url} className="w-full h-full object-cover" alt="" /> : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={16} className="text-muted-foreground/40" /></div>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{s.title}</p>
              <p className="text-[10px] text-muted-foreground">{s.city ? `📍 ${s.city}` : "🌐 Global"}</p>
            </div>
            <Switch checked={s.is_active} onCheckedChange={() => toggleActive(s.id, s.is_active)} />
            <button onClick={() => startEdit(s)} className="text-muted-foreground hover:text-foreground transition-colors"><Pencil size={15} /></button>
            <button onClick={() => del(s.id)} className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={15} /></button>
          </div>
        )}
      />
    </div>
  );
};

export default HeroSlidesTab;
