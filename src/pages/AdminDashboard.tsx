import { useState, useEffect, Component, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import type { AppRole } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, Tag, ShoppingCart, Settings, BarChart3, FileText, Handshake, Bell, Users, Truck, Search, Layers, FileUp, Globe, Code, Ticket, Box, Star, MapPin, MessageSquare, Map, Database } from "lucide-react";
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
import ScriptsTab from "@/components/admin/ScriptsTab";
import CouponsTab from "@/components/admin/CouponsTab";
import PresentationsTab from "@/components/admin/PresentationsTab";
import FeaturedSectionsTab from "@/components/admin/FeaturedSectionsTab";
import MunicipalitiesTab from "@/components/admin/MunicipalitiesTab";
import CustomerReviewsTab from "@/components/admin/CustomerReviewsTab";
import GoogleReviewsTab from "@/components/admin/GoogleReviewsTab";
import DataManagementTab from "@/components/admin/DataManagementTab";

const allTabs = [
  { id: "overview", label: "Resumen", icon: BarChart3, roles: ["superadmin", "admin"] as AppRole[] },
  { id: "orders", label: "Pedidos", icon: ShoppingCart, roles: ["superadmin", "admin", "editor"] as AppRole[] },
  { id: "products", label: "Inventario", icon: Package, roles: ["superadmin", "admin", "editor"] as AppRole[] },
  { id: "categories", label: "Categorías", icon: Tag, roles: ["superadmin", "admin"] as AppRole[] },
  { id: "brands", label: "Marcas", icon: Handshake, roles: ["superadmin", "admin"] as AppRole[] },
  { id: "users", label: "Usuarios", icon: Users, roles: ["superadmin", "admin"] as AppRole[] },
  { id: "content", label: "Contenido", icon: FileText, roles: ["superadmin", "admin"] as AppRole[] },
  { id: "hero", label: "Hero", icon: Layers, roles: ["superadmin", "admin"] as AppRole[] },
  { id: "municipalities", label: "Ciudades", icon: MapPin, roles: ["superadmin", "admin"] as AppRole[] },
  { id: "shipping", label: "Logística", icon: Truck, roles: ["superadmin", "admin"] as AppRole[] },
  { id: "notifications", label: "Alertas", icon: Bell, roles: ["superadmin", "admin"] as AppRole[] },
  { id: "seo", label: "SEO", icon: Search, roles: ["superadmin", "admin"] as AppRole[] },
  { id: "inventory", label: "Importar", icon: FileUp, roles: ["superadmin", "admin"] as AppRole[] },
  { id: "landing", label: "SEO Pages", icon: Globe, roles: ["superadmin", "admin"] as AppRole[] },
  { id: "presentations", label: "Presentaciones", icon: Box, roles: ["superadmin", "admin"] as AppRole[] },
  { id: "featured", label: "Destacados", icon: Star, roles: ["superadmin", "admin"] as AppRole[] },
  { id: "coupons", label: "Cupones", icon: Ticket, roles: ["superadmin", "admin"] as AppRole[] },
  { id: "reviews", label: "Comentarios", icon: MessageSquare, roles: ["superadmin", "admin", "editor"] as AppRole[] },
  { id: "google-reviews", label: "Google", icon: Map, roles: ["superadmin", "admin", "editor"] as AppRole[] },
  { id: "scripts", label: "Scripts", icon: Code, roles: ["superadmin", "admin"] as AppRole[] },
  { id: "settings", label: "Ajustes", icon: Settings, roles: ["superadmin"] as AppRole[] },
];

class TabErrorBoundary extends Component<{ children: ReactNode; tabName: string }, { hasError: boolean; error: string }> {
  constructor(props: any) { super(props); this.state = { hasError: false, error: "" }; }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error: error.message }; }
  componentDidCatch(error: Error) { console.error(`[Admin Tab Error]`, error); }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-center space-y-3">
          <p className="text-destructive font-heading font-semibold">Error al cargar "{this.props.tabName}"</p>
          <p className="text-sm text-muted-foreground">{this.state.error}</p>
          <button onClick={() => this.setState({ hasError: false, error: "" })} className="btn-surte text-sm px-4 py-2">Reintentar</button>
        </div>
      );
    }
    return this.props.children;
  }
}

