import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useImageUpload } from "@/hooks/useImageUpload";
import { Plus, Pencil, Trash2, Save, X, Upload, Loader2, Image as ImageIcon, Search, Eye, EyeOff, Filter } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(price);

const ProductsTab = ({ products, categories, queryClient }: { products: any[]; categories: any[]; queryClient: any }) => {
  const [editing, setEditing] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterVisibility, setFilterVisibility] = useState<"all" | "visible" | "hidden">("all");
  const [form, setForm] = useState({
    name: "", description: "", price: "", original_price: "", price_wholesale: "", price_distributor: "",
    stock: "", unit: "unidad", category_id: "", is_fresh: false, is_wholesale: false, is_active: true, image_url: "",
  });
  const { upload, uploading } = useImageUpload();

  const resetForm = () => {
    setForm({ name: "", description: "", price: "", original_price: "", price_wholesale: "", price_distributor: "", stock: "", unit: "unidad", category_id: "", is_fresh: false, is_wholesale: false, is_active: true, image_url: "" });
    setEditing(null);
  };

  const editProduct = (p: any) => {
    setForm({
      name: p.name, description: p.description || "", price: String(p.price),
      original_price: p.original_price ? String(p.original_price) : "",
      price_wholesale: p.price_wholesale ? String(p.price_wholesale) : "",
      price_distributor: p.price_distributor ? String(p.price_distributor) : "",
      stock: String(p.stock), unit: p.unit || "unidad", category_id: p.category_id || "",
      is_fresh: p.is_fresh, is_wholesale: p.is_wholesale, is_active: p.is_active !== false, image_url: p.image_url || "",
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
      price_wholesale: form.price_wholesale ? Number(form.price_wholesale) : null,
      price_distributor: form.price_distributor ? Number(form.price_distributor) : null,
      stock: Number(form.stock), unit: form.unit, category_id: form.category_id || null,
      is_fresh: form.is_fresh, is_wholesale: form.is_wholesale, is_active: form.is_active, image_url: form.image_url || null,
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

  const toggleVisibility = async (id: string, currentActive: boolean) => {
    const { error } = await supabase.from("products").update({ is_active: !currentActive }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success(!currentActive ? "Producto visible" : "Producto oculto");
    queryClient.invalidateQueries({ queryKey: ["admin-products"] });
    queryClient.invalidateQueries({ queryKey: ["products"] });
  };

  const filtered = products?.filter((p: any) => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesVisibility = filterVisibility === "all" ? true :
      filterVisibility === "visible" ? p.is_active !== false :
      p.is_active === false;
    return matchesSearch && matchesVisibility;
  });

  const visibleCount = products?.filter((p: any) => p.is_active !== false).length || 0;
  const hiddenCount = (products?.length || 0) - visibleCount;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-heading font-bold text-lg text-foreground">Productos ({products?.length || 0})</h2>
          <p className="text-[11px] text-muted-foreground">
            <span className="text-accent">{visibleCount} visibles</span> · <span className="text-muted-foreground">{hiddenCount} ocultos</span>
          </p>
        </div>
        <button onClick={() => { resetForm(); setEditing("new"); }} className="btn-surte text-xs px-3 py-2 flex items-center gap-1">
          <Plus size={14} /> Nuevo
        </button>
      </div>

      {/* Search + Filter */}
      {!editing && (products?.length || 0) > 0 && (
        <div className="space-y-2 mb-3">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Buscar producto..."
              className="w-full bg-muted rounded-lg pl-9 pr-3 py-2.5 text-sm border border-transparent focus:border-accent focus:outline-none transition-colors"
            />
          </div>
          <div className="flex gap-1.5">
            {(["all", "visible", "hidden"] as const).map((f) => (
              <button key={f} onClick={() => setFilterVisibility(f)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${filterVisibility === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {f === "all" ? `Todos (${products?.length || 0})` : f === "visible" ? `👁 Visibles (${visibleCount})` : `🚫 Ocultos (${hiddenCount})`}
              </button>
            ))}
          </div>
        </div>
      )}

      {editing && (
        <div className="bg-card rounded-xl p-4 mb-4 space-y-3 border border-border">
          <div className="flex justify-between items-center">
            <h3 className="font-heading font-semibold text-sm">{editing === "new" ? "Nuevo Producto" : "Editar Producto"}</h3>
            <button onClick={resetForm}><X size={18} className="text-muted-foreground" /></button>
          </div>

          {/* Visibility toggle */}
          <div className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2.5">
            <div className="flex items-center gap-2">
              {form.is_active ? <Eye size={16} className="text-accent" /> : <EyeOff size={16} className="text-muted-foreground" />}
              <span className="text-sm font-medium">{form.is_active ? "Visible en catálogo" : "Oculto del catálogo"}</span>
            </div>
            <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
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
              <p className="text-[11px] text-muted-foreground mt-1">JPG, PNG, WebP. Máx 5MB</p>
            </div>
          </div>

          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nombre *" className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm border border-transparent focus:border-accent focus:outline-none transition-colors" />
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descripción" className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm border border-transparent focus:border-accent focus:outline-none transition-colors" rows={2} />

          {/* Pricing */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Precios</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-muted-foreground mb-0.5 block">Detal *</label>
                <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="0" type="number" className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm border border-transparent focus:border-accent focus:outline-none transition-colors" />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-0.5 block">Precio anterior</label>
                <input value={form.original_price} onChange={(e) => setForm({ ...form, original_price: e.target.value })} placeholder="0" type="number" className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm border border-transparent focus:border-accent focus:outline-none transition-colors" />
              </div>
              <div>
                <label className="text-[11px] text-accent mb-0.5 block font-medium">Mayorista</label>
                <input value={form.price_wholesale} onChange={(e) => setForm({ ...form, price_wholesale: e.target.value })} placeholder="0" type="number" className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm border border-accent/30 focus:border-accent focus:outline-none transition-colors" />
              </div>
              <div>
                <label className="text-[11px] text-surte-orange mb-0.5 block font-medium">Distribuidor</label>
                <input value={form.price_distributor} onChange={(e) => setForm({ ...form, price_distributor: e.target.value })} placeholder="0" type="number" className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm border border-surte-orange/30 focus:border-surte-orange focus:outline-none transition-colors" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-muted-foreground mb-0.5 block">Stock</label>
              <input value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} placeholder="0" type="number" className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm border border-transparent focus:border-accent focus:outline-none transition-colors" />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground mb-0.5 block">Unidad</label>
              <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="unidad" className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm border border-transparent focus:border-accent focus:outline-none transition-colors" />
            </div>
          </div>

          <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm border border-transparent focus:border-accent focus:outline-none transition-colors">
            <option value="">Sin categoría</option>
            {categories?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>

          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={form.is_fresh} onChange={(e) => setForm({ ...form, is_fresh: e.target.checked })} className="rounded border-border" /> Fresco</label>
            <label className="flex items-center gap-2 text-sm cursor-pointer"><input type="checkbox" checked={form.is_wholesale} onChange={(e) => setForm({ ...form, is_wholesale: e.target.checked })} className="rounded border-border" /> Mayorista</label>
          </div>

          <div className="flex gap-2">
            <button onClick={saveProduct} className="btn-surte flex-1 text-sm py-2.5 flex items-center justify-center gap-1">
              <Save size={14} /> Guardar
            </button>
            <button onClick={resetForm} className="bg-muted rounded-xl px-4 py-2.5 text-sm text-muted-foreground font-medium hover:bg-muted/80 transition-colors">
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {filtered?.map((p: any) => (
          <div key={p.id} className={`flex items-center gap-3 bg-card rounded-xl p-3 border transition-colors ${p.is_active !== false ? "border-border" : "border-border opacity-50"}`}>
            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
              {p.image_url ? (
                <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-lg font-bold text-muted-foreground/40">{p.name.charAt(0)}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                {p.is_active === false && (
                  <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-medium shrink-0">OCULTO</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {formatPrice(p.price)}
                {p.price_wholesale && <span className="text-accent ml-1">· May: {formatPrice(p.price_wholesale)}</span>}
              </p>
              <p className="text-[11px] text-muted-foreground">Stock: {p.stock} · {p.categories?.name || "Sin cat."}</p>
            </div>
            <Switch
              checked={p.is_active !== false}
              onCheckedChange={() => toggleVisibility(p.id, p.is_active !== false)}
            />
            <button onClick={() => editProduct(p)} className="text-muted-foreground hover:text-foreground transition-colors"><Pencil size={15} /></button>
            <button onClick={() => deleteProduct(p.id)} className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProductsTab;
