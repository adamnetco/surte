import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, Save, X, Package, Box, Layers } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(price);

const PresentationsTab = ({ queryClient }: { queryClient: any }) => {
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [editing, setEditing] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    name: "", conversion_factor: "1", price: "", weight_kg: "", sort_order: "0", is_active: true,
  });

  const { data: products } = useQuery({
    queryKey: ["admin-products-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name, price, stock, base_unit").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: presentations, refetch } = useQuery({
    queryKey: ["admin-presentations", selectedProduct],
    queryFn: async () => {
      if (!selectedProduct) return [];
      const { data, error } = await supabase
        .from("product_presentations")
        .select("*")
        .eq("product_id", selectedProduct)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedProduct,
  });

  const product = products?.find((p) => p.id === selectedProduct);

  const filteredProducts = products?.filter((p) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  );

  const resetForm = () => {
    setForm({ name: "", conversion_factor: "1", price: "", weight_kg: "", sort_order: "0", is_active: true });
    setEditing(null);
  };

  const editPres = (p: any) => {
    setForm({
      name: p.name,
      conversion_factor: String(p.conversion_factor),
      price: String(p.price),
      weight_kg: p.weight_kg ? String(p.weight_kg) : "",
      sort_order: String(p.sort_order || 0),
      is_active: p.is_active,
    });
    setEditing(p.id);
  };

  const savePresentation = async () => {
    if (!form.name || !form.price || !selectedProduct) {
      toast.error("Nombre y precio son obligatorios");
      return;
    }
    try {
      const payload = {
        product_id: selectedProduct,
        name: form.name,
        conversion_factor: Number(form.conversion_factor) || 1,
        price: Number(form.price),
        weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
        sort_order: Number(form.sort_order) || 0,
        is_active: form.is_active,
      };
      if (editing && editing !== "new") {
        const { error } = await supabase.from("product_presentations").update(payload).eq("id", editing);
        if (error) throw error;
        toast.success("Presentación actualizada");
      } else {
        const { error } = await supabase.from("product_presentations").insert(payload);
        if (error) throw error;
        toast.success("Presentación creada");
      }
      resetForm();
      refetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const deletePres = async (id: string) => {
    if (!confirm("¿Eliminar esta presentación?")) return;
    const { error } = await supabase.from("product_presentations").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Presentación eliminada");
    refetch();
  };

  const PRES_ICONS: Record<string, typeof Package> = {
    "unidad": Package,
    "pack": Layers,
    "caja": Box,
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-heading font-bold text-base text-foreground">Presentaciones de Producto</h2>
        <p className="text-xs text-muted-foreground">Define opciones de venta: Unidad, Pack, Caja</p>
      </div>

      {/* Product Selector */}
      <div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar producto..."
          className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring mb-2"
        />
        {!selectedProduct && (
          <div className="max-h-48 overflow-y-auto space-y-1">
            {filteredProducts?.slice(0, 20).map((p) => (
              <button
                key={p.id}
                onClick={() => { setSelectedProduct(p.id); setSearch(""); resetForm(); }}
                className="w-full text-left bg-card border border-border rounded-lg px-3 py-2 text-sm hover:border-accent/40 transition-colors"
              >
                <span className="font-medium text-foreground">{p.name}</span>
                <span className="text-xs text-muted-foreground ml-2">
                  {formatPrice(p.price)} · Stock: {p.stock} {p.base_unit || "uds"}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Selected product */}
      {product && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">{product.name}</p>
              <p className="text-xs text-muted-foreground">Base: {product.base_unit || "unidad"} · Stock: {product.stock} · Precio base: {formatPrice(product.price)}</p>
            </div>
            <button onClick={() => { setSelectedProduct(""); resetForm(); }} className="text-xs text-muted-foreground hover:text-foreground">
              <X size={16} />
            </button>
          </div>

          {/* Add button */}
          <button
            onClick={() => { resetForm(); setEditing("new"); }}
            className="mt-2 flex items-center gap-1 bg-accent text-accent-foreground px-3 py-1.5 rounded-lg text-xs font-semibold"
          >
            <Plus size={12} /> Añadir Presentación
          </button>
        </div>
      )}

      {/* Form */}
      {editing && selectedProduct && (
        <div className="bg-card border border-accent/30 rounded-xl p-3 space-y-2.5">
          <input
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Nombre (ej: Pack x 10, Caja x 40)"
            className="w-full bg-muted rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground font-medium block mb-0.5">Factor conversión</label>
              <input
                type="number"
                value={form.conversion_factor}
                onChange={(e) => setForm({ ...form, conversion_factor: e.target.value })}
                placeholder="10"
                className="w-full bg-muted rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
              <p className="text-[9px] text-muted-foreground mt-0.5">Cuántas unidades base contiene</p>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground font-medium block mb-0.5">Precio (COP)</label>
              <input
                type="number"
                value={form.price}
                onChange={(e) => setForm({ ...form, price: e.target.value })}
                placeholder="50000"
                className="w-full bg-muted rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground font-medium block mb-0.5">Peso (kg)</label>
              <input
                type="number"
                step="0.1"
                value={form.weight_kg}
                onChange={(e) => setForm({ ...form, weight_kg: e.target.value })}
                placeholder="2.5"
                className="w-full bg-muted rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground font-medium block mb-0.5">Orden</label>
              <input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                className="w-full bg-muted rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
          </div>
          {product && Number(form.conversion_factor) > 0 && (
            <p className="text-[10px] text-secondary font-medium bg-secondary/10 rounded-lg px-2 py-1">
              📦 Stock disponible: {Math.floor(product.stock / Number(form.conversion_factor))} {form.name || "presentaciones"}
            </p>
          )}
          <div className="flex gap-2">
            <button onClick={resetForm} className="flex-1 bg-muted rounded-xl py-2 text-sm text-muted-foreground font-medium flex items-center justify-center gap-1">
              <X size={14} /> Cancelar
            </button>
            <button onClick={savePresentation} className="flex-1 bg-accent text-accent-foreground rounded-xl py-2 text-sm font-semibold flex items-center justify-center gap-1">
              <Save size={14} /> Guardar
            </button>
          </div>
        </div>
      )}

      {/* Presentations list */}
      {presentations && presentations.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-muted-foreground">Presentaciones configuradas</p>
          {presentations.map((p: any) => (
            <div key={p.id} className={`bg-card border rounded-xl p-3 ${p.is_active ? "border-border" : "border-border opacity-50"}`}>
              <div className="flex items-center gap-2">
                <Box size={14} className="text-primary" />
                <span className="text-sm font-medium text-foreground flex-1">{p.name}</span>
                <span className="text-sm font-bold text-foreground">{formatPrice(p.price)}</span>
              </div>
              <div className="flex flex-wrap gap-1.5 mt-1 text-[10px] text-muted-foreground">
                <span className="bg-muted px-1.5 py-0.5 rounded">×{p.conversion_factor} uds</span>
                {p.weight_kg && <span className="bg-muted px-1.5 py-0.5 rounded">{p.weight_kg} kg</span>}
                {product && <span className="bg-secondary/10 text-secondary px-1.5 py-0.5 rounded">
                  Disp: {Math.floor(product.stock / p.conversion_factor)}
                </span>}
              </div>
              <div className="flex gap-1.5 mt-2">
                <button onClick={() => editPres(p)} className="flex items-center gap-1 text-[11px] text-accent hover:underline">
                  <Pencil size={11} /> Editar
                </button>
                <button onClick={() => deletePres(p.id)} className="flex items-center gap-1 text-[11px] text-destructive hover:underline">
                  <Trash2 size={11} /> Eliminar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PresentationsTab;
