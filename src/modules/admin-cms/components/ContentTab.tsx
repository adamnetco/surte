import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useImageUpload } from "@/modules/admin-cms/hooks/useImageUpload";
import { Plus, Trash2, Save, X, Upload, Loader2, Image as ImageIcon, Star, MessageSquareQuote, Pencil } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import SortableList from "./SortableList";

const ContentTab = ({ queryClient }: { queryClient: any }) => {
  const [section, setSection] = useState<"banners" | "testimonials" | "gallery">("banners");

  return (
    <div>
      <div className="flex gap-2 mb-4 overflow-x-auto scrollbar-hide">
        {(["banners", "testimonials", "gallery"] as const).map((s) => (
          <button key={s} onClick={() => setSection(s)}
            className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${section === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            {s === "banners" ? "🖼 Banners" : s === "testimonials" ? "💬 Testimonios" : "📸 Galería"}
          </button>
        ))}
      </div>
      {section === "banners" && <BannersSection queryClient={queryClient} />}
      {section === "testimonials" && <TestimonialsSection queryClient={queryClient} />}
      {section === "gallery" && <GallerySection queryClient={queryClient} />}
    </div>
  );
};

const BannersSection = ({ queryClient }: { queryClient: any }) => {
  const { data: banners } = useQuery({
    queryKey: ["admin-banners"],
    queryFn: async () => {
      const { data, error } = await supabase.from("banners").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
  });
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ title: "", subtitle: "", image_url: "", cta_text: "Ver más", cta_link: "/catalogo", sort_order: "0" });
  const { upload, uploading } = useImageUpload();

  const handleImg = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await upload(file, "banners");
    if (url) setForm({ ...form, image_url: url });
  };

  const save = async () => {
    const payload = { title: form.title, subtitle: form.subtitle, image_url: form.image_url || null, cta_text: form.cta_text, cta_link: form.cta_link, sort_order: Number(form.sort_order) };
    if (editing && editing !== "new") {
      const { error } = await supabase.from("banners").update(payload).eq("id", editing);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from("banners").insert(payload);
      if (error) { toast.error(error.message); return; }
    }
    toast.success("Banner guardado");
    queryClient.invalidateQueries({ queryKey: ["admin-banners"] });
    queryClient.invalidateQueries({ queryKey: ["banners"] });
    setEditing(null);
  };

  const del = async (id: string) => {
    if (!confirm("¿Eliminar?")) return;
    await supabase.from("banners").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["admin-banners"] });
    toast.success("Banner eliminado");
  };

  const toggleActive = async (id: string, current: boolean) => {
    await supabase.from("banners").update({ is_active: !current }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["admin-banners"] });
    queryClient.invalidateQueries({ queryKey: ["banners"] });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-heading font-semibold text-foreground">Banners ({banners?.length || 0})</h3>
        <button onClick={() => { setForm({ title: "", subtitle: "", image_url: "", cta_text: "Ver más", cta_link: "/catalogo", sort_order: "0" }); setEditing("new"); }} className="btn-surte text-xs px-3 py-2 flex items-center gap-1"><Plus size={14} /> Nuevo</button>
      </div>
      {editing && (
        <div className="bg-card rounded-xl p-4 mb-4 space-y-3 border border-border">
          <div className="flex justify-between"><span className="font-heading font-semibold text-sm">{editing === "new" ? "Nuevo" : "Editar"} Banner</span><button onClick={() => setEditing(null)}><X size={18} className="text-muted-foreground" /></button></div>
          <div className="flex items-center gap-3">
            <div className="w-20 h-12 rounded-lg bg-muted flex items-center justify-center overflow-hidden border-2 border-dashed border-border">
              {form.image_url ? <img src={form.image_url} className="w-full h-full object-cover" /> : <ImageIcon size={20} className="text-muted-foreground/40" />}
            </div>
            <label className="flex items-center gap-1 cursor-pointer btn-surte text-xs px-3 py-1.5">
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Imagen
              <input type="file" accept="image/*" onChange={handleImg} className="hidden" disabled={uploading} />
            </label>
          </div>
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Título *" className="w-full bg-muted rounded-lg px-3 py-2 text-sm border border-transparent focus:border-accent focus:outline-none transition-colors" />
          <input value={form.subtitle} onChange={(e) => setForm({ ...form, subtitle: e.target.value })} placeholder="Subtítulo" className="w-full bg-muted rounded-lg px-3 py-2 text-sm border border-transparent focus:border-accent focus:outline-none transition-colors" />
          <div className="grid grid-cols-2 gap-2">
            <input value={form.cta_text} onChange={(e) => setForm({ ...form, cta_text: e.target.value })} placeholder="Texto botón" className="bg-muted rounded-lg px-3 py-2 text-sm border border-transparent focus:border-accent focus:outline-none transition-colors" />
            <input value={form.cta_link} onChange={(e) => setForm({ ...form, cta_link: e.target.value })} placeholder="Link" className="bg-muted rounded-lg px-3 py-2 text-sm border border-transparent focus:border-accent focus:outline-none transition-colors" />
          </div>
          <button onClick={save} className="btn-surte w-full text-sm py-2 flex items-center justify-center gap-1"><Save size={14} /> Guardar</button>
        </div>
      )}

      <SortableList
        items={banners || []}
        table="banners"
        queryKeys={["admin-banners", "banners"]}
        queryClient={queryClient}
        renderItem={(b) => (
          <div className={`flex items-center gap-3 bg-card rounded-xl p-3 border transition-colors ${b.is_active !== false ? 'border-border' : 'border-border opacity-50'}`}>
            <div className="w-16 h-10 rounded-lg bg-muted overflow-hidden shrink-0">
              {b.image_url ? <img src={b.image_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><ImageIcon size={16} className="text-muted-foreground/40" /></div>}
            </div>
            <div className="flex-1 min-w-0"><p className="text-sm font-medium text-foreground truncate">{b.title}</p><p className="text-xs text-muted-foreground truncate">{b.subtitle}</p></div>
            <Switch checked={b.is_active !== false} onCheckedChange={() => toggleActive(b.id, b.is_active !== false)} />
            <button onClick={() => { setForm({ title: b.title, subtitle: b.subtitle || "", image_url: b.image_url || "", cta_text: b.cta_text || "", cta_link: b.cta_link || "", sort_order: String(b.sort_order || 0) }); setEditing(b.id); }} className="text-muted-foreground hover:text-foreground transition-colors"><Pencil size={15} /></button>
            <button onClick={() => del(b.id)} className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={15} /></button>
          </div>
        )}
      />
    </div>
  );
};

