import { useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Pencil, Trash2, Save, X, Package, Box, Layers, Download, Upload, Search, ChevronDown, ToggleLeft } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(price);

const PresentationsTab = ({ queryClient }: { queryClient: any }) => {
  const { currentOrg } = useOrganization();
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [editing, setEditing] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [form, setForm] = useState({
    name: "", conversion_factor: "1", price: "", weight_kg: "", sort_order: "0", is_active: true,
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: products } = useQuery({
    queryKey: ["admin-products-list", currentOrg?.id],
    enabled: !!currentOrg?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name, price, stock, base_unit").eq("organization_id", currentOrg!.id).order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: presentations, refetch } = useQuery({
    queryKey: ["admin-presentations", selectedProduct, currentOrg?.id],
    queryFn: async () => {
      if (!selectedProduct) return [];
      const { data, error } = await supabase
        .from("product_presentations")
        .select("*")
        .eq("product_id", selectedProduct)
        .eq("organization_id", currentOrg!.id)
        .order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!selectedProduct && !!currentOrg?.id,
  });

  // All presentations for export
  const { data: allPresentations } = useQuery({
    queryKey: ["admin-all-presentations", currentOrg?.id],
    enabled: !!currentOrg?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_presentations")
        .select("*, products(name)")
        .eq("organization_id", currentOrg!.id)
        .order("product_id")
        .order("sort_order");
      if (error) throw error;
      return data;
    },
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
        if (!currentOrg?.id) { toast.error("Selecciona una organización"); return; }
        const { error } = await supabase.from("product_presentations").insert({ ...payload, organization_id: currentOrg.id });
        if (error) throw error;
        toast.success("Presentación creada");
      }
      resetForm();
      refetch();
      queryClient.invalidateQueries({ queryKey: ["admin-all-presentations"] });
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
    queryClient.invalidateQueries({ queryKey: ["admin-all-presentations"] });
  };

  const toggleActive = async (id: string, current: boolean) => {
    const { error } = await supabase.from("product_presentations").update({ is_active: !current }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    refetch();
  };

  // Export all presentations to XLSX
  const handleExport = () => {
    if (!allPresentations || allPresentations.length === 0) {
      toast.error("No hay presentaciones para exportar");
      return;
    }
    const rows = allPresentations.map((p: any) => ({
      id: p.id,
      product_id: p.product_id,
      producto: (p as any).products?.name || "",
      nombre: p.name,
      factor_conversion: p.conversion_factor,
      precio: p.price,
      peso_kg: p.weight_kg || "",
      orden: p.sort_order,
      activo: p.is_active ? "Sí" : "No",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Presentaciones");
    XLSX.writeFile(wb, "presentaciones_surteya.xlsx");
    toast.success("Archivo exportado");
  };

  // Import from XLSX/CSV
  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows: any[] = XLSX.utils.sheet_to_json(ws);

        let created = 0, updated = 0, errors = 0;

        for (const row of rows) {
          const productId = row.product_id;
          if (!productId || !row.nombre || !row.precio) { errors++; continue; }

          const payload = {
            product_id: productId,
            name: String(row.nombre),
            conversion_factor: Number(row.factor_conversion) || 1,
            price: Number(row.precio),
            weight_kg: row.peso_kg ? Number(row.peso_kg) : null,
            sort_order: Number(row.orden) || 0,
            is_active: row.activo === "No" ? false : true,
          };

          if (row.id && /^[0-9a-f]{8}-/.test(String(row.id))) {
            const { error } = await supabase.from("product_presentations").update(payload).eq("id", row.id);
            if (error) { errors++; } else { updated++; }
          } else {
            if (!currentOrg?.id) { errors++; continue; }
            const { error } = await supabase.from("product_presentations").insert({ ...payload, organization_id: currentOrg.id });
            if (error) { errors++; } else { created++; }
          }
        }

        toast.success(`Importación: ${created} creadas, ${updated} actualizadas${errors > 0 ? `, ${errors} errores` : ""}`);
        refetch();
        queryClient.invalidateQueries({ queryKey: ["admin-all-presentations"] });
      } catch (err: any) {
        toast.error("Error al procesar archivo: " + err.message);
      }
    };
    reader.readAsArrayBuffer(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <div className="space-y-4 pb-32">
      <div>
        <h2 className="font-heading font-bold text-lg text-foreground">Presentaciones de Producto</h2>
        <p className="text-xs text-muted-foreground">Define opciones de venta: Unidad, Pack, Caja</p>
      </div>

      {/* Import/Export toolbar */}
      <div className="flex gap-2">
        <button onClick={handleExport} className="flex items-center gap-1.5 bg-muted text-foreground px-3 py-2 rounded-lg text-xs font-medium hover:bg-muted/80 transition-colors">
          <Download size={14} /> Exportar
        </button>
        <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-1.5 bg-muted text-foreground px-3 py-2 rounded-lg text-xs font-medium hover:bg-muted/80 transition-colors">
          <Upload size={14} /> Importar
        </button>
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleImport} className="hidden" />
      </div>

      {/* Product Selector */}
      <div>
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar producto..."
            className="w-full bg-muted rounded-lg pl-9 pr-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring mb-2"
          />
        </div>
        {!selectedProduct && (
          <div className="space-y-1">
            <div className="max-h-[70vh] overflow-y-auto space-y-1">
              {filteredProducts?.slice(0, showAllProducts ? undefined : 8).map((p) => (
                <button
                  key={p.id}
                  onClick={() => { setSelectedProduct(p.id); setSearch(""); resetForm(); }}
                  className="w-full text-left bg-card border border-border rounded-lg px-3 py-2.5 text-sm hover:border-accent/40 transition-colors flex items-center justify-between gap-2"
                >
                  <span className="font-medium text-foreground truncate">{p.name}</span>
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {formatPrice(p.price)} · {p.stock} {p.base_unit || "uds"}
                  </span>
                </button>
              ))}
            </div>
            {filteredProducts && filteredProducts.length > 8 && !showAllProducts && (
              <button onClick={() => setShowAllProducts(true)} className="w-full text-center text-xs text-accent font-medium py-2 flex items-center justify-center gap-1">
                <ChevronDown size={12} /> Ver todos ({filteredProducts.length} productos)
              </button>
            )}
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
            <button onClick={() => { setSelectedProduct(""); resetForm(); setShowAllProducts(false); }} className="text-xs text-muted-foreground hover:text-foreground">
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
          <div className="flex items-center gap-2">
            <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            <span className="text-xs text-muted-foreground">{form.is_active ? "Activa" : "Inactiva"}</span>
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
          <p className="text-[11px] font-semibold text-muted-foreground">{presentations.length} presentaciones configuradas</p>
          {presentations.map((p: any) => (
            <div key={p.id} className={`bg-card border rounded-xl p-3 transition-opacity ${p.is_active ? "border-border" : "border-border opacity-50"}`}>
              <div className="flex items-center gap-2">
                <Box size={14} className="text-primary flex-shrink-0" />
                <span className="text-sm font-medium text-foreground flex-1 truncate">{p.name}</span>
                <Switch checked={p.is_active} onCheckedChange={() => toggleActive(p.id, p.is_active)} />
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

      {selectedProduct && presentations && presentations.length === 0 && !editing && (
        <div className="text-center py-8">
          <Package size={32} className="mx-auto text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground">Sin presentaciones configuradas</p>
          <p className="text-xs text-muted-foreground">Añade opciones como Pack, Caja, etc.</p>
        </div>
      )}
    </div>
  );
};

export default PresentationsTab;
