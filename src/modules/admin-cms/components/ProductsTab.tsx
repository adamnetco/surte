import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useImageUpload } from "@/modules/admin-cms/hooks/useImageUpload";
import { useQuery, useQueryClient as useQC } from "@tanstack/react-query";
import { useInactiveBrands } from "@/modules/storefront/hooks/useStore";
import { Plus, Pencil, Trash2, Save, X, Upload, Loader2, Image as ImageIcon, Search, Eye, EyeOff, Filter, GripVertical, Images, Copy, Ban, Star, Clock, AlertCircle } from "lucide-react";

/** Returns scheduling status for a product: null | 'scheduled' | 'out_of_window' */
const getScheduleStatus = (p: any): null | "scheduled" | "out_of_window" => {
  const hasSchedule =
    p.available_from || p.available_until ||
    (Array.isArray(p.available_days) && p.available_days.length > 0) ||
    p.available_time_start || p.available_time_end;
  if (!hasSchedule) return null;
  const now = new Date();
  if (p.available_from && new Date(p.available_from) > now) return "out_of_window";
  if (p.available_until && new Date(p.available_until) < now) return "out_of_window";
  if (Array.isArray(p.available_days) && p.available_days.length > 0 && !p.available_days.includes(now.getDay())) {
    return "out_of_window";
  }
  if (p.available_time_start || p.available_time_end) {
    const hhmm = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    if (p.available_time_start && hhmm < String(p.available_time_start).slice(0, 5)) return "out_of_window";
    if (p.available_time_end && hhmm > String(p.available_time_end).slice(0, 5)) return "out_of_window";
  }
  return "scheduled";
};
import MarginCalculator from "./MarginCalculator";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { productSchema, firstZodMessage } from "@/lib/schemas";
import { errorToMessage } from "@/lib/errors";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(price);