const TestimonialsSection = ({ queryClient }: { queryClient: any }) => {
  const { data: testimonials } = useQuery({
    queryKey: ["admin-testimonials"],
    queryFn: async () => {
      const { data, error } = await supabase.from("testimonials").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
  });
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ customer_name: "", customer_city: "", content: "", rating: "5" });

  const save = async () => {
    const payload = { customer_name: form.customer_name, customer_city: form.customer_city, content: form.content, rating: Number(form.rating) };
    if (editing && editing !== "new") {
      const { error } = await supabase.from("testimonials").update(payload).eq("id", editing);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.from("testimonials").insert(payload);
      if (error) { toast.error(error.message); return; }
    }
    toast.success("Testimonio guardado");
    queryClient.invalidateQueries({ queryKey: ["admin-testimonials"] });
    queryClient.invalidateQueries({ queryKey: ["testimonials"] });
    setEditing(null);
  };

  const del = async (id: string) => {
    if (!confirm("¿Eliminar?")) return;
    await supabase.from("testimonials").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["admin-testimonials"] });
    toast.success("Eliminado");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-heading font-semibold text-foreground">Testimonios ({testimonials?.length || 0})</h3>
        <button onClick={() => { setForm({ customer_name: "", customer_city: "", content: "", rating: "5" }); setEditing("new"); }} className="btn-surte text-xs px-3 py-2 flex items-center gap-1"><Plus size={14} /> Nuevo</button>
      </div>
      {editing && (
        <div className="bg-card rounded-xl p-4 mb-4 space-y-3 border border-border">
          <div className="flex justify-between"><span className="font-heading font-semibold text-sm">{editing === "new" ? "Nuevo" : "Editar"}</span><button onClick={() => setEditing(null)}><X size={18} className="text-muted-foreground" /></button></div>
          <input value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} placeholder="Nombre del cliente *" className="w-full bg-muted rounded-lg px-3 py-2 text-sm border border-transparent focus:border-accent focus:outline-none transition-colors" />
          <input value={form.customer_city} onChange={(e) => setForm({ ...form, customer_city: e.target.value })} placeholder="Ciudad" className="w-full bg-muted rounded-lg px-3 py-2 text-sm border border-transparent focus:border-accent focus:outline-none transition-colors" />
          <textarea value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} placeholder="Testimonio *" className="w-full bg-muted rounded-lg px-3 py-2 text-sm border border-transparent focus:border-accent focus:outline-none transition-colors" rows={3} />
          <select value={form.rating} onChange={(e) => setForm({ ...form, rating: e.target.value })} className="w-full bg-muted rounded-lg px-3 py-2 text-sm border border-transparent focus:border-accent focus:outline-none transition-colors">
            {[5, 4, 3, 2, 1].map((r) => <option key={r} value={r}>{"⭐".repeat(r)} ({r})</option>)}
          </select>
          <button onClick={save} className="btn-surte w-full text-sm py-2 flex items-center justify-center gap-1"><Save size={14} /> Guardar</button>
        </div>
      )}
      <div className="space-y-2">
        {testimonials?.map((t: any) => (
          <div key={t.id} className="bg-card rounded-xl p-3 flex items-start gap-3 border border-border">
            <MessageSquareQuote size={20} className="text-accent shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{t.customer_name}</p>
              <p className="text-xs text-muted-foreground">{t.customer_city} · {"⭐".repeat(t.rating)}</p>
              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.content}</p>
            </div>
            <button onClick={() => { setForm({ customer_name: t.customer_name, customer_city: t.customer_city || "", content: t.content, rating: String(t.rating) }); setEditing(t.id); }} className="text-muted-foreground hover:text-foreground transition-colors"><Pencil size={14} /></button>
            <button onClick={() => del(t.id)} className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
    </div>
  );
};

