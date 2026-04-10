import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useImageUpload } from "@/hooks/useImageUpload";
import { useQuery, useQueryClient as useQC } from "@tanstack/react-query";
import { useInactiveBrands } from "@/hooks/useStore";
import { Plus, Pencil, Trash2, Save, X, Upload, Loader2, Image as ImageIcon, Search, Eye, EyeOff, Filter, GripVertical, Images, Copy, Ban } from "lucide-react";
import MarginCalculator from "./MarginCalculator";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(price);

/* ── Multi-image gallery manager per product ── */
const ProductMediaGallery = ({ productId, queryClient }: { productId: string; queryClient: any }) => {
  const { upload, uploading } = useImageUpload();
  const { data: mediaItems, isLoading } = useQuery({
    queryKey: ["product-media-admin", productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_media")
        .select("*")
        .eq("product_id", productId)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!productId,
  });

  const handleUploadMultiple = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const currentMax = mediaItems?.length || 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const url = await upload(file, "products");
      if (url) {
        await supabase.from("product_media").insert({
          product_id: productId,
          media_type: "image",
          media_url: url,
          sort_order: currentMax + i,
        });
      }
    }
    queryClient.invalidateQueries({ queryKey: ["product-media-admin", productId] });
    queryClient.invalidateQueries({ queryKey: ["product-media", productId] });
    toast.success("Imágenes agregadas");
    e.target.value = "";
  };

  const deleteMedia = async (mediaId: string) => {
    await supabase.from("product_media").delete().eq("id", mediaId);
    queryClient.invalidateQueries({ queryKey: ["product-media-admin", productId] });
    queryClient.invalidateQueries({ queryKey: ["product-media", productId] });
    toast.success("Imagen eliminada");
  };

  const moveMedia = async (mediaId: string, direction: "up" | "down") => {
    if (!mediaItems) return;
    const idx = mediaItems.findIndex((m: any) => m.id === mediaId);
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= mediaItems.length) return;
    const current = mediaItems[idx];
    const swap = mediaItems[swapIdx];
    await Promise.all([
      supabase.from("product_media").update({ sort_order: swap.sort_order }).eq("id", current.id),
      supabase.from("product_media").update({ sort_order: current.sort_order }).eq("id", swap.id),
    ]);
    queryClient.invalidateQueries({ queryKey: ["product-media-admin", productId] });
  };

  return (
    <div className="space-y-2 border-t border-border pt-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
          <Images size={13} /> Galería de Imágenes
        </p>
        <label className="flex items-center gap-1 cursor-pointer text-xs text-accent font-medium hover:underline">
          {uploading ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
          Agregar
          <input type="file" accept="image/*" multiple onChange={handleUploadMultiple} className="hidden" disabled={uploading} />
        </label>
      </div>
      {isLoading ? (
        <div className="flex gap-2">
          {[1, 2, 3].map((i) => <div key={i} className="w-16 h-16 rounded-lg bg-muted animate-pulse" />)}
        </div>
      ) : mediaItems && mediaItems.length > 0 ? (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {mediaItems.map((m: any, i: number) => (
            <div key={m.id} className="relative w-16 h-16 rounded-lg overflow-hidden shrink-0 border border-border group">
              <img src={m.media_url} alt={m.title || ""} className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-foreground/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                {i > 0 && (
                  <button onClick={() => moveMedia(m.id, "up")} className="w-5 h-5 rounded bg-card/80 flex items-center justify-center text-[10px]">◀</button>
                )}
                <button onClick={() => deleteMedia(m.id)} className="w-5 h-5 rounded bg-destructive/80 flex items-center justify-center">
                  <X size={10} className="text-destructive-foreground" />
                </button>
                {i < mediaItems.length - 1 && (
                  <button onClick={() => moveMedia(m.id, "down")} className="w-5 h-5 rounded bg-card/80 flex items-center justify-center text-[10px]">▶</button>
                )}
              </div>
              <span className="absolute bottom-0.5 left-0.5 text-[8px] bg-card/70 text-foreground px-1 rounded font-mono">{i + 1}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-muted-foreground">Sin imágenes adicionales. Agrega fotos para la galería del producto.</p>
      )}
    </div>
  );
};

const ProductsTab = ({ products, categories, queryClient }: { products: any[]; categories: any[]; queryClient: any }) => {
  const { data: inactiveBrands } = useInactiveBrands();
  const isBrandHidden = (p: any) => !!p.brand && !!inactiveBrands && inactiveBrands.has(p.brand.toLowerCase());
  const [editing, setEditing] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterVisibility, setFilterVisibility] = useState<"all" | "visible" | "hidden">("all");
  const [form, setForm] = useState({
    name: "", description: "", price: "", original_price: "", price_wholesale: "", price_distributor: "",
    cost_price: "", stock: "", unit: "unidad", category_id: "", is_fresh: false, is_wholesale: false, is_active: true, image_url: "",
    slug: "", meta_title: "", meta_description: "", brand: "", sku: "", gtin: "", weight: "",
    tags: "", unit_quantity: "", unit_measure: "", net_weight_grams: "",
  });
  const { upload, uploading } = useImageUpload();

  const resetForm = () => {
    setForm({ name: "", description: "", price: "", original_price: "", price_wholesale: "", price_distributor: "", cost_price: "", stock: "", unit: "unidad", category_id: "", is_fresh: false, is_wholesale: false, is_active: true, image_url: "", slug: "", meta_title: "", meta_description: "", brand: "", sku: "", gtin: "", weight: "", tags: "", unit_quantity: "", unit_measure: "", net_weight_grams: "" });
    setEditing(null);
  };

  const editProduct = (p: any) => {
    setForm({
      name: p.name, description: p.description || "", price: String(p.price),
      original_price: p.original_price ? String(p.original_price) : "",
      price_wholesale: p.price_wholesale ? String(p.price_wholesale) : "",
      price_distributor: p.price_distributor ? String(p.price_distributor) : "",
      cost_price: p.cost_price ? String(p.cost_price) : "",
      stock: String(p.stock), unit: p.unit || "unidad", category_id: p.category_id || "",
      is_fresh: p.is_fresh, is_wholesale: p.is_wholesale, is_active: p.is_active !== false, image_url: p.image_url || "",
      slug: p.slug || "", meta_title: p.meta_title || "", meta_description: p.meta_description || "",
      brand: p.brand || "", sku: p.sku || "", gtin: p.gtin || "", weight: p.weight || "",
      tags: (p.tags || []).join(", "),
      unit_quantity: p.unit_quantity ? String(p.unit_quantity) : "",
      unit_measure: p.unit_measure || "",
      net_weight_grams: p.net_weight_grams ? String(p.net_weight_grams) : "",
    });
    setEditing(p.id);
  };

  const duplicateProduct = (p: any) => {
    if (!confirm(`¿Duplicar el producto "${p.name}"?\nSe abrirá el formulario con los datos copiados para que lo edites antes de guardar.`)) return;
    setForm({
      name: `${p.name} (copia)`, description: p.description || "", price: String(p.price),
      original_price: p.original_price ? String(p.original_price) : "",
      price_wholesale: p.price_wholesale ? String(p.price_wholesale) : "",
      price_distributor: p.price_distributor ? String(p.price_distributor) : "",
      cost_price: p.cost_price ? String(p.cost_price) : "",
      stock: String(p.stock), unit: p.unit || "unidad", category_id: p.category_id || "",
      is_fresh: p.is_fresh, is_wholesale: p.is_wholesale, is_active: true, image_url: p.image_url || "",
      slug: "", meta_title: "", meta_description: "",
      brand: p.brand || "", sku: "", gtin: "", weight: p.weight || "",
      tags: (p.tags || []).join(", "),
      unit_quantity: p.unit_quantity ? String(p.unit_quantity) : "",
      unit_measure: p.unit_measure || "",
      net_weight_grams: p.net_weight_grams ? String(p.net_weight_grams) : "",
    });
    setEditing("new");
    toast.info("Producto duplicado — edita y guarda");
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const url = await upload(file, "products");
    if (url) setForm({ ...form, image_url: url });
  };

  const saveProduct = async () => {
    if (!form.name || !form.price) { toast.error("Nombre y precio son obligatorios"); return; }
    const autoSlug = form.slug || form.name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const tagsArray = form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : [];
    const payload: any = {
      name: form.name, description: form.description, price: Number(form.price),
      original_price: form.original_price ? Number(form.original_price) : null,
      price_wholesale: form.price_wholesale ? Number(form.price_wholesale) : null,
      price_distributor: form.price_distributor ? Number(form.price_distributor) : null,
      cost_price: form.cost_price ? Number(form.cost_price) : null,
      stock: Number(form.stock), unit: form.unit, category_id: form.category_id || null,
      is_fresh: form.is_fresh, is_wholesale: form.is_wholesale, is_active: form.is_active, image_url: form.image_url || null,
      slug: autoSlug || null, meta_title: form.meta_title || null, meta_description: form.meta_description || null,
      brand: form.brand || null, sku: form.sku || null, gtin: form.gtin || null, weight: form.weight || null,
      tags: tagsArray,
      unit_quantity: form.unit_quantity ? Number(form.unit_quantity) : null,
      unit_measure: form.unit_measure || null,
      net_weight_grams: form.net_weight_grams ? Number(form.net_weight_grams) : null,
    };

    if (editing && editing !== "new") {
      const { error } = await supabase.from("products").update(payload).eq("id", editing);
      if (error) { toast.error(error.message); return; }
      toast.success("Producto actualizado");
    } else {
      const { data: newProduct, error } = await supabase.from("products").insert(payload).select("id, name, price, base_unit").single();
      if (error) { toast.error(error.message); return; }
      // Auto-create default presentation
      const baseUnit = newProduct.base_unit || form.unit || "unidad";
      await supabase.from("product_presentations").insert({
        product_id: newProduct.id,
        name: `${baseUnit.charAt(0).toUpperCase() + baseUnit.slice(1)}`,
        conversion_factor: 1,
        price: Number(form.price),
        sort_order: 0,
        is_active: true,
      });
      toast.success("Producto creado con presentación base");
      queryClient.invalidateQueries({ queryKey: ["admin-presentations"] });
      queryClient.invalidateQueries({ queryKey: ["admin-all-presentations"] });
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
    const brandHidden = isBrandHidden(p);
    const matchesVisibility = filterVisibility === "all" ? true :
      filterVisibility === "visible" ? (p.is_active !== false && !brandHidden) :
      (p.is_active === false || brandHidden);
    return matchesSearch && matchesVisibility;
  });

  const brandHiddenCount = products?.filter((p: any) => isBrandHidden(p) && p.is_active !== false).length || 0;
  const individuallyHiddenCount = products?.filter((p: any) => p.is_active === false).length || 0;
  const visibleCount = (products?.length || 0) - individuallyHiddenCount - brandHiddenCount;
  const hiddenCount = individuallyHiddenCount + brandHiddenCount;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-heading font-bold text-lg text-foreground">Productos ({products?.length || 0})</h2>
          <p className="text-[11px] text-muted-foreground">
            <span className="text-accent">{visibleCount} visibles</span> · {individuallyHiddenCount > 0 && <span>{individuallyHiddenCount} ocultos</span>}{brandHiddenCount > 0 && <span className="text-destructive"> · {brandHiddenCount} por marca</span>}
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
                {uploading ? "Subiendo..." : "Imagen principal"}
                <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" disabled={uploading} />
              </label>
              <p className="text-[11px] text-muted-foreground mt-1">JPG, PNG, WebP. Máx 5MB</p>
            </div>
          </div>

          {/* Multi-image Gallery Manager */}
          {editing && editing !== "new" && (
            <ProductMediaGallery productId={editing} queryClient={queryClient} />
          )}

          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nombre *" className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm border border-transparent focus:border-accent focus:outline-none transition-colors" />
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descripción" className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm border border-transparent focus:border-accent focus:outline-none transition-colors" rows={2} />

          {/* Pricing */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Precios</p>
            {/* Cost price - only visible to admin */}
            <div>
              <label className="text-[11px] text-destructive mb-0.5 block font-medium">Costo La Unión (oculto al cliente)</label>
              <input value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} placeholder="0" type="number" className="w-full bg-destructive/5 rounded-lg px-3 py-2.5 text-sm border border-destructive/20 focus:border-destructive focus:outline-none transition-colors font-mono" />
            </div>
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
                <label className="text-[11px] text-surte-naranja mb-0.5 block font-medium">Distribuidor</label>
                <input value={form.price_distributor} onChange={(e) => setForm({ ...form, price_distributor: e.target.value })} placeholder="0" type="number" className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm border border-surte-naranja/30 focus:border-surte-naranja focus:outline-none transition-colors" />
              </div>
            </div>
          </div>

          {/* Margin Calculator */}
          <MarginCalculator
            costPrice={form.cost_price}
            price={form.price}
            priceWholesale={form.price_wholesale}
            priceDistributor={form.price_distributor}
          />

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

          {/* Product attributes as switches */}
          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Atributos</p>
            <div className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="text-base">🌿</span>
                <span className="text-sm">Producto Fresco</span>
              </div>
              <Switch checked={form.is_fresh} onCheckedChange={(v) => setForm({ ...form, is_fresh: v })} />
            </div>
            <div className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2.5">
              <div className="flex items-center gap-2">
                <span className="text-base">📦</span>
                <span className="text-sm">Mayorista</span>
              </div>
              <Switch checked={form.is_wholesale} onCheckedChange={(v) => setForm({ ...form, is_wholesale: v })} />
            </div>
          </div>

          {/* Unit details */}
          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">📦 Unidad y Contenido</p>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[11px] text-muted-foreground mb-0.5 block">Cantidad</label>
                <input value={form.unit_quantity} onChange={(e) => setForm({ ...form, unit_quantity: e.target.value })} placeholder="500" type="number" className="w-full bg-muted rounded-lg px-3 py-2 text-sm border border-transparent focus:border-accent focus:outline-none" />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-0.5 block">Medida</label>
                <select value={form.unit_measure} onChange={(e) => setForm({ ...form, unit_measure: e.target.value })} className="w-full bg-muted rounded-lg px-3 py-2 text-sm border border-transparent focus:border-accent focus:outline-none">
                  <option value="">—</option>
                  <option value="g">g</option>
                  <option value="kg">kg</option>
                  <option value="ml">ml</option>
                  <option value="L">L</option>
                  <option value="oz">oz</option>
                  <option value="lb">lb</option>
                  <option value="unidad">unidad</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-0.5 block">Peso neto (g)</label>
                <input value={form.net_weight_grams} onChange={(e) => setForm({ ...form, net_weight_grams: e.target.value })} placeholder="500" type="number" className="w-full bg-muted rounded-lg px-3 py-2 text-sm border border-transparent focus:border-accent focus:outline-none" />
              </div>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label className="text-[11px] text-muted-foreground mb-0.5 block">🏷️ Etiquetas (separadas por coma)</label>
            <input value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} placeholder="salsa, artesanal, picante" className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm border border-transparent focus:border-accent focus:outline-none" />
            {form.tags && (
              <div className="flex flex-wrap gap-1 mt-1.5">
                {form.tags.split(",").map(t => t.trim()).filter(Boolean).map((tag, i) => (
                  <span key={i} className="text-[10px] bg-accent/10 text-accent px-2 py-0.5 rounded-full font-medium">{tag}</span>
                ))}
              </div>
            )}
          </div>

          {/* SEO Fields */}
          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">🔍 SEO & Indexación</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-muted-foreground mb-0.5 block">Slug URL</label>
                <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="auto-generado" className="w-full bg-muted rounded-lg px-3 py-2 text-sm border border-transparent focus:border-accent focus:outline-none" />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-0.5 block">Marca</label>
                <input value={form.brand} onChange={(e) => setForm({ ...form, brand: e.target.value })} placeholder="SURTÉ YA" className="w-full bg-muted rounded-lg px-3 py-2 text-sm border border-transparent focus:border-accent focus:outline-none" />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-0.5 block">SKU</label>
                <input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} placeholder="SKU-001" className="w-full bg-muted rounded-lg px-3 py-2 text-sm border border-transparent focus:border-accent focus:outline-none" />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-0.5 block">GTIN / EAN</label>
                <input value={form.gtin} onChange={(e) => setForm({ ...form, gtin: e.target.value })} placeholder="7701234567890" className="w-full bg-muted rounded-lg px-3 py-2 text-sm border border-transparent focus:border-accent focus:outline-none" />
              </div>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground mb-0.5 block">Peso (ej: 500g, 1kg)</label>
              <input value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} placeholder="500g" className="w-full bg-muted rounded-lg px-3 py-2 text-sm border border-transparent focus:border-accent focus:outline-none" />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground mb-0.5 block">Meta Título (SEO)</label>
              <input value={form.meta_title} onChange={(e) => setForm({ ...form, meta_title: e.target.value })} placeholder="Título para Google (máx 60 chars)" maxLength={60} className="w-full bg-muted rounded-lg px-3 py-2 text-sm border border-transparent focus:border-accent focus:outline-none" />
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground mb-0.5 block">Meta Descripción (SEO)</label>
              <textarea value={form.meta_description} onChange={(e) => setForm({ ...form, meta_description: e.target.value })} placeholder="Descripción para Google (máx 160 chars)" maxLength={160} rows={2} className="w-full bg-muted rounded-lg px-3 py-2 text-sm border border-transparent focus:border-accent focus:outline-none resize-none" />
            </div>
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
          <div key={p.id} className={`flex items-center gap-3 bg-card rounded-xl p-3 border transition-colors ${p.is_active !== false && !isBrandHidden(p) ? "border-border" : "border-border opacity-50"}`}>
            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
              {p.image_url ? (
                <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
              ) : (
                <span className="text-lg font-bold text-muted-foreground/40">{p.name.charAt(0)}</span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p className="text-sm font-medium text-foreground truncate">{p.name}</p>
                {p.is_active === false && (
                  <span className="text-[9px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded font-medium shrink-0">OCULTO</span>
                )}
                {isBrandHidden(p) && (
                  <span className="text-[9px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded font-medium shrink-0 flex items-center gap-0.5">
                    <Ban size={8} /> MARCA INACTIVA
                  </span>
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
            <button onClick={() => duplicateProduct(p)} className="text-muted-foreground hover:text-secondary transition-colors" title="Duplicar">
              <Copy size={15} />
            </button>
            <button onClick={() => editProduct(p)} className="text-muted-foreground hover:text-foreground transition-colors"><Pencil size={15} /></button>
            <button onClick={() => deleteProduct(p.id)} className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={15} /></button>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ProductsTab;
