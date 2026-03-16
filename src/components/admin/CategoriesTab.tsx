import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, Save, X } from "lucide-react";
import { toast } from "sonner";

const CategoriesTab = ({ categories, queryClient }: { categories: any[]; queryClient: any }) => {
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", slug: "", icon: "Package", sort_order: "0", color: "#6B8E23" });

  const resetForm = () => { setForm({ name: "", slug: "", icon: "Package", sort_order: "0", color: "#6B8E23" }); setEditing(null); };

  const saveCategory = async () => {
    const payload = { name: form.name, slug: form.slug, icon: form.icon, sort_order: Number(form.sort_order), color: form.color };
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

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading font-bold text-lg text-foreground">Categorías</h2>
        <button onClick={() => { resetForm(); setEditing("new"); }} className="btn-surte text-xs px-3 py-2 flex items-center gap-1"><Plus size={14} /> Nueva</button>
      </div>
      {editing && (
        <div className="bg-card rounded-xl p-4 mb-4 space-y-3" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="flex justify-between items-center">
            <h3 className="font-heading font-semibold text-sm">{editing === "new" ? "Nueva Categoría" : "Editar"}</h3>
            <button onClick={resetForm}><X size={18} className="text-muted-foreground" /></button>
          </div>
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") })} placeholder="Nombre" className="w-full bg-muted rounded-lg px-3 py-2 text-sm" />
          <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="Slug" className="w-full bg-muted rounded-lg px-3 py-2 text-sm" />
          <div className="grid grid-cols-3 gap-2">
            <input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="Icono" className="bg-muted rounded-lg px-3 py-2 text-sm" />
            <input value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} placeholder="Orden" type="number" className="bg-muted rounded-lg px-3 py-2 text-sm" />
            <input value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} type="color" className="bg-muted rounded-lg h-9 cursor-pointer" />
          </div>
          <div className="flex gap-2">
            <button onClick={saveCategory} className="btn-surte flex-1 text-sm py-2 flex items-center justify-center gap-1"><Save size={14} /> Guardar</button>
            <button onClick={resetForm} className="bg-muted rounded-xl px-4 py-2 text-sm text-muted-foreground">Cancelar</button>
          </div>
        </div>
      )}
      <div className="space-y-2">
        {categories?.map((c: any) => (
          <div key={c.id} className="flex items-center gap-3 bg-card rounded-xl p-3" style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-accent-foreground" style={{ backgroundColor: c.color || "hsl(var(--muted))" }}>{c.name.charAt(0)}</div>
            <div className="flex-1"><p className="text-sm font-medium text-foreground">{c.name}</p><p className="text-xs text-muted-foreground">{c.slug}</p></div>
            <button onClick={() => { setForm({ name: c.name, slug: c.slug, icon: c.icon || "Package", sort_order: String(c.sort_order || 0), color: c.color || "#6B8E23" }); setEditing(c.id); }}><Pencil size={16} className="text-muted-foreground" /></button>
            <button onClick={() => deleteCategory(c.id)}><Trash2 size={16} className="text-destructive" /></button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CategoriesTab;
