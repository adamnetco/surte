import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useImageUpload } from "@/hooks/useImageUpload";
import { Plus, Pencil, Trash2, Save, X, Upload, Loader2, Image as ImageIcon } from "lucide-react";
import { toast } from "sonner";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(price);

const ProductsTab = ({ products, categories, queryClient }: { products: any[]; categories: any[]; queryClient: any }) => {
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "", description: "", price: "", original_price: "", stock: "", unit: "unidad",
    category_id: "", is_fresh: false, is_wholesale: false, image_url: "",
  });
  const { upload, uploading } = useImageUpload();

  const resetForm = () => {
    setForm({ name: "", description: "", price: "", original_price: "", stock: "", unit: "unidad", category_id: "", is_fresh: false, is_wholesale: false, image_url: "" });
    setEditing(null);
  };

  const editProduct = (p: any) => {
    setForm({
      name: p.name, description: p.description || "", price: String(p.price),
      original_price: p.original_price ? String(p.original_price) : "",
      stock: String(p.stock), unit: p.unit || "unidad", category_id: p.category_id || "",
      is_fresh: p.is_fresh, is_wholesale: p.is_wholesale, image_url: p.image_url || "",
    });
    setEditing(p.id);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await upload(file, "products");
    if (url) setForm({ ...form, image_url: url });
  };

  const saveProduct = async () => {
    if (!form.name || !form.price) { toast.error("Nombre y precio son obligatorios"); return; }
    const payload = {
      name: form.name, description: form.description, price: Number(form.price),
      original_price: form.original_price ? Number(form.original_price) : null,
      stock: Number(form.stock), unit: form.unit, category_id: form.category_id || null,
      is_fresh: form.is_fresh, is_wholesale: form.is_wholesale, image_url: form.image_url || null,
    };

    if (editing && editing !== "new") {
      const { error } = await supabase.from("products").update(payload).eq("id", editing);
      if (error) { toast.error(error.message); return; }
      toast.success("Producto actualizado");
    } else {
      const { error } = await supabase.from("products").insert(payload);
      if (error) { toast.error(error.message); return; }
      toast.success("Producto creado");
    }
    queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    queryClient.invalidateQueries({ queryKey: ["products"] });
    resetForm();
  };

  const deleteProduct = async (id: string) => {
    if (!confirm("¿Eliminar este producto?")) return;
    const { error } = await supabase.from("products").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Producto eliminado");
    queryClient.invalidateQueries({ queryKey: ["admin-products"] });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading font-bold text-lg text-foreground">Productos ({products?.length || 0})</h2>
        <button onClick={() => { resetForm(); setEditing("new"); }} className="btn-surte text-xs px-3 py-2 flex items-center gap-1">
          <Plus size={14} /> Nuevo
        </button>
      </div>

      {editing && (
        <div className="bg-card rounded-xl p-4 mb-4 space-y-3" style={{ boxShadow: "var(--shadow-card)" }}>
          <div className="flex justify-between items-center">
            <h3 className="font-heading font-semibold text-sm">{editing === "new" ? "Nuevo Producto" : "Editar Producto"}</h3>
            <button onClick={resetForm}><X size={18} className="text-muted-foreground" /></button>
          </div>

          {/* Image Upload */}
          <div className="flex items-center gap-3">
            <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center overflow-hidden shrink-0 border-2 border-dashed border-border">
              {form.image_url ? (
                <img src={form.image_url} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <ImageIcon size={24} className="text-muted-foreground/40" />
              )}
            </div>
            <div className="flex-1">
              <label className="flex items-center gap-2 cursor-pointer btn-surte text-xs px-3 py-2 w-fit">
                {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                {uploading ? "Subiendo..." : "Subir imagen"}
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={uploading} />
              </label>
              <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WebP. Máx 5MB</p>
            </div>
          </div>

          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nombre *" className="w-full bg-muted rounded-lg px-3 py-2 text-sm" />
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descripción" className="w-full bg-muted rounded-lg px-3 py-2 text-sm" rows={2} />
          <div className="grid grid-cols-2 gap-2">
            <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="Precio *" type="number" className="bg-muted rounded-lg px-3 py-2 text-sm" />
            <input value={form.original_price} onChange={(e) => setForm({ ...form, original_price: e.target.value })} placeholder="Precio original" type="number" className="bg-muted rounded-lg px-3 py-2 text-sm" />
            <input value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} placeholder="Stock" type="number" className="bg-muted rounded-lg px-3 py-2 text-sm" />
            <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="Unidad" className="bg-muted rounded-lg px-3 py-2 text-sm" />
          </div>
          <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="w-full bg-muted rounded-lg px-3 py-2 text-sm">
            <option value="">Sin categoría</option>
            {categories?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_fresh} onChange={(e) => setForm({ ...form, is_fresh: e.target.checked })} /> Fresco</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.is_wholesale} onChange={(e) => setForm({ ...form, is_wholesale: e.target.checked })} /> Mayorista</label>
          </div>
          <button onClick={saveProduct} className="btn-surte w-full text-sm py-2.5 flex items-center justify-center gap-1">
            <Save size={16} /> Guardar
          </button>
        </div>
      )}

      <div className="space-y-2">
        {products?.map((p: any) => (
          <div key={p.id} className="flex items-center gap-3 bg-card rounded-xl p-3" style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
              {p.image_url ? (
                <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-lg font-bold text-muted-foreground/40">{p.name.charAt(0)}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
              <p className="text-xs text-muted-foreground">{formatPrice(p.price)} · Stock: {p.stock}</p>
            </div>
            <button onClick={() => editProduct(p)} className="text-muted-foreground"><Pencil size={16} /></button>
            <button onClick={() => deleteProduct(p.id)} className="text-destructive"><Trash2 size={16} /></button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProductsTab;
