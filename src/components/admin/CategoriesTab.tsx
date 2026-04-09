import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, Save, X, Upload, Loader2, Image as ImageIcon, ExternalLink, Link as LinkIcon, Eye, EyeOff } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import SortableList from "./SortableList";
import CategoryIcon, { AVAILABLE_ICONS, isCustomSvgUrl } from "@/components/surte/CategoryIcon";
import { useImageUpload } from "@/hooks/useImageUpload";

const CategoriesTab = ({ categories, queryClient }: { categories: any[]; queryClient: any }) => {
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", slug: "", icon: "Package", sort_order: "0", color: "#5D7B50", meta_title: "", meta_description: "", og_image_url: "" });
  const { upload, uploading } = useImageUpload();

  const resetForm = () => { setForm({ name: "", slug: "", icon: "Package", sort_order: "0", color: "#5D7B50", meta_title: "", meta_description: "", og_image_url: "" }); setEditing(null); };

  const saveCategory = async () => {
    if (!form.name) { toast.error("El nombre es obligatorio"); return; }
    const payload: any = { name: form.name, slug: form.slug, icon: form.icon, sort_order: Number(form.sort_order), color: form.color, meta_title: form.meta_title || null, meta_description: form.meta_description || null, og_image_url: form.og_image_url || null };
    if (editing && editing !== "new") {
      const { error } = await supabase.from("categories").update(payload).eq("id", editing);
      if (error) { toast.error(error.message); return; }
      toast.success("Categoría actualizada");
    } else {
      const { error } = await supabase.from("categories").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Categoría creada");
    }
    queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
    queryClient.invalidateQueries({ queryKey: ["categories"] });
    resetForm();
  };

  const deleteCategory = async (id: string) => {
    if (!confirm("¿Eliminar esta categoría?")) return;
    await supabase.from("categories").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["admin-categories"] });
    toast.success("Categoría eliminada");
  };

  const toggleActive = async (id: string, current: boolean) => {
    queryClient.setQueryData(["admin-categories"], (old: any[] | undefined) =>
      old?.map((c: any) => c.id === id ? { ...c, is_active: !current } : c)
    );
    await supabase.from("categories").update({ is_active: !current }).eq("id", id);
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
      setForm({ ...form, icon: url });
      toast.success("Icono SVG subido");
    }
  };

  const handleOgImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await upload(file, "seo-images");
    if (url) {
      setForm({ ...form, og_image_url: url });
      toast.success("Imagen OG subida");
    }
  };

  const copyUrl = (slug: string) => {
    navigator.clipboard.writeText(`https://surteya.com/hub/categoria/${slug}`);
    toast.success("URL copiada");
  };

  const activeCount = categories?.filter((c: any) => c.is_active !== false).length || 0;
  const inactiveCount = (categories?.length || 0) - activeCount;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-heading font-bold text-lg text-foreground">Categorías ({categories?.length || 0})</h2>
          <p className="text-[11px] text-muted-foreground">
            <span className="text-accent">{activeCount} activas</span> · {inactiveCount} ocultas
          </p>
        </div>
        <button onClick={() => { resetForm(); setEditing("new"); }} className="btn-surte text-xs px-3 py-2 flex items-center gap-1"><Plus size={14} /> Nueva</button>
      </div>
      {editing && (
        <div className="bg-card rounded-xl p-4 mb-4 space-y-3 border border-border">
          <div className="flex justify-between items-center">
            <h3 className="font-heading font-semibold text-sm">{editing === "new" ? "Nueva Categoría" : "Editar"}</h3>
            <button onClick={resetForm}><X size={18} className="text-muted-foreground" /></button>
          </div>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") })} placeholder="Nombre *" className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm border border-transparent focus:border-accent focus:outline-none transition-colors" />
          <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="Slug" className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm border border-transparent focus:border-accent focus:outline-none transition-colors" />

          {/* Icon selector */}
          <div className="space-y-2">
            <label className="text-xs font-medium text-foreground">Icono (Lucide React)</label>
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center border border-border shrink-0">
                <CategoryIcon icon={form.icon} size={22} color={form.color} />
              </div>
              {isCustomSvgUrl(form.icon) ? (
                <span className="text-xs text-muted-foreground flex-1 truncate">SVG personalizado</span>
              ) : (
                <select
                  value={form.icon}
                  onChange={(e) => setForm({ ...form, icon: e.target.value })}
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
              {isCustomSvgUrl(form.icon) && (
                <button onClick={() => setForm({ ...form, icon: "Package" })} className="text-[10px] text-muted-foreground hover:text-destructive">
                  Reset
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <input value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} placeholder="Orden" type="number" className="bg-muted rounded-lg px-3 py-2.5 text-sm border border-transparent focus:border-accent focus:outline-none transition-colors" />
            <div className="flex items-center gap-2">
              <input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} type="color" className="bg-muted rounded-lg h-[42px] cursor-pointer w-14" />
              <span className="text-xs text-muted-foreground">{form.color}</span>
            </div>
          </div>

          {/* SEO Fields */}
          <div className="border-t border-border pt-3 space-y-2">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">🔍 SEO Avanzado</p>
            <input value={form.meta_title} onChange={(e) => setForm({ ...form, meta_title: e.target.value })} placeholder="Meta Título (ej: Salsas al por mayor)" className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm border border-transparent focus:border-accent focus:outline-none transition-colors" />
            <textarea value={form.meta_description} onChange={(e) => setForm({ ...form, meta_description: e.target.value })} placeholder="Meta Descripción (máx. 160 caracteres)" rows={2} className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm border border-transparent focus:border-accent focus:outline-none transition-colors resize-none" />
            <div className="flex items-center gap-2">
              {form.og_image_url && <img src={form.og_image_url} alt="OG" className="w-16 h-10 object-cover rounded border border-border" />}
              <label className="flex items-center gap-1 cursor-pointer bg-accent/10 text-accent rounded-lg px-2.5 py-2 text-[11px] font-medium hover:bg-accent/20 transition-colors">
                {uploading ? <Loader2 size={12} className="animate-spin" /> : <ImageIcon size={12} />}
                {form.og_image_url ? "Cambiar imagen OG" : "Subir imagen OG"}
                <input type="file" accept="image/*" onChange={handleOgImageUpload} className="hidden" disabled={uploading} />
              </label>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={saveCategory} className="btn-surte flex-1 text-sm py-2.5 flex items-center justify-center gap-1"><Save size={14} /> Guardar</button>
            <button onClick={resetForm} className="bg-muted rounded-xl px-4 py-2.5 text-sm text-muted-foreground font-medium hover:bg-muted/80 transition-colors">Cancelar</button>
          </div>
        </div>
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
            <button onClick={() => { setForm({ name: c.name, slug: c.slug, icon: c.icon || "Package", sort_order: String(c.sort_order || 0), color: c.color || "#5D7B50", meta_title: (c as any).meta_title || "", meta_description: (c as any).meta_description || "", og_image_url: (c as any).og_image_url || "" }); setEditing(c.id); }} className="text-muted-foreground hover:text-foreground transition-colors"><Pencil size={15} /></button>
            <button onClick={() => deleteCategory(c.id)} className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={15} /></button>
          </div>
        )}
      />
    </div>
  );
};

export default CategoriesTab;
