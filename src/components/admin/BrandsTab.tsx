import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useImageUpload } from "@/hooks/useImageUpload";
import { Plus, Pencil, Trash2, Save, X, Upload, Loader2, Image as ImageIcon, ExternalLink, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import SortableList from "./SortableList";

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
  const [form, setForm] = useState({ name: "", logo_url: "", website_url: "", sort_order: "0", is_active: true, slug: "", meta_title: "", meta_description: "", og_image_url: "" });
  const { upload, uploading } = useImageUpload();

  const resetForm = () => {
    setForm({ name: "", logo_url: "", website_url: "", sort_order: "0", is_active: true, slug: "", meta_title: "", meta_description: "", og_image_url: "" });
    setEditing(null);
  };

  const handleImg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await upload(file, "brands");
    if (url) setForm({ ...form, logo_url: url });
  };

  const handleOgImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await upload(file, "seo-images");
    if (url) setForm({ ...form, og_image_url: url });
  };

  const save = async () => {
    if (!form.name) { toast.error("El nombre es obligatorio"); return; }
    const autoSlug = form.slug || form.name.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
    const payload: any = {
      name: form.name,
      logo_url: form.logo_url || null,
      website_url: form.website_url || null,
      sort_order: Number(form.sort_order),
      is_active: form.is_active,
      slug: autoSlug,
      meta_title: form.meta_title || null,
      meta_description: form.meta_description || null,
      og_image_url: form.og_image_url || null,
    };

    if (editing && editing !== "new") {
      const { error } = await supabase.from("brands").update(payload).eq("id", editing);
      if (error) { toast.error(error.message); return; }
      toast.success("Marca actualizada");
    } else {
      const { error } = await supabase.from("brands").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Marca creada");
    }
    queryClient.invalidateQueries({ queryKey: ["admin-brands"] });
    queryClient.invalidateQueries({ queryKey: ["brands"] });
    resetForm();
  };

  const del = async (id: string) => {
    if (!confirm("¿Eliminar esta marca?")) return;
    await supabase.from("brands").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["admin-brands"] });
    queryClient.invalidateQueries({ queryKey: ["brands"] });
    toast.success("Marca eliminada");
  };

  const toggleActive = async (id: string, current: boolean) => {
    queryClient.setQueryData(["admin-brands"], (old: any[] | undefined) =>
      old?.map((b: any) => b.id === id ? { ...b, is_active: !current } : b)
    );
    await supabase.from("brands").update({ is_active: !current }).eq("id", id);
    toast.success(!current ? "Marca visible" : "Marca oculta");
    queryClient.invalidateQueries({ queryKey: ["brands"] });
  };

  const getBrandSlug = (b: any) => b.slug || b.name.toLowerCase().replace(/\s+/g, "-");

  const copyUrl = (b: any) => {
    navigator.clipboard.writeText(`https://surteya.com/hub/marca/${getBrandSlug(b)}`);
    toast.success("URL copiada");
  };

  const activeCount = brands?.filter((b: any) => b.is_active).length || 0;
  const inactiveCount = (brands?.length || 0) - activeCount;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="font-heading font-bold text-lg text-foreground">Marcas Aliadas ({brands?.length || 0})</h2>
          <p className="text-[11px] text-muted-foreground">
            <span className="text-accent">{activeCount} activas</span> · {inactiveCount} ocultas
          </p>
        </div>
        <button onClick={() => { resetForm(); setEditing("new"); }} className="btn-surte text-xs px-3 py-2 flex items-center gap-1">
          <Plus size={14} /> Nueva
        </button>
      </div>

      {editing && (
        <div className="bg-card rounded-xl p-4 mb-4 space-y-3 border border-border">
          <div className="flex justify-between items-center">
            <h3 className="font-heading font-semibold text-sm">{editing === "new" ? "Nueva Marca" : "Editar Marca"}</h3>
            <button onClick={resetForm}><X size={18} className="text-muted-foreground" /></button>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center overflow-hidden shrink-0 border-2 border-dashed border-border">
              {form.logo_url ? (
                <img src={form.logo_url} alt="Logo" className="w-full h-full object-contain p-1" />
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
            </div>
          </div>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") })} placeholder="Nombre de la marca *" className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm border border-transparent focus:border-accent focus:outline-none transition-colors" />
          <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="Slug (auto-generado)" className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm border border-transparent focus:border-accent focus:outline-none transition-colors" />
          <input value={form.website_url} onChange={(e) => setForm({ ...form, website_url: e.target.value })} placeholder="URL del sitio web (opcional)" className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm border border-transparent focus:border-accent focus:outline-none transition-colors" />
          <div className="grid grid-cols-2 gap-2">
            <input value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} placeholder="Orden" type="number" className="bg-muted rounded-lg px-3 py-2.5 text-sm border border-transparent focus:border-accent focus:outline-none transition-colors" />
            <div className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2.5">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <span className="text-sm text-foreground">{form.is_active ? "Activa" : "Inactiva"}</span>
            </div>
          </div>

          {/* SEO Fields */}
          <div className="border-t border-border pt-3 space-y-2">
            <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">🔍 SEO Avanzado</p>
            <input value={form.meta_title} onChange={(e) => setForm({ ...form, meta_title: e.target.value })} placeholder="Meta Título (ej: Productos La Unión)" className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm border border-transparent focus:border-accent focus:outline-none transition-colors" />
            <textarea value={form.meta_description} onChange={(e) => setForm({ ...form, meta_description: e.target.value })} placeholder="Meta Descripción (máx. 160 caracteres)" rows={2} className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm border border-transparent focus:border-accent focus:outline-none transition-colors resize-none" />
            <div className="flex items-center gap-2">
              {form.og_image_url && <img src={form.og_image_url} alt="OG" className="w-16 h-10 object-cover rounded border border-border" />}
              <label className="flex items-center gap-1 cursor-pointer bg-accent/10 text-accent rounded-lg px-2.5 py-2 text-[11px] font-medium hover:bg-accent/20 transition-colors">
                {uploading ? <Loader2 size={12} className="animate-spin" /> : <ImageIcon size={12} />}
                {form.og_image_url ? "Cambiar imagen OG" : "Subir imagen OG"}
                <input type="file" accept="image/*" onChange={handleOgImage} className="hidden" disabled={uploading} />
              </label>
            </div>
          </div>

          <div className="flex gap-2">
            <button onClick={save} className="btn-surte flex-1 text-sm py-2.5 flex items-center justify-center gap-1">
              <Save size={14} /> Guardar
            </button>
            <button onClick={resetForm} className="bg-muted rounded-xl px-4 py-2.5 text-sm text-muted-foreground font-medium hover:bg-muted/80 transition-colors">
              Cancelar
            </button>
          </div>
        </div>
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
          <div className={`flex items-center gap-3 bg-card rounded-xl p-3 border transition-all ${b.is_active ? 'border-border' : 'border-border opacity-50'}`}>
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
            <button onClick={() => { setForm({ name: b.name, logo_url: b.logo_url || "", website_url: b.website_url || "", sort_order: String(b.sort_order || 0), is_active: b.is_active, slug: b.slug || "", meta_title: b.meta_title || "", meta_description: b.meta_description || "", og_image_url: b.og_image_url || "" }); setEditing(b.id); }} className="text-muted-foreground hover:text-foreground transition-colors">
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
