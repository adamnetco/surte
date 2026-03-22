import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import type { AppRole } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, Tag, ShoppingCart, Settings, BarChart3, FileText, Handshake, Bell, Users } from "lucide-react";
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

const tabs = [
  { id: "overview", label: "Resumen", icon: BarChart3 },
  { id: "orders", label: "Pedidos", icon: ShoppingCart },
  { id: "products", label: "Inventario", icon: Package },
  { id: "categories", label: "Categorías", icon: Tag },
  { id: "brands", label: "Marcas", icon: Handshake },
  { id: "content", label: "Contenido", icon: FileText },
  { id: "notifications", label: "Alertas", icon: Bell },
  { id: "settings", label: "Ajustes", icon: Settings },
];

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

  // Realtime: listen for new orders
  useEffect(() => {
    if (!isAdmin) return;
    const channel = supabase
      .channel("admin-orders-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [isAdmin, queryClient]);

  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground">Cargando...</p></div>;
  if (!isAdmin) return null;

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
        {activeTab === "content" && <ContentTab queryClient={queryClient} />}
        {activeTab === "notifications" && <NotificationsTab queryClient={queryClient} />}
        {activeTab === "settings" && <SettingsTab settings={settings} queryClient={queryClient} />}
      </main>
    </div>
  );
};

export default AdminDashboard;