const AdminDashboard = () => {
  const { user, isAdmin, role, loading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const queryClient = useQueryClient();

  const tabs = allTabs.filter((t) => t.roles.includes(role));

  useEffect(() => {
    if (!loading && role === "editor") setActiveTab("orders");
  }, [role, loading]);

  useEffect(() => {
    if (!loading && !user) { toast.error("Acceso denegado"); navigate("/"); return; }
    if (!loading && !["superadmin", "admin", "editor"].includes(role)) { toast.error("Acceso denegado"); navigate("/"); }
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

  const renderContent = () => (
    <TabErrorBoundary tabName={tabs.find(t => t.id === activeTab)?.label || activeTab} key={activeTab}>
      {activeTab === "overview" && <OverviewTab products={products} orders={orders} />}
      {activeTab === "orders" && <OrdersTab orders={orders} queryClient={queryClient} />}
      {activeTab === "products" && <ProductsTab products={products} categories={categories} queryClient={queryClient} />}
      {activeTab === "categories" && <CategoriesTab categories={categories} queryClient={queryClient} />}
      {activeTab === "brands" && <BrandsTab queryClient={queryClient} />}
      {activeTab === "users" && <UsersTab queryClient={queryClient} />}
      {activeTab === "content" && <ContentTab queryClient={queryClient} />}
      {activeTab === "hero" && <HeroSlidesTab queryClient={queryClient} />}
      {activeTab === "municipalities" && <MunicipalitiesTab queryClient={queryClient} />}
      {activeTab === "shipping" && <ShippingTab queryClient={queryClient} />}
      {activeTab === "notifications" && <NotificationsTab queryClient={queryClient} />}
      {activeTab === "seo" && <SeoTab settings={settings} queryClient={queryClient} />}
      {activeTab === "inventory" && <InventoryTab products={products} categories={categories} queryClient={queryClient} />}
      {activeTab === "landing" && <LandingPagesTab />}
      {activeTab === "presentations" && <PresentationsTab queryClient={queryClient} />}
      {activeTab === "featured" && <FeaturedSectionsTab queryClient={queryClient} />}
      {activeTab === "coupons" && <CouponsTab queryClient={queryClient} />}
      {activeTab === "reviews" && <CustomerReviewsTab queryClient={queryClient} />}
      {activeTab === "google-reviews" && <GoogleReviewsTab queryClient={queryClient} />}
      {activeTab === "scripts" && <ScriptsTab queryClient={queryClient} />}
      {activeTab === "settings" && <SettingsTab settings={settings} queryClient={queryClient} />}
    </TabErrorBoundary>
  );

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />

      {/* Mobile: horizontal tab scroll */}
      <div className="lg:hidden flex overflow-x-auto border-b border-border bg-card scrollbar-hide">
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

      {/* Mobile content */}
      <main className="lg:hidden p-4 pb-8">
        {renderContent()}
      </main>

      {/* Desktop: sidebar + content */}
      <div className="hidden lg:flex">
        {/* Sidebar */}
        <aside className="w-56 xl:w-64 shrink-0 border-r border-border bg-card min-h-[calc(100vh-56px)] sticky top-[56px] overflow-y-auto">
          <nav className="py-2">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveTab(id)}
                className={`w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-colors relative ${
                  activeTab === id
                    ? "bg-primary/10 text-primary border-r-2 border-primary"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                }`}
              >
                <Icon size={16} />
                {label}
                {id === "orders" && pendingCount > 0 && (
                  <span className="ml-auto w-5 h-5 rounded-full bg-accent text-accent-foreground text-[10px] flex items-center justify-center font-bold">
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </nav>
        </aside>

        {/* Content area */}
        <main className="flex-1 p-6 pb-8 min-w-0 overflow-x-hidden">
          {renderContent()}
        </main>
      </div>
    </div>
  );
};

export default AdminDashboard;
