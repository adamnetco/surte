import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import type { AppRole } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, Tag, ShoppingCart, Settings, BarChart3, FileText, Handshake, Bell, Users, Truck, Search, Layers, FileUp, Globe } from "lucide-react";
import { toast } from "sonner";
import AdminHeader from "@/components/admin/AdminHeader";
import OverviewTab from "@/components/admin/OverviewTab";
import ProductsTab from "@/components/admin/ProductsTab";
import CategoriesTab from "@/components/admin/CategoriesTab";
import OrdersTab from "@/components/admin/OrdersTab";
import SettingsTab from "@/components/admin/SettingsTab";
import ContentTab from "@/components/admin/ContentTab";
import BrandsTab from "@/components/admin/BrandsTab";
import NotificationsTab from "@/components/admin/NotificationsTab";
import UsersTab from "@/components/admin/UsersTab";
import ShippingTab from "@/components/admin/ShippingTab";
import HeroSlidesTab from "@/components/admin/HeroSlidesTab";
import SeoTab from "@/components/admin/SeoTab";
import InventoryTab from "@/components/admin/InventoryTab";
import LandingPagesTab from "@/components/admin/LandingPagesTab";

// Tabs visible per role
const allTabs = [
  { id: "overview", label: "Resumen", icon: BarChart3, roles: ["superadmin", "admin"] as AppRole[] },
  { id: "orders", label: "Pedidos", icon: ShoppingCart, roles: ["superadmin", "admin", "editor"] as AppRole[] },
  { id: "products", label: "Inventario", icon: Package, roles: ["superadmin", "admin", "editor"] as AppRole[] },
  { id: "categories", label: "Categorías", icon: Tag, roles: ["superadmin", "admin"] as AppRole[] },
  { id: "brands", label: "Marcas", icon: Handshake, roles: ["superadmin", "admin"] as AppRole[] },
  { id: "users", label: "Usuarios", icon: Users, roles: ["superadmin", "admin"] as AppRole[] },
  { id: "content", label: "Contenido", icon: FileText, roles: ["superadmin", "admin"] as AppRole[] },
  { id: "hero", label: "Hero", icon: Layers, roles: ["superadmin", "admin"] as AppRole[] },
  { id: "shipping", label: "Logística", icon: Truck, roles: ["superadmin", "admin"] as AppRole[] },
  { id: "notifications", label: "Alertas", icon: Bell, roles: ["superadmin", "admin"] as AppRole[] },
  { id: "seo", label: "SEO", icon: Search, roles: ["superadmin", "admin"] as AppRole[] },
  { id: "inventory", label: "Importar", icon: FileUp, roles: ["superadmin", "admin"] as AppRole[] },
  { id: "settings", label: "Ajustes", icon: Settings, roles: ["superadmin"] as AppRole[] },
];

const AdminDashboard = () => {
  const { user, isAdmin, role, loading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const queryClient = useQueryClient();

  // Filter tabs by role
  const tabs = allTabs.filter((t) => t.roles.includes(role));

  // Set default tab for editors
  useEffect(() => {
    if (!loading && role === "editor") {
      setActiveTab("orders");
    }
  }, [role, loading]);

  useEffect(() => {
    if (!loading && !user) {
      toast.error("Acceso denegado");
      navigate("/");
      return;
    }
    if (!loading && !["superadmin", "admin", "editor"].includes(role)) {
      toast.error("Acceso denegado");
      navigate("/");
    }
  }, [user, role, loading, navigate]);

  const hasAdminAccess = ["superadmin", "admin", "editor"].includes(role);

  const { data: products } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*, categories(name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: hasAdminAccess,
  });

  const { data: categories } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: hasAdminAccess,
  });

  const { data: orders } = useQuery({
    queryKey: ["admin-orders"],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders").select("*, order_items(*)").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: hasAdminAccess,
  });

  const { data: settings } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("*");
      if (error) throw error;
      return data;
    },
    enabled: hasAdminAccess,
  });

  // Realtime: listen for new orders
  useEffect(() => {
    if (!hasAdminAccess) return;
    const channel = supabase
      .channel("admin-orders-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [hasAdminAccess, queryClient]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground">Cargando...</p></div>;
  if (!hasAdminAccess) return null;

  const pendingCount = orders?.filter((o: any) => o.status === "pendiente").length || 0;

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />

      {/* Tab navigation */}
      <div className="flex overflow-x-auto border-b border-border bg-card scrollbar-hide">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => setActiveTab(id)}
            className={`relative flex items-center gap-1.5 px-4 py-3 text-xs font-heading font-semibold whitespace-nowrap border-b-2 transition-colors ${
              activeTab === id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}>
            <Icon size={15} />
            {label}
            {id === "orders" && pendingCount > 0 && (
              <span className="absolute -top-0.5 right-1 w-4 h-4 rounded-full bg-accent text-accent-foreground text-[9px] flex items-center justify-center font-bold">
                {pendingCount}
              </span>
            )}
          </button>
        ))}
      </div>

      <main className="p-4 pb-8">
        {activeTab === "overview" && <OverviewTab products={products} orders={orders} />}
        {activeTab === "orders" && <OrdersTab orders={orders} queryClient={queryClient} />}
        {activeTab === "products" && <ProductsTab products={products} categories={categories} queryClient={queryClient} />}
        {activeTab === "categories" && <CategoriesTab categories={categories} queryClient={queryClient} />}
        {activeTab === "brands" && <BrandsTab queryClient={queryClient} />}
        {activeTab === "users" && <UsersTab queryClient={queryClient} />}
        {activeTab === "content" && <ContentTab queryClient={queryClient} />}
        {activeTab === "hero" && <HeroSlidesTab queryClient={queryClient} />}
        {activeTab === "shipping" && <ShippingTab queryClient={queryClient} />}
        {activeTab === "notifications" && <NotificationsTab queryClient={queryClient} />}
        {activeTab === "seo" && <SeoTab settings={settings} queryClient={queryClient} />}
        {activeTab === "inventory" && <InventoryTab products={products} categories={categories} queryClient={queryClient} />}
        {activeTab === "settings" && <SettingsTab settings={settings} queryClient={queryClient} />}
      </main>
    </div>
  );
};

export default AdminDashboard;