/* ── Multi-image gallery manager per product ── */
const ProductMediaGallery = ({ productId, queryClient, orgId }: { productId: string; queryClient: any; orgId?: string | null }) => {
  const { upload, uploading } = useImageUpload();
  const { data: mediaItems, isLoading } = useQuery({
    queryKey: ["product-media-admin", productId, orgId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_media")
        .select("*")
        .eq("product_id", productId)
        .eq("organization_id", orgId!)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!productId && !!orgId,
  });

  const handleUploadMultiple = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    if (!orgId) { toast.error("Selecciona una organización"); return; }
    const currentMax = mediaItems?.length || 0;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const url = await upload(file, "products");
      if (url) {
        await supabase.from("product_media").insert({
          product_id: productId,
          organization_id: orgId,
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

/* ── Featured Tags Picker — shows featured sections and lets admin quickly add tags ── */
const FeaturedTagsPicker = ({ tags, onTagsChange, orgId }: { tags: string; onTagsChange: (t: string) => void; orgId?: string | null }) => {
  const { data: sections } = useQuery({
    queryKey: ["featured_sections", orgId],
    enabled: !!orgId,
    queryFn: async () => {
      const { data, error } = await supabase.from("featured_sections").select("*").eq("organization_id", orgId!).order("sort_order");
      if (error) throw error;
      return data;
    },
  });

  const currentTags = tags ? tags.split(",").map(t => t.trim()).filter(Boolean) : [];

  const tagSections = (sections || []).filter(
    (s: any) => s.filter_type === "tag" && s.filter_value
  );

  const toggleTag = (tag: string) => {
    const lower = tag.toLowerCase();
    if (currentTags.some(t => t.toLowerCase() === lower)) {
      onTagsChange(currentTags.filter(t => t.toLowerCase() !== lower).join(", "));
    } else {
      onTagsChange([...currentTags, tag].join(", "));
    }
  };

  const hasTag = (tag: string) => currentTags.some(t => t.toLowerCase() === tag.toLowerCase());

  return (
    <div className="space-y-2">
      <label className="text-[11px] text-muted-foreground mb-0.5 block">🏷️ Etiquetas (separadas por coma)</label>
      <input value={tags} onChange={(e) => onTagsChange(e.target.value)} placeholder="salsa, artesanal, picante" className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm border border-transparent focus:border-accent focus:outline-none" />
      {tags && (
        <div className="flex flex-wrap gap-1 mt-1">
          {currentTags.map((tag, i) => (
            <span key={i} className="text-[10px] bg-accent/10 text-accent px-2 py-0.5 rounded-full font-medium cursor-pointer hover:bg-accent/20 transition-colors" onClick={() => toggleTag(tag)}>
              {tag} ✕
            </span>
          ))}
        </div>
      )}

      {tagSections.length > 0 && (
        <div className="border-t border-border pt-2 mt-2">
          <p className="text-[10px] text-muted-foreground mb-1.5 flex items-center gap-1">
            <Star size={10} className="text-accent" /> Secciones Destacadas — clic para asociar
          </p>
          <div className="flex flex-wrap gap-1.5">
            {tagSections.map((s: any) => {
              const active = hasTag(s.filter_value!);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => toggleTag(s.filter_value!)}
                  className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-all border ${
                    active
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-muted text-muted-foreground border-transparent hover:border-primary/40"
                  }`}
                >
                  {s.emoji} {s.label}
                  {active && " ✓"}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

const ProductsTab = ({ products, categories, queryClient }: { products: any[]; categories: any[]; queryClient: any }) => {
  const { currentOrg } = useOrganization();
  const { data: inactiveBrands } = useInactiveBrands(currentOrg?.id);
  const isBrandHidden = (p: any) => !!p.brand && !!inactiveBrands && inactiveBrands.has(p.brand.toLowerCase());
  const [editing, setEditing] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterVisibility, setFilterVisibility] = useState<"all" | "visible" | "hidden">("all");
  const [problemFilter, setProblemFilter] = useState<"all" | "scheduled" | "out_of_window" | "no_stock" | "inactive_brand">("all");
  const [form, setForm] = useState({
    name: "", description: "", price: "", original_price: "", price_wholesale: "", price_distributor: "",
    cost_price: "", stock: "", unit: "unidad", category_id: "", is_fresh: false, is_wholesale: false, is_active: true, image_url: "",
    slug: "", meta_title: "", meta_description: "", brand: "", sku: "", gtin: "", weight: "",
    tags: "", unit_quantity: "", unit_measure: "", net_weight_grams: "",
    available_from: "", available_until: "", available_days: [] as number[],
    available_time_start: "", available_time_end: "",
  });
  const { upload, uploading } = useImageUpload();

  // Bulk edit state
  const [bulkMode, setBulkMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkAction, setBulkAction] = useState<"price_pct" | "activate" | "deactivate" | "add_tag" | "remove_tag" | "set_category">("price_pct");
  const [bulkValue, setBulkValue] = useState<string>("");
  const [bulkApplying, setBulkApplying] = useState(false);

  const resetForm = () => {
    setForm({ name: "", description: "", price: "", original_price: "", price_wholesale: "", price_distributor: "", cost_price: "", stock: "", unit: "unidad", category_id: "", is_fresh: false, is_wholesale: false, is_active: true, image_url: "", slug: "", meta_title: "", meta_description: "", brand: "", sku: "", gtin: "", weight: "", tags: "", unit_quantity: "", unit_measure: "", net_weight_grams: "", available_from: "", available_until: "", available_days: [], available_time_start: "", available_time_end: "" });
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
      available_from: p.available_from ? String(p.available_from).slice(0, 16) : "",
      available_until: p.available_until ? String(p.available_until).slice(0, 16) : "",
      available_days: Array.isArray(p.available_days) ? p.available_days : [],
      available_time_start: p.available_time_start ? String(p.available_time_start).slice(0, 5) : "",
      available_time_end: p.available_time_end ? String(p.available_time_end).slice(0, 5) : "",
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
      available_from: "", available_until: "", available_days: [],
      available_time_start: "", available_time_end: "",
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
    // Validación tipada con zod: cubre obligatorios, formatos y reglas cruzadas
    // (mayorista ≤ detal, original > price, costo ≤ precio).
    const parsed = productSchema.safeParse({
      name: form.name,
      slug: form.slug,
      description: form.description,
      price: form.price,
      original_price: form.original_price,
      price_wholesale: form.price_wholesale,
      price_distributor: form.price_distributor,
      cost_price: form.cost_price,
      stock: form.stock,
      unit: form.unit,
      category_id: form.category_id,
      brand: form.brand,
      sku: form.sku,
      gtin: form.gtin,
      meta_title: form.meta_title,
      meta_description: form.meta_description,
      image_url: form.image_url,
      unit_quantity: form.unit_quantity,
      net_weight_grams: form.net_weight_grams,
      is_active: form.is_active,
    });
    if (!parsed.success) {
      toast.error(firstZodMessage(parsed.error));
      return;
    }
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
      available_from: form.available_from ? new Date(form.available_from).toISOString() : null,
      available_until: form.available_until ? new Date(form.available_until).toISOString() : null,
      available_days: form.available_days.length > 0 ? form.available_days : null,
      available_time_start: form.available_time_start || null,
      available_time_end: form.available_time_end || null,
    };

    if (editing && editing !== "new") {
      const { error } = await supabase.from("products").update(payload).eq("id", editing);
      if (error) { toast.error(errorToMessage(error)); return; }
      toast.success("Producto actualizado");
    } else {
      if (!currentOrg?.id) { toast.error("Selecciona una organización"); return; }
      const { data: newProduct, error } = await supabase.from("products").insert({ ...payload, organization_id: currentOrg.id }).select("id, name, price, base_unit").single();
      if (error) { toast.error(errorToMessage(error)); return; }
      // Base presentation is auto-created by the DB trigger (trg_auto_base_presentation)
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

  /* ── Bulk actions ── */
  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    if (!filtered) return;
    setSelectedIds(new Set(filtered.map((p: any) => p.id)));
  };

  const clearSelection = () => setSelectedIds(new Set());

  const exitBulkMode = () => {
    setBulkMode(false);
    clearSelection();
    setBulkValue("");
  };

  const applyBulk = async () => {
    if (selectedIds.size === 0) {
      toast.error("Selecciona al menos un producto");
      return;
    }
    const ids = Array.from(selectedIds);
    const selectedProducts = products?.filter((p: any) => selectedIds.has(p.id)) || [];
    const desc: Record<string, string> = {
      price_pct: `ajustar precios ${bulkValue}%`,
      activate: "activar",
      deactivate: "ocultar",
      add_tag: `añadir etiqueta "${bulkValue}"`,
      remove_tag: `quitar etiqueta "${bulkValue}"`,
      set_category: "cambiar categoría",
    };
    if (!confirm(`¿Aplicar acción "${desc[bulkAction]}" a ${ids.length} producto(s)?`)) return;

    setBulkApplying(true);
    try {
      if (bulkAction === "activate" || bulkAction === "deactivate") {
        const { error } = await supabase
          .from("products")
          .update({ is_active: bulkAction === "activate" })
          .in("id", ids);
        if (error) throw error;
      } else if (bulkAction === "set_category") {
        const { error } = await supabase
          .from("products")
          .update({ category_id: bulkValue || null })
          .in("id", ids);
        if (error) throw error;
      } else if (bulkAction === "price_pct") {
        const pct = Number(bulkValue);
        if (!pct || isNaN(pct)) { toast.error("Indica un porcentaje válido (ej: 10 ó -5)"); setBulkApplying(false); return; }
        const factor = 1 + pct / 100;
        // Update each product's prices individually (preserve nullable fields)
        await Promise.all(selectedProducts.map((p: any) => {
          const newPayload: any = { price: Math.round(Number(p.price) * factor) };
          if (p.price_wholesale) newPayload.price_wholesale = Math.round(Number(p.price_wholesale) * factor);
          if (p.price_distributor) newPayload.price_distributor = Math.round(Number(p.price_distributor) * factor);
          return supabase.from("products").update(newPayload).eq("id", p.id);
        }));
      } else if (bulkAction === "add_tag" || bulkAction === "remove_tag") {
        const tag = bulkValue.trim().toLowerCase();
        if (!tag) { toast.error("Escribe la etiqueta"); setBulkApplying(false); return; }
        await Promise.all(selectedProducts.map((p: any) => {
          const current: string[] = (p.tags || []).map((t: string) => t.toLowerCase());
          let next: string[];
          if (bulkAction === "add_tag") {
            next = current.includes(tag) ? current : [...current, tag];
          } else {
            next = current.filter((t) => t !== tag);
          }
          return supabase.from("products").update({ tags: next }).eq("id", p.id);
        }));
      }
      toast.success(`✓ ${ids.length} producto(s) actualizados`);
      queryClient.invalidateQueries({ queryKey: ["admin-products"] });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      exitBulkMode();
    } catch (err: any) {
      toast.error(err.message || "Error al aplicar la acción");
    } finally {
      setBulkApplying(false);
    }
  };

  /** Quick problem filters: 'scheduled' | 'out_of_window' | 'no_stock' | 'inactive_brand' */
  const matchesProblem = (p: any) => {
    if (problemFilter === "all") return true;
    const status = getScheduleStatus(p);
    if (problemFilter === "scheduled") return status === "scheduled";
    if (problemFilter === "out_of_window") return status === "out_of_window";
    if (problemFilter === "no_stock") return Number(p.stock || 0) <= 0;
    if (problemFilter === "inactive_brand") return isBrandHidden(p);
    return true;
  };

  const filtered = products?.filter((p: any) => {
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase());
    const brandHidden = isBrandHidden(p);
    const matchesVisibility = filterVisibility === "all" ? true :
      filterVisibility === "visible" ? (p.is_active !== false && !brandHidden) :
      (p.is_active === false || brandHidden);
    return matchesSearch && matchesVisibility && matchesProblem(p);
  });

  const brandHiddenCount = products?.filter((p: any) => isBrandHidden(p) && p.is_active !== false).length || 0;
  const individuallyHiddenCount = products?.filter((p: any) => p.is_active === false).length || 0;
  const visibleCount = (products?.length || 0) - individuallyHiddenCount - brandHiddenCount;
  const hiddenCount = individuallyHiddenCount + brandHiddenCount;

  // Counts for problem filters
  const scheduledCount = products?.filter((p: any) => getScheduleStatus(p) === "scheduled").length || 0;
  const outOfWindowCount = products?.filter((p: any) => getScheduleStatus(p) === "out_of_window").length || 0;
  const noStockCount = products?.filter((p: any) => Number(p.stock || 0) <= 0).length || 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div>
          <h2 className="font-heading font-bold text-lg text-foreground">Productos ({products?.length || 0})</h2>
          <p className="text-[11px] text-muted-foreground">
            <span className="text-accent">{visibleCount} visibles</span> · {individuallyHiddenCount > 0 && <span>{individuallyHiddenCount} ocultos</span>}{brandHiddenCount > 0 && <span className="text-destructive"> · {brandHiddenCount} por marca</span>}
          </p>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={() => { setBulkMode((v) => !v); clearSelection(); }}
            className={`text-xs px-3 py-2 rounded-lg font-medium transition-colors flex items-center gap-1 ${bulkMode ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
          >
            <Filter size={14} /> {bulkMode ? "Salir lote" : "Edición masiva"}
          </button>
          <button onClick={() => { resetForm(); setEditing("new"); }} className="btn-surte text-xs px-3 py-2 flex items-center gap-1">
            <Plus size={14} /> Nuevo
          </button>
        </div>
      </div>

      {/* Bulk action bar */}
      {bulkMode && (
        <div className="bg-primary/5 border border-primary/30 rounded-xl p-3 mb-3 space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <p className="text-xs font-semibold text-primary">
              📋 {selectedIds.size} seleccionado(s) de {filtered?.length || 0}
            </p>
            <div className="flex gap-1.5">
              <button onClick={selectAllVisible} className="text-[11px] text-primary font-medium hover:underline">Todos</button>
              <span className="text-muted-foreground">·</span>
              <button onClick={clearSelection} className="text-[11px] text-muted-foreground font-medium hover:underline">Ninguno</button>
            </div>
          </div>
          <div className="flex gap-1.5 flex-wrap">
            <select
              value={bulkAction}
              onChange={(e) => { setBulkAction(e.target.value as any); setBulkValue(""); }}
              className="flex-1 min-w-[160px] bg-card rounded-lg px-2 py-1.5 text-xs border border-border focus:border-primary focus:outline-none"
            >
              <option value="price_pct">💲 Ajustar precios %</option>
              <option value="activate">👁 Activar</option>
              <option value="deactivate">🚫 Ocultar</option>
              <option value="add_tag">🏷️ Añadir etiqueta</option>
              <option value="remove_tag">✂️ Quitar etiqueta</option>
              <option value="set_category">📁 Cambiar categoría</option>
            </select>
            {bulkAction === "price_pct" && (
              <input
                type="number"
                value={bulkValue}
                onChange={(e) => setBulkValue(e.target.value)}
                placeholder="Ej: 10 ó -5"
                className="w-24 bg-card rounded-lg px-2 py-1.5 text-xs border border-border focus:border-primary focus:outline-none font-mono"
              />
            )}
            {(bulkAction === "add_tag" || bulkAction === "remove_tag") && (
              <input
                value={bulkValue}
                onChange={(e) => setBulkValue(e.target.value)}
                placeholder="etiqueta"
                className="w-32 bg-card rounded-lg px-2 py-1.5 text-xs border border-border focus:border-primary focus:outline-none"
              />
            )}
            {bulkAction === "set_category" && (
              <select
                value={bulkValue}
                onChange={(e) => setBulkValue(e.target.value)}
                className="flex-1 min-w-[120px] bg-card rounded-lg px-2 py-1.5 text-xs border border-border focus:border-primary focus:outline-none"
              >
                <option value="">Sin categoría</option>
                {categories?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            )}
            <button
              onClick={applyBulk}
              disabled={bulkApplying || selectedIds.size === 0}
              className="bg-primary text-primary-foreground rounded-lg px-3 py-1.5 text-xs font-semibold flex items-center gap-1 disabled:opacity-50"
            >
              {bulkApplying ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
              Aplicar
            </button>
          </div>
        </div>
      )}

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
          <div className="flex gap-1.5 flex-wrap">
            {(["all", "visible", "hidden"] as const).map((f) => (
              <button key={f} onClick={() => setFilterVisibility(f)}
                className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${filterVisibility === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                {f === "all" ? `Todos (${products?.length || 0})` : f === "visible" ? `👁 Visibles (${visibleCount})` : `🚫 Ocultos (${hiddenCount})`}
              </button>
            ))}
          </div>
          {/* Problem filters: scheduled / out of window / no stock / inactive brand */}
          <div className="flex gap-1.5 flex-wrap pt-1 border-t border-border">
            <span className="text-[10px] text-muted-foreground font-semibold uppercase tracking-wider self-center mr-1">Problemas:</span>
            {([
              { key: "all", label: `Todos`, count: null, cls: "bg-muted text-muted-foreground" },
              { key: "scheduled", label: `⏱ Programados`, count: scheduledCount, cls: "bg-secondary/15 text-secondary" },
              { key: "out_of_window", label: `🔴 Fuera horario`, count: outOfWindowCount, cls: "bg-destructive/10 text-destructive" },
              { key: "no_stock", label: `📦 Sin stock`, count: noStockCount, cls: "bg-surte-naranja/15 text-surte-naranja" },
              { key: "inactive_brand", label: `🚫 Marca oculta`, count: brandHiddenCount, cls: "bg-destructive/10 text-destructive" },
            ] as const).map((opt) => (
              <button key={opt.key} onClick={() => setProblemFilter(opt.key as any)}
                className={`text-[11px] px-2.5 py-1 rounded-full font-medium transition-colors ${problemFilter === opt.key ? "bg-primary text-primary-foreground" : opt.cls}`}>
                {opt.label}{opt.count !== null ? ` (${opt.count})` : ""}
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

          {/* Tags + Featured Sections */}
          <FeaturedTagsPicker tags={form.tags} onTagsChange={(t) => setForm({ ...form, tags: t })} />

          {/* Scheduling / Availability */}
          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">📅 Programación / Disponibilidad</p>
            <p className="text-[10px] text-muted-foreground">Limita cuándo el producto está visible. Deja vacío para mostrar siempre.</p>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-muted-foreground mb-0.5 block">Desde</label>
                <input type="datetime-local" value={form.available_from} onChange={(e) => setForm({ ...form, available_from: e.target.value })} className="w-full bg-muted rounded-lg px-2 py-2 text-xs border border-transparent focus:border-accent focus:outline-none" />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-0.5 block">Hasta</label>
                <input type="datetime-local" value={form.available_until} onChange={(e) => setForm({ ...form, available_until: e.target.value })} className="w-full bg-muted rounded-lg px-2 py-2 text-xs border border-transparent focus:border-accent focus:outline-none" />
              </div>
            </div>
            <div>
              <label className="text-[11px] text-muted-foreground mb-1 block">Días de la semana (vacío = todos)</label>
              <div className="flex gap-1 flex-wrap">
                {[{d:1,l:"Lun"},{d:2,l:"Mar"},{d:3,l:"Mié"},{d:4,l:"Jue"},{d:5,l:"Vie"},{d:6,l:"Sáb"},{d:0,l:"Dom"}].map(({d, l}) => {
                  const active = form.available_days.includes(d);
                  return (
                    <button key={d} type="button"
                      onClick={() => setForm({ ...form, available_days: active ? form.available_days.filter((x) => x !== d) : [...form.available_days, d] })}
                      className={`text-[11px] w-10 py-1.5 rounded-lg font-medium transition-colors ${active ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}
                    >{l}</button>
                  );
                })}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] text-muted-foreground mb-0.5 block">Hora inicio</label>
                <input type="time" value={form.available_time_start} onChange={(e) => setForm({ ...form, available_time_start: e.target.value })} className="w-full bg-muted rounded-lg px-2 py-2 text-xs border border-transparent focus:border-accent focus:outline-none" />
              </div>
              <div>
                <label className="text-[11px] text-muted-foreground mb-0.5 block">Hora fin</label>
                <input type="time" value={form.available_time_end} onChange={(e) => setForm({ ...form, available_time_end: e.target.value })} className="w-full bg-muted rounded-lg px-2 py-2 text-xs border border-transparent focus:border-accent focus:outline-none" />
              </div>
            </div>
            {(form.available_from || form.available_until || form.available_days.length > 0 || form.available_time_start || form.available_time_end) && (
              <button type="button" onClick={() => setForm({ ...form, available_from: "", available_until: "", available_days: [], available_time_start: "", available_time_end: "" })}
                className="text-[11px] text-destructive hover:underline">✕ Limpiar programación</button>
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
        {filtered?.map((p: any) => {
          const isSelected = selectedIds.has(p.id);
          return (
          <div
            key={p.id}
            onClick={bulkMode ? () => toggleSelected(p.id) : undefined}
            className={`flex items-center gap-3 bg-card rounded-xl p-3 border transition-colors ${
              bulkMode ? "cursor-pointer" : ""
            } ${
              isSelected
                ? "border-primary bg-primary/5 ring-1 ring-primary/40"
                : p.is_active !== false && !isBrandHidden(p)
                ? "border-border"
                : "border-border opacity-50"
            }`}
          >
            {bulkMode && (
              <Checkbox
                checked={isSelected}
                onCheckedChange={() => toggleSelected(p.id)}
                onClick={(e) => e.stopPropagation()}
                className="shrink-0"
                aria-label={`Seleccionar ${p.name}`}
              />
            )}
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
                {(() => {
                  const status = getScheduleStatus(p);
                  if (status === "scheduled") return (
                    <span className="text-[9px] bg-secondary/15 text-secondary px-1.5 py-0.5 rounded font-medium shrink-0 flex items-center gap-0.5" title="Disponibilidad limitada">
                      <Clock size={8} /> PROGRAMADO
                    </span>
                  );
                  if (status === "out_of_window") return (
                    <span className="text-[9px] bg-destructive/10 text-destructive px-1.5 py-0.5 rounded font-medium shrink-0 flex items-center gap-0.5" title="Fuera del horario configurado">
                      <AlertCircle size={8} /> FUERA DE HORARIO
                    </span>
                  );
                  return null;
                })()}
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
              onClick={(e) => e.stopPropagation()}
            />
            <button onClick={(e) => { e.stopPropagation(); duplicateProduct(p); }} className="text-muted-foreground hover:text-secondary transition-colors" title="Duplicar">
              <Copy size={15} />
            </button>
            <button onClick={(e) => { e.stopPropagation(); editProduct(p); }} className="text-muted-foreground hover:text-foreground transition-colors"><Pencil size={15} /></button>
            <button onClick={(e) => { e.stopPropagation(); deleteProduct(p.id); }} className="text-muted-foreground hover:text-destructive transition-colors"><Trash2 size={15} /></button>
          </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProductsTab;
