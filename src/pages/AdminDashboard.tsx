import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, Tag, ShoppingCart, Settings, Plus, Pencil, Trash2, ArrowLeft, Save, X, BarChart3 } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Product = Tables<"products">;
type Category = Tables<"categories">;

const tabs = [
  { id: "overview", label: "Resumen", icon: BarChart3 },
  { id: "products", label: "Productos", icon: Package },
  { id: "categories", label: "Categorías", icon: Tag },
  { id: "orders", label: "Pedidos", icon: ShoppingCart },
  { id: "settings", label: "Config", icon: Settings },
];

const formatPrice = (price: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(price);

const AdminDashboard = () => {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      toast.error("Acceso denegado");
      navigate("/");
    }
  }, [user, isAdmin, loading, navigate]);

  const { data: products } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*, categories(name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  const { data: categories } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  const { data: orders } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*, order_items(*)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  const { data: settings } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("*");
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground">Cargando...</p></div>;
  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-primary text-primary-foreground px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate("/")} className="text-primary-foreground"><ArrowLeft size={20} /></button>
        <h1 className="font-heading font-bold text-lg">Admin SURTÉ</h1>
      </header>

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-border bg-card scrollbar-hide">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeTab === id ? "border-accent text-accent" : "border-transparent text-muted-foreground"
            }`}
          >
            <Icon size={16} /> {label}
          </button>
        ))}
      </div>

      <main className="p-4">
        {activeTab === "overview" && <OverviewTab products={products} orders={orders} />}
        {activeTab === "products" && <ProductsTab products={products} categories={categories} queryClient={queryClient} />}
        {activeTab === "categories" && <CategoriesTab categories={categories} queryClient={queryClient} />}
        {activeTab === "orders" && <OrdersTab orders={orders} queryClient={queryClient} />}
        {activeTab === "settings" && <SettingsTab settings={settings} queryClient={queryClient} />}
      </main>
    </div>
  );
};

const OverviewTab = ({ products, orders }: { products: any[]; orders: any[] }) => {
  const totalProducts = products?.length || 0;
  const totalOrders = orders?.length || 0;
  const totalRevenue = orders?.reduce((sum: number, o: any) => sum + Number(o.total), 0) || 0;
  const pendingOrders = orders?.filter((o: any) => o.status === "pendiente").length || 0;

  const stats = [
    { label: "Productos", value: totalProducts, icon: Package },
    { label: "Pedidos", value: totalOrders, icon: ShoppingCart },
    { label: "Ingresos", value: formatPrice(totalRevenue), icon: BarChart3 },
    { label: "Pendientes", value: pendingOrders, icon: Tag },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {stats.map(({ label, value, icon: Icon }) => (
        <div key={label} className="bg-card rounded-xl p-4" style={{ boxShadow: "var(--shadow-card)" }}>
          <Icon size={20} className="text-accent mb-2" />
          <p className="text-2xl font-heading font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      ))}
    </div>
  );
};

const ProductsTab = ({ products, categories, queryClient }: { products: any[]; categories: any[]; queryClient: any }) => {
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "", price: "", original_price: "", stock: "", unit: "unidad", category_id: "", is_fresh: false, is_wholesale: false });

  const resetForm = () => {
    setForm({ name: "", description: "", price: "", original_price: "", stock: "", unit: "unidad", category_id: "", is_fresh: false, is_wholesale: false });
    setEditing(null);
  };

  const editProduct = (p: any) => {
    setForm({
      name: p.name, description: p.description || "", price: String(p.price), original_price: p.original_price ? String(p.original_price) : "",
      stock: String(p.stock), unit: p.unit || "unidad", category_id: p.category_id || "", is_fresh: p.is_fresh, is_wholesale: p.is_wholesale,
    });
    setEditing(p.id);
  };

  const saveProduct = async () => {
    const payload = {
      name: form.name, description: form.description, price: Number(form.price),
      original_price: form.original_price ? Number(form.original_price) : null,
      stock: Number(form.stock), unit: form.unit, category_id: form.category_id || null,
      is_fresh: form.is_fresh, is_wholesale: form.is_wholesale,
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
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nombre" className="w-full bg-muted rounded-lg px-3 py-2 text-sm" />
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Descripción" className="w-full bg-muted rounded-lg px-3 py-2 text-sm" rows={2} />
          <div className="grid grid-cols-2 gap-2">
            <input value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} placeholder="Precio" type="number" className="bg-muted rounded-lg px-3 py-2 text-sm" />
            <input value={form.original_price} onChange={(e) => setForm({ ...form, original_price: e.target.value })} placeholder="Precio original" type="number" className="bg-muted rounded-lg px-3 py-2 text-sm" />
            <input value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} placeholder="Stock" type="number" className="bg-muted rounded-lg px-3 py-2 text-sm" />
            <input value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} placeholder="Unidad" className="bg-muted rounded-lg px-3 py-2 text-sm" />
          </div>
          <select value={form.category_id} onChange={(e) => setForm({ ...form, category_id: e.target.value })} className="w-full bg-muted rounded-lg px-3 py-2 text-sm">
            <option value="">Sin categoría</option>
            {categories?.map((c: any) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_fresh} onChange={(e) => setForm({ ...form, is_fresh: e.target.checked })} /> Fresco
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.is_wholesale} onChange={(e) => setForm({ ...form, is_wholesale: e.target.checked })} /> Mayorista
            </label>
          </div>
          <button onClick={saveProduct} className="btn-surte w-full text-sm py-2.5 flex items-center justify-center gap-1">
            <Save size={16} /> Guardar
          </button>
        </div>
      )}

      <div className="space-y-2">
        {products?.map((p: any) => (
          <div key={p.id} className="flex items-center gap-3 bg-card rounded-xl p-3" style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0 text-lg font-bold text-muted-foreground/40">
              {p.name.charAt(0)}
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

const CategoriesTab = ({ categories, queryClient }: { categories: any[]; queryClient: any }) => {
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", slug: "", icon: "Package", sort_order: "0" });

  const resetForm = () => { setForm({ name: "", slug: "", icon: "Package", sort_order: "0" }); setEditing(null); };

  const saveCategory = async () => {
    const payload = { name: form.name, slug: form.slug, icon: form.icon, sort_order: Number(form.sort_order) };
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
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") })} placeholder="Nombre" className="w-full bg-muted rounded-lg px-3 py-2 text-sm" />
          <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} placeholder="Slug" className="w-full bg-muted rounded-lg px-3 py-2 text-sm" />
          <div className="grid grid-cols-2 gap-2">
            <input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} placeholder="Icono" className="bg-muted rounded-lg px-3 py-2 text-sm" />
            <input value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} placeholder="Orden" type="number" className="bg-muted rounded-lg px-3 py-2 text-sm" />
          </div>
          <div className="flex gap-2">
            <button onClick={saveCategory} className="btn-surte flex-1 text-sm py-2"><Save size={14} /> Guardar</button>
            <button onClick={resetForm} className="bg-muted rounded-xl px-4 py-2 text-sm text-muted-foreground">Cancelar</button>
          </div>
        </div>
      )}
      <div className="space-y-2">
        {categories?.map((c: any) => (
          <div key={c.id} className="flex items-center gap-3 bg-card rounded-xl p-3" style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center text-accent font-bold">{c.name.charAt(0)}</div>
            <div className="flex-1"><p className="text-sm font-medium text-foreground">{c.name}</p><p className="text-xs text-muted-foreground">{c.slug}</p></div>
            <button onClick={() => { setForm({ name: c.name, slug: c.slug, icon: c.icon || "Package", sort_order: String(c.sort_order || 0) }); setEditing(c.id); }}><Pencil size={16} className="text-muted-foreground" /></button>
            <button onClick={() => deleteCategory(c.id)}><Trash2 size={16} className="text-destructive" /></button>
          </div>
        ))}
      </div>
    </div>
  );
};

const OrdersTab = ({ orders, queryClient }: { orders: any[]; queryClient: any }) => {
  const statuses = ["pendiente", "confirmado", "en_preparacion", "enviado", "entregado", "cancelado"];

  const updateStatus = async (orderId: string, status: string) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
    if (error) { toast.error(error.message); return; }
    toast.success(`Pedido actualizado a: ${status}`);
    queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
  };

  return (
    <div>
      <h2 className="font-heading font-bold text-lg text-foreground mb-4">Pedidos ({orders?.length || 0})</h2>
      {orders?.length === 0 && <p className="text-center py-8 text-muted-foreground">Sin pedidos aún</p>}
      <div className="space-y-3">
        {orders?.map((o: any) => (
          <div key={o.id} className="bg-card rounded-xl p-4 space-y-2" style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-heading font-bold text-foreground">Pedido #{o.order_number}</p>
                <p className="text-xs text-muted-foreground">{o.customer_name} · {o.customer_phone}</p>
              </div>
              <span className="text-sm font-heading font-bold text-foreground">{formatPrice(o.total)}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {o.order_items?.map((item: any) => (
                <span key={item.id} className="text-xs bg-muted rounded-full px-2 py-0.5">{item.quantity}x {item.product_name}</span>
              ))}
            </div>
            <select value={o.status} onChange={(e) => updateStatus(o.id, e.target.value)} className="w-full bg-muted rounded-lg px-3 py-2 text-sm">
              {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
};

const SettingsTab = ({ settings, queryClient }: { settings: any[]; queryClient: any }) => {
  const [values, setValues] = useState<Record<string, string>>({});

  useEffect(() => {
    if (settings) {
      const v: Record<string, string> = {};
      settings.forEach((s: any) => { v[s.key] = s.value; });
      setValues(v);
    }
  }, [settings]);

  const saveSetting = async (key: string) => {
    const { error } = await supabase.from("app_settings").update({ value: values[key] }).eq("key", key);
    if (error) { toast.error(error.message); return; }
    toast.success(`${key} actualizado`);
    queryClient.invalidateQueries({ queryKey: ["admin-settings"] });
    queryClient.invalidateQueries({ queryKey: ["app_settings"] });
  };

  const settingLabels: Record<string, string> = {
    min_order_amount: "Pedido Mínimo ($COP)",
    whatsapp_number: "Número WhatsApp",
    store_name: "Nombre de la Tienda",
  };

  return (
    <div>
      <h2 className="font-heading font-bold text-lg text-foreground mb-4">Configuración</h2>
      <div className="space-y-3">
        {Object.entries(values).map(([key, value]) => (
          <div key={key} className="bg-card rounded-xl p-4" style={{ boxShadow: "var(--shadow-card)" }}>
            <label className="text-xs text-muted-foreground mb-1 block">{settingLabels[key] || key}</label>
            <div className="flex gap-2">
              <input
                value={value}
                onChange={(e) => setValues({ ...values, [key]: e.target.value })}
                className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm"
              />
              <button onClick={() => saveSetting(key)} className="bg-accent text-accent-foreground rounded-lg px-3 py-2 text-sm font-medium">
                <Save size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AdminDashboard;
