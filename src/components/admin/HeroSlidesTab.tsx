import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useImageUpload } from "@/hooks/useImageUpload";
import { Plus, Trash2, Save, X, Upload, Loader2, Image as ImageIcon, Pencil, Globe, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import SortableList from "./SortableList";

const CITIES = ["", "Bucaramanga", "Floridablanca", "Girón", "Piedecuesta"];

const HeroSlidesTab = ({ queryClient }: { queryClient: any }) => {
  const { data: slides } = useQuery({
    queryKey: ["admin-hero-slides"],
    queryFn: async () => {
      const { data, error } = await supabase.from("hero_slides").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "", subtitle: "", image_url: "", image_mobile_url: "",
    cta_text: "Ver Catálogo", cta_link: "/catalogo", city: "", sort_order: "0",
  });
  const { upload, uploading } = useImageUpload();

  const handleImg = async (e: React.ChangeEvent<HTMLInputElement>, field: "image_url" | "image_mobile_url") => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await upload(file, "hero");
    if (url) setForm({ ...form, [field]: url });
  };

  const save = async () => {
    if (!form.title.trim()) { toast.error("El título es obligatorio"); return; }
    const payload: any = {
      title: form.title, subtitle: form.subtitle || null,
      image_url: form.image_url || null, image_mobile_url: form.image_mobile_url || null,
      cta_text: form.cta_text || null, cta_link: form.cta_link || "/catalogo",
      city: form.city || null, sort_order: Number(form.sort_order),
    };
    if (editing && editing !== "new") {
      const { error } = await supabase.from("hero_slides").update(payload).eq("id", editing);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from("hero_slides").insert(payload);
      if (error) { toast.error(error.message); return; }
    }
    toast.success("Slide guardado");
    queryClient.invalidateQueries({ queryKey: ["admin-hero-slides"] });
    queryClient.invalidateQueries({ queryKey: ["hero_slides"] });
    setEditing(null);
  };

  const del = async (id: string) => {
    if (!confirm("¿Eliminar slide?")) return;
    await supabase.from("hero_slides").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["admin-hero-slides"] });
    queryClient.invalidateQueries({ queryKey: ["hero_slides"] });
    toast.success("Eliminado");
  };

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from("hero_slides").update({ is_active: !current }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["admin-hero-slides"] });
    queryClient.invalidateQueries({ queryKey: ["hero_slides"] });
  };

  const startEdit = (s: any) => {
    setForm({
      title: s.title, subtitle: s.subtitle || "", image_url: s.image_url || "",
      image_mobile_url: s.image_mobile_url || "", cta_text: s.cta_text || "",
      cta_link: s.cta_link || "/catalogo", city: s.city || "", sort_order: String(s.sort_order || 0),
    });
    setEditing(s.id);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-heading font-semibold text-foreground">Hero Slides ({slides?.length || 0})</h3>
        <button
          onClick={() => {
            setForm({ title: "", subtitle: "", image_url: "", image_mobile_url: "", cta_text: "Ver Catálogo", cta_link: "/catalogo", city: "", sort_order: "0" });
            setEditing("new");
          }}
          className="btn-surte text-xs px-3 py-2 flex items-center gap-1"
        >
          <Plus size={14} /> Nuevo
        </button>
      </div>

      {editing && (
        <div className="bg-card rounded-xl p-4 mb-4 space-y-3 border border-border">
          <div className="flex justify-between">
            <span className="font-heading font-semibold text-sm">{editing === "new" ? "Nuevo" : "Editar"} Slide</span>
            <button onClick={() => setEditing(null)}><X size={18} className="text-muted-foreground" /></button>
          </div>

          {/* Desktop image */}
          <div>
            <label className="text-[10px] text-muted-foreground font-medium flex items-center gap-1 mb-1"><Globe size={10} /> Imagen Desktop (1920×600 recomendado)</label>
            <div className="flex items-center gap-3">
              <div className="w-24 h-14 rounded-lg bg-muted flex items-center justify-center overflow-hidden border-2 border-dashed border-border">
                {form.image_url ? <img src={form.image_url} className="w-full h-full object-cover" alt="" /> : <ImageIcon size={20} className="text-muted-foreground/40" />}
              </div>
              <label className="flex items-center gap-1 cursor-pointer btn-surte text-xs px-3 py-1.5">
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Subir
                <input type="file" accept="image/*" onChange={(e) => handleImg(e, "image_url")} className="hidden" disabled={uploading} />
              </label>
            </div>
          </div>

          {/* Mobile image */}
          <div>
            <label className="text-[10px] text-muted-foreground font-medium flex items-center gap-1 mb-1"><Smartphone size={10} /> Imagen Móvil (750×500 recomendado)</label>
            <div className="flex items-center gap-3">
              <div className="w-14 h-14 rounded-lg bg-muted flex items-center justify-center overflow-hidden border-2 border-dashed border-border">
                {form.image_mobile_url ? <img src={form.image_mobile_url} className="w-full h-full object-cover" alt="" /> : <Smartphone size={16} className="text-muted-foreground/40" />}
              </div>
              <label className="flex items-center gap-1 cursor-pointer btn-surte text-xs px-3 py-1.5">
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Subir
                <input type="file" accept="image/*" onChange={(e) => handleImg(e, "image_mobile_url")} className="hidden" disabled={uploading} />
              </label>
            </div>
          </div>

          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Título *" className="w-full bg-muted rounded-lg px-3 py-2 text-sm border border-transparent focus:border-accent focus:outline-none" />
          <input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} placeholder="Subtítulo" className="w-full bg-muted rounded-lg px-3 py-2 text-sm border border-transparent focus:border-accent focus:outline-none" />
          <div className="grid grid-cols-2 gap-2">
            <input value={form.cta_text} onChange={(e) => setForm({ ...form, cta_text: e.target.value })} placeholder="Texto botón" className="bg-muted rounded-lg px-3 py-2 text-sm border border-transparent focus:border-accent focus:outline-none" />
            <input value={form.cta_link} onChange={(e) => setForm({ ...form, cta_link: e.target.value })} placeholder="Link destino" className="bg-muted rounded-lg px-3 py-2 text-sm border border-transparent focus:border-accent focus:outline-none" />
          </div>
          <div>
            <label className="text-[10px] text-muted-foreground font-medium mb-1 block">Ciudad objetivo (vacío = todas)</label>
            <select value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} className="w-full bg-muted rounded-lg px-3 py-2 text-sm border border-transparent focus:border-accent focus:outline-none">
              {CITIES.map((c) => <option key={c} value={c}>{c || "🌐 Todas las ciudades"}</option>)}
            </select>
          </div>
          <button onClick={save} className="btn-surte w-full text-sm py-2 flex items-center justify-center gap-1"><Save size={14} /> Guardar</button>
        </div>
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