const GallerySection = ({ queryClient }: { queryClient: any }) => {
  const { data: gallery } = useQuery({
    queryKey: ["admin-gallery"],
    queryFn: async () => {
      const { data, error } = await supabase.from("gallery").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
  });
  const { upload, uploading } = useImageUpload();
  const [editingCaption, setEditingCaption] = useState<string | null>(null);
  const [captionText, setCaptionText] = useState("");

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    let successCount = 0;
    for (const file of Array.from(files)) {
      const url = await upload(file, "gallery");
      if (url) {
        const { error } = await supabase.from("gallery").insert({ image_url: url, caption: "", is_active: true, sort_order: (gallery?.length || 0) + successCount });
        if (error) {
          console.error("Gallery insert error:", error);
          toast.error(`Error guardando ${file.name}: ${error.message}`);
        } else {
          successCount++;
        }
      }
    }
    if (successCount > 0) {
      queryClient.invalidateQueries({ queryKey: ["admin-gallery"] });
      queryClient.invalidateQueries({ queryKey: ["gallery"] });
      toast.success(`${successCount} imagen(es) subida(s)`);
    }
  };

  const saveCaption = async (id: string) => {
    await supabase.from("gallery").update({ caption: captionText }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["admin-gallery"] });
    queryClient.invalidateQueries({ queryKey: ["gallery"] });
    setEditingCaption(null);
    toast.success("Descripción actualizada");
  };

  const del = async (id: string) => {
    if (!confirm("¿Eliminar imagen?")) return;
    await supabase.from("gallery").delete().eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["admin-gallery"] });
    queryClient.invalidateQueries({ queryKey: ["gallery"] });
    toast.success("Eliminada");
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-heading font-semibold text-foreground">Galería ({gallery?.length || 0})</h3>
        <label className="btn-surte text-xs px-3 py-2 flex items-center gap-1 cursor-pointer">
          {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />} Subir
          <input type="file" accept="image/*" multiple onChange={handleUpload} className="hidden" disabled={uploading} />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {gallery?.map((g: any) => (
          <div key={g.id} className="relative group rounded-xl overflow-hidden bg-muted">
            <div className="aspect-square">
              <img src={g.image_url} alt={g.caption || ""} className="w-full h-full object-cover" />
            </div>
            <div className="p-2">
              {editingCaption === g.id ? (
                <div className="flex gap-1">
                  <input
                    value={captionText}
                    onChange={(e) => setCaptionText(e.target.value)}
                    placeholder="Descripción corta..."
                    className="flex-1 text-xs bg-muted rounded px-2 py-1 outline-none focus:ring-1 focus:ring-ring"
                    maxLength={80}
                    autoFocus
                  />
                  <button onClick={() => saveCaption(g.id)} className="text-accent"><Save size={14} /></button>
                  <button onClick={() => setEditingCaption(null)} className="text-muted-foreground"><X size={14} /></button>
                </div>
              ) : (
                <button
                  onClick={() => { setEditingCaption(g.id); setCaptionText(g.caption || ""); }}
                  className="text-xs text-muted-foreground hover:text-foreground w-full text-left truncate"
                >
                  {g.caption || "＋ Añadir descripción"}
                </button>
              )}
            </div>
            <button onClick={() => del(g.id)} className="absolute top-1 right-1 w-6 h-6 rounded-full bg-destructive/80 text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              <Trash2 size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ContentTab;
