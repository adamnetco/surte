import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Plus, Pencil, Trash2, Save, X, Search, ChevronDown, ChevronUp,
  Eye, EyeOff, GripVertical, Link2, Package, Settings2, Layers
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(price);

type ModifierGroup = {
  id: string;
  product_id: string;
  name: string;
  display_label: string;
  is_required: boolean;
  selection_type: string;
  min_selections: number;
  max_selections: number;
  sort_order: number;
  is_active: boolean;
  pricing_mode: string;
};

type ModifierOption = {
  id: string;
  modifier_group_id: string;
  display_name: string;
  linked_product_id: string | null;
  price_adjustment: number;
  max_quantity: number;
  sort_order: number;
  is_active: boolean;
};

const ModifiersTab = () => {
  const queryClient = useQueryClient();
  const { currentOrg } = useOrganization();
  const [selectedProduct, setSelectedProduct] = useState<string>("");
  const [search, setSearch] = useState("");
  const [showAllProducts, setShowAllProducts] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [editingGroup, setEditingGroup] = useState<string | null>(null);
  const [editingOption, setEditingOption] = useState<string | null>(null);
  const [optionSearch, setOptionSearch] = useState("");

  const [groupForm, setGroupForm] = useState({
    name: "", display_label: "", is_required: false, selection_type: "single",
    min_selections: "0", max_selections: "1", sort_order: "0", is_active: true,
    pricing_mode: "sum",
  });

  const [optionForm, setOptionForm] = useState({
    display_name: "", linked_product_id: "", price_adjustment: "0",
    max_quantity: "1", sort_order: "0", is_active: true,
  });

  // Products list
  const { data: products } = useQuery({
    queryKey: ["admin-products-list", currentOrg?.id],
    enabled: !!currentOrg?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("id, name, price, stock, image_url, base_unit").eq("organization_id", currentOrg!.id).order("name");
      if (error) throw error;
      return data;
    },
  });

  // Modifier groups for selected product
  const { data: groups, refetch: refetchGroups } = useQuery({
    queryKey: ["modifier-groups", selectedProduct, currentOrg?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("modifier_groups")
        .select("*")
        .eq("product_id", selectedProduct)
        .eq("organization_id", currentOrg!.id)
        .order("sort_order");
      if (error) throw error;
      return data as ModifierGroup[];
    },
    enabled: !!selectedProduct && !!currentOrg?.id,
  });

  // Modifier options for expanded group
  const { data: options, refetch: refetchOptions } = useQuery({
    queryKey: ["modifier-options", expandedGroup, currentOrg?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("modifier_options")
        .select("*")
        .eq("modifier_group_id", expandedGroup!)
        .eq("organization_id", currentOrg!.id)
        .order("sort_order");
      if (error) throw error;
      return data as ModifierOption[];
    },
    enabled: !!expandedGroup && !!currentOrg?.id,
  });

  const product = products?.find((p) => p.id === selectedProduct);
  const filteredProducts = products?.filter((p) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  );

  // Linkable products for option search
  const linkableProducts = products?.filter((p) =>
    !optionSearch || p.name.toLowerCase().includes(optionSearch.toLowerCase())
  );

  // ─── Group CRUD ───
  const resetGroupForm = () => {
    setGroupForm({ name: "", display_label: "", is_required: false, selection_type: "single", min_selections: "0", max_selections: "1", sort_order: "0", is_active: true, pricing_mode: "sum" });
    setEditingGroup(null);
  };

  const editGroup = (g: ModifierGroup) => {
    setGroupForm({
      name: g.name, display_label: g.display_label, is_required: g.is_required,
      selection_type: g.selection_type, min_selections: String(g.min_selections),
      max_selections: String(g.max_selections), sort_order: String(g.sort_order), is_active: g.is_active,
      pricing_mode: g.pricing_mode || "sum",
    });
    setEditingGroup(g.id);
  };

  const saveGroup = async () => {
    if (!groupForm.name || !groupForm.display_label) {
      toast.error("Nombre y etiqueta son obligatorios");
      return;
    }
    try {
      const payload = {
        product_id: selectedProduct,
        name: groupForm.name,
        display_label: groupForm.display_label,
        is_required: groupForm.is_required,
        selection_type: groupForm.selection_type,
        min_selections: Number(groupForm.min_selections) || 0,
        max_selections: Number(groupForm.max_selections) || 1,
        sort_order: Number(groupForm.sort_order) || 0,
        is_active: groupForm.is_active,
        pricing_mode: groupForm.pricing_mode,
      };
      if (editingGroup && editingGroup !== "new") {
        const { error } = await supabase.from("modifier_groups").update(payload).eq("id", editingGroup);
        if (error) throw error;
        toast.success("Grupo actualizado");
      } else {
        if (!currentOrg?.id) { toast.error("Selecciona una organización"); return; }
        const { error } = await supabase.from("modifier_groups").insert({ ...payload, organization_id: currentOrg.id });
        if (error) throw error;
        toast.success("Grupo creado");
      }
      resetGroupForm();
      refetchGroups();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const deleteGroup = async (id: string) => {
    if (!confirm("¿Eliminar este grupo y todas sus opciones?")) return;
    const { error } = await supabase.from("modifier_groups").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Grupo eliminado");
    if (expandedGroup === id) setExpandedGroup(null);
    refetchGroups();
  };

  const toggleGroupActive = async (id: string, current: boolean) => {
    const { error } = await supabase.from("modifier_groups").update({ is_active: !current }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    refetchGroups();
  };

  // ─── Option CRUD ───
  const resetOptionForm = () => {
    setOptionForm({ display_name: "", linked_product_id: "", price_adjustment: "0", max_quantity: "1", sort_order: "0", is_active: true });
    setEditingOption(null);
    setOptionSearch("");
  };

  const editOption = (o: ModifierOption) => {
    setOptionForm({
      display_name: o.display_name, linked_product_id: o.linked_product_id || "",
      price_adjustment: String(o.price_adjustment), max_quantity: String(o.max_quantity),
      sort_order: String(o.sort_order), is_active: o.is_active,
    });
    setEditingOption(o.id);
  };

  const saveOption = async () => {
    if (!optionForm.display_name || !expandedGroup) {
      toast.error("Nombre de la opción es obligatorio");
      return;
    }
    try {
      const payload = {
        modifier_group_id: expandedGroup,
        display_name: optionForm.display_name,
        linked_product_id: optionForm.linked_product_id || null,
        price_adjustment: Number(optionForm.price_adjustment) || 0,
        max_quantity: Number(optionForm.max_quantity) || 1,
        sort_order: Number(optionForm.sort_order) || 0,
        is_active: optionForm.is_active,
      };
      if (editingOption && editingOption !== "new") {
        const { error } = await supabase.from("modifier_options").update(payload).eq("id", editingOption);
        if (error) throw error;
        toast.success("Opción actualizada");
      } else {
        if (!currentOrg?.id) { toast.error("Selecciona una organización"); return; }
        const { error } = await supabase.from("modifier_options").insert({ ...payload, organization_id: currentOrg.id });
        if (error) throw error;
        toast.success("Opción creada");
      }
      resetOptionForm();
      refetchOptions();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const deleteOption = async (id: string) => {
    if (!confirm("¿Eliminar esta opción?")) return;
    const { error } = await supabase.from("modifier_options").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Opción eliminada");
    refetchOptions();
  };

  const toggleOptionActive = async (id: string, current: boolean) => {
    const { error } = await supabase.from("modifier_options").update({ is_active: !current }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    refetchOptions();
  };

  const getLinkedProduct = (id: string | null) => {
    if (!id) return null;
    return products?.find((p) => p.id === id);
  };

  return (
    <div className="space-y-4 pb-32">
      <div>
        <h2 className="font-heading font-bold text-lg text-foreground flex items-center gap-2">
          <Settings2 size={20} className="text-primary" /> Modificadores de Producto
        </h2>
        <p className="text-xs text-muted-foreground">
          Crea grupos de opciones que el cliente puede elegir (sabores, toppings, extras).
          Vincula cada opción a un producto real para control de inventario.
        </p>
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
                  onClick={() => { setSelectedProduct(p.id); setSearch(""); resetGroupForm(); setExpandedGroup(null); }}
                  className="w-full text-left bg-card border border-border rounded-lg px-3 py-2.5 text-sm hover:border-accent/40 transition-colors flex items-center gap-2"
                >
                  {p.image_url && (
                    <img src={p.image_url} alt="" className="w-8 h-8 rounded-md object-cover flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <span className="font-medium text-foreground truncate block">{p.name}</span>
                    <span className="text-[10px] text-muted-foreground">{formatPrice(p.price)}</span>
                  </div>
                </button>
              ))}
            </div>
            {filteredProducts && filteredProducts.length > 8 && !showAllProducts && (
              <button onClick={() => setShowAllProducts(true)} className="w-full text-center text-xs text-accent font-medium py-2 flex items-center justify-center gap-1">
                <ChevronDown size={12} /> Ver todos ({filteredProducts.length})
              </button>
            )}
          </div>
        )}
      </div>

      {/* Selected product header */}
      {product && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {product.image_url && <img src={product.image_url} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0" />}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{product.name}</p>
                <p className="text-xs text-muted-foreground">{formatPrice(product.price)} · Stock: {product.stock}</p>
              </div>
            </div>
            <button onClick={() => { setSelectedProduct(""); resetGroupForm(); setExpandedGroup(null); setShowAllProducts(false); }} className="text-muted-foreground hover:text-foreground p-1">
              <X size={16} />
            </button>
          </div>
          <button
            onClick={() => { resetGroupForm(); setEditingGroup("new"); }}
            className="mt-2 flex items-center gap-1 bg-accent text-accent-foreground px-3 py-1.5 rounded-lg text-xs font-semibold"
          >
            <Plus size={12} /> Crear Grupo de Modificadores
          </button>
        </div>
      )}

      {/* Group Form */}
      {editingGroup && selectedProduct && (
        <div className="bg-card border border-accent/30 rounded-xl p-3 space-y-2.5">
          <p className="text-xs font-heading font-bold text-foreground">
            {editingGroup === "new" ? "Nuevo Grupo" : "Editar Grupo"}
          </p>
          <input
            value={groupForm.name}
            onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
            placeholder="Nombre interno (ej: Sabores de pulpa)"
            className="w-full bg-muted rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
          <input
            value={groupForm.display_label}
            onChange={(e) => setGroupForm({ ...groupForm, display_label: e.target.value })}
            placeholder="Texto para el cliente (ej: Elige tus sabores:)"
            className="w-full bg-muted rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[10px] text-muted-foreground font-medium block mb-0.5">Condición</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setGroupForm({ ...groupForm, is_required: false })}
                  className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${!groupForm.is_required ? "bg-accent text-accent-foreground border-accent" : "bg-muted text-muted-foreground border-transparent"}`}
                >
                  Opcional
                </button>
                <button
                  onClick={() => setGroupForm({ ...groupForm, is_required: true })}
                  className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${groupForm.is_required ? "bg-accent text-accent-foreground border-accent" : "bg-muted text-muted-foreground border-transparent"}`}
                >
                  Obligatorio
                </button>
              </div>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground font-medium block mb-0.5">Selección</label>
              <div className="flex gap-2">
                <button
                  onClick={() => setGroupForm({ ...groupForm, selection_type: "single", max_selections: "1" })}
                  className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${groupForm.selection_type === "single" ? "bg-accent text-accent-foreground border-accent" : "bg-muted text-muted-foreground border-transparent"}`}
                >
                  Uno
                </button>
                <button
                  onClick={() => setGroupForm({ ...groupForm, selection_type: "multiple" })}
                  className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${groupForm.selection_type === "multiple" ? "bg-accent text-accent-foreground border-accent" : "bg-muted text-muted-foreground border-transparent"}`}
                >
                  Varios
                </button>
              </div>
            </div>
          </div>

          {groupForm.selection_type === "multiple" && (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] text-muted-foreground font-medium block mb-0.5">Mín. selecciones</label>
                <input type="number" value={groupForm.min_selections} onChange={(e) => setGroupForm({ ...groupForm, min_selections: e.target.value })}
                  className="w-full bg-muted rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground font-medium block mb-0.5">Máx. selecciones</label>
                <input type="number" value={groupForm.max_selections} onChange={(e) => setGroupForm({ ...groupForm, max_selections: e.target.value })}
                  className="w-full bg-muted rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
              </div>
            </div>
          )}

          {/* Pricing Mode */}
          <div>
            <label className="text-[10px] text-muted-foreground font-medium block mb-0.5">Modo de cobro</label>
            <div className="flex gap-2">
              <button
                onClick={() => setGroupForm({ ...groupForm, pricing_mode: "sum" })}
                className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${groupForm.pricing_mode === "sum" ? "bg-accent text-accent-foreground border-accent" : "bg-muted text-muted-foreground border-transparent"}`}
              >
                Sumar todo
              </button>
              <button
                onClick={() => setGroupForm({ ...groupForm, pricing_mode: "max_price" })}
                className={`flex-1 text-xs py-1.5 rounded-lg border transition-colors ${groupForm.pricing_mode === "max_price" ? "bg-accent text-accent-foreground border-accent" : "bg-muted text-muted-foreground border-transparent"}`}
              >
                🍕 Mayor valor
              </button>
            </div>
            {groupForm.pricing_mode === "max_price" && (
              <p className="text-[9px] text-muted-foreground mt-1 leading-tight">
                Estilo pizza: el cliente elige varios sabores y se cobra solo el de mayor precio.
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Switch checked={groupForm.is_active} onCheckedChange={(v) => setGroupForm({ ...groupForm, is_active: v })} />
            <span className="text-xs text-muted-foreground">{groupForm.is_active ? "Activo" : "Inactivo"}</span>
          </div>

          <div className="flex gap-2">
            <button onClick={resetGroupForm} className="flex-1 bg-muted rounded-xl py-2 text-sm text-muted-foreground font-medium flex items-center justify-center gap-1">
              <X size={14} /> Cancelar
            </button>
            <button onClick={saveGroup} className="flex-1 bg-accent text-accent-foreground rounded-xl py-2 text-sm font-semibold flex items-center justify-center gap-1">
              <Save size={14} /> Guardar
            </button>
          </div>
        </div>
      )}

      {/* Groups list */}
      {groups && groups.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
            <Layers size={12} /> {groups.length} grupo{groups.length !== 1 ? "s" : ""} configurado{groups.length !== 1 ? "s" : ""}
          </p>
          {groups.map((g) => {
            const isExpanded = expandedGroup === g.id;
            return (
              <div key={g.id} className={`bg-card border rounded-xl overflow-hidden transition-all ${g.is_active ? "border-border" : "border-border opacity-50"}`}>
                {/* Group header */}
                <div className="p-3 flex items-center gap-2">
                  <GripVertical size={14} className="text-muted-foreground/40 flex-shrink-0 cursor-grab" />
                  <button onClick={() => setExpandedGroup(isExpanded ? null : g.id)} className="flex-1 text-left min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium text-foreground truncate">{g.name}</span>
                      {g.is_required && <span className="text-[8px] bg-destructive/10 text-destructive font-bold px-1.5 py-0.5 rounded-full">Obligatorio</span>}
                    </div>
                    <p className="text-[10px] text-muted-foreground truncate">{g.display_label}</p>
                    <div className="flex gap-1 mt-0.5">
                      <span className="text-[9px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                        {g.selection_type === "single" ? "Solo uno" : `${g.min_selections}-${g.max_selections} opciones`}
                      </span>
                      {g.pricing_mode === "max_price" && (
                        <span className="text-[9px] bg-accent/10 text-accent px-1.5 py-0.5 rounded font-medium">🍕 Mayor valor</span>
                      )}
                    </div>
                  </button>
                  <Switch checked={g.is_active} onCheckedChange={() => toggleGroupActive(g.id, g.is_active)} />
                  <button onClick={() => setExpandedGroup(isExpanded ? null : g.id)}
                    className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </button>
                </div>

                {/* Expanded: options */}
                {isExpanded && (
                  <div className="border-t border-border bg-muted/30 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-semibold text-muted-foreground">
                        Opciones ({options?.length || 0})
                      </p>
                      <div className="flex gap-1.5">
                        <button onClick={() => editGroup(g)} className="text-[11px] text-accent hover:underline flex items-center gap-0.5">
                          <Pencil size={10} /> Editar
                        </button>
                        <button onClick={() => deleteGroup(g.id)} className="text-[11px] text-destructive hover:underline flex items-center gap-0.5">
                          <Trash2 size={10} /> Eliminar
                        </button>
                      </div>
                    </div>

                    {/* Option form */}
                    {editingOption && (
                      <div className="bg-card border border-accent/20 rounded-lg p-2.5 space-y-2">
                        <p className="text-[11px] font-heading font-bold text-foreground">
                          {editingOption === "new" ? "Nueva Opción" : "Editar Opción"}
                        </p>
                        <input
                          value={optionForm.display_name}
                          onChange={(e) => setOptionForm({ ...optionForm, display_name: e.target.value })}
                          placeholder="Nombre visible (ej: Limón, Mango)"
                          className="w-full bg-muted rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                        />

                        {/* Linked product selector */}
                        <div>
                          <label className="text-[10px] text-muted-foreground font-medium block mb-0.5 flex items-center gap-1">
                            <Link2 size={10} /> Producto vinculado (inventario)
                          </label>
                          {optionForm.linked_product_id ? (
                            <div className="flex items-center gap-2 bg-secondary/10 border border-secondary/20 rounded-lg px-2.5 py-1.5">
                              {getLinkedProduct(optionForm.linked_product_id)?.image_url && (
                                <img src={getLinkedProduct(optionForm.linked_product_id)!.image_url!} alt="" className="w-6 h-6 rounded object-cover" />
                              )}
                              <span className="text-xs text-foreground flex-1 truncate">
                                {getLinkedProduct(optionForm.linked_product_id)?.name || "Producto"}
                              </span>
                              <button onClick={() => setOptionForm({ ...optionForm, linked_product_id: "" })} className="text-muted-foreground hover:text-foreground">
                                <X size={12} />
                              </button>
                            </div>
                          ) : (
                            <div className="space-y-1">
                              <div className="relative">
                                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                                <input
                                  value={optionSearch}
                                  onChange={(e) => setOptionSearch(e.target.value)}
                                  placeholder="Buscar producto para vincular..."
                                  className="w-full bg-muted rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-ring"
                                />
                              </div>
                              {optionSearch && (
                                <div className="max-h-32 overflow-y-auto bg-card border border-border rounded-lg divide-y divide-border">
                                  {linkableProducts?.slice(0, 6).map((p) => (
                                    <button
                                      key={p.id}
                                      onClick={() => {
                                        setOptionForm({ ...optionForm, linked_product_id: p.id });
                                        setOptionSearch("");
                                        if (!optionForm.display_name) {
                                          // Auto-fill display name with a friendly short name
                                          const shortName = p.name.replace(/pulpa\s+(de\s+)?/i, "").replace(/\s*x\s*\d+.*/i, "").trim();
                                          setOptionForm((prev) => ({ ...prev, display_name: shortName || p.name, linked_product_id: p.id }));
                                        }
                                      }}
                                      className="w-full text-left px-2.5 py-1.5 text-xs hover:bg-muted transition-colors flex items-center gap-2"
                                    >
                                      {p.image_url && <img src={p.image_url} alt="" className="w-5 h-5 rounded object-cover flex-shrink-0" />}
                                      <span className="truncate flex-1">{p.name}</span>
                                      <span className="text-[9px] text-muted-foreground">{formatPrice(p.price)}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                              <p className="text-[9px] text-muted-foreground">
                                💡 Vincula a un producto real para que al elegir "Limón" se descuente de "Pulpa Limón x 200g"
                              </p>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] text-muted-foreground font-medium block mb-0.5">Ajuste precio</label>
                            <input type="number" value={optionForm.price_adjustment} onChange={(e) => setOptionForm({ ...optionForm, price_adjustment: e.target.value })}
                              placeholder="0" className="w-full bg-muted rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
                            <p className="text-[9px] text-muted-foreground">COP extra o descuento</p>
                          </div>
                          <div>
                            <label className="text-[10px] text-muted-foreground font-medium block mb-0.5">Cant. máx</label>
                            <input type="number" value={optionForm.max_quantity} onChange={(e) => setOptionForm({ ...optionForm, max_quantity: e.target.value })}
                              className="w-full bg-muted rounded-lg px-3 py-1.5 text-sm outline-none focus:ring-2 focus:ring-ring" />
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Switch checked={optionForm.is_active} onCheckedChange={(v) => setOptionForm({ ...optionForm, is_active: v })} />
                          <span className="text-xs text-muted-foreground">{optionForm.is_active ? "Visible" : "Oculto"}</span>
                        </div>

                        <div className="flex gap-2">
                          <button onClick={resetOptionForm} className="flex-1 bg-muted rounded-lg py-1.5 text-xs text-muted-foreground font-medium flex items-center justify-center gap-1">
                            <X size={12} /> Cancelar
                          </button>
                          <button onClick={saveOption} className="flex-1 bg-accent text-accent-foreground rounded-lg py-1.5 text-xs font-semibold flex items-center justify-center gap-1">
                            <Save size={12} /> Guardar
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Options list */}
                    {options && options.length > 0 && (
                      <div className="space-y-1">
                        {options.map((o) => {
                          const linked = getLinkedProduct(o.linked_product_id);
                          return (
                            <div key={o.id} className={`flex items-center gap-2 bg-card rounded-lg px-2.5 py-2 border transition-opacity ${o.is_active ? "border-border" : "border-border opacity-40"}`}>
                              <GripVertical size={12} className="text-muted-foreground/30 flex-shrink-0 cursor-grab" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1.5">
                                  <span className="text-xs font-medium text-foreground">{o.display_name}</span>
                                  {o.price_adjustment !== 0 && (
                                    <span className={`text-[9px] font-bold ${o.price_adjustment > 0 ? "text-accent" : "text-secondary"}`}>
                                      {o.price_adjustment > 0 ? "+" : ""}{formatPrice(o.price_adjustment)}
                                    </span>
                                  )}
                                </div>
                                {linked && (
                                  <p className="text-[9px] text-muted-foreground flex items-center gap-0.5 truncate">
                                    <Link2 size={8} /> {linked.name} · Stock: {linked.stock}
                                  </p>
                                )}
                              </div>
                              <button onClick={() => toggleOptionActive(o.id, o.is_active)} className="p-1">
                                {o.is_active ? <Eye size={12} className="text-secondary" /> : <EyeOff size={12} className="text-muted-foreground" />}
                              </button>
                              <button onClick={() => editOption(o)} className="text-accent p-1"><Pencil size={11} /></button>
                              <button onClick={() => deleteOption(o.id)} className="text-destructive p-1"><Trash2 size={11} /></button>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {!editingOption && (
                      <button
                        onClick={() => { resetOptionForm(); setEditingOption("new"); }}
                        className="w-full flex items-center justify-center gap-1 text-xs text-accent font-semibold py-2 border border-dashed border-accent/30 rounded-lg hover:bg-accent/5 transition-colors"
                      >
                        <Plus size={12} /> Agregar opción
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Empty state */}
      {selectedProduct && groups && groups.length === 0 && !editingGroup && (
        <div className="text-center py-8">
          <Settings2 size={32} className="mx-auto text-muted-foreground/30 mb-2" />
          <p className="text-sm text-muted-foreground">Sin modificadores configurados</p>
          <p className="text-xs text-muted-foreground">
            Crea un grupo para que los clientes elijan opciones como sabores, toppings o complementos.
          </p>
        </div>
      )}
    </div>
  );
};

export default ModifiersTab;
