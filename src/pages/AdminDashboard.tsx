import { useState, useEffect, Component, lazy, Suspense, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import type { AppRole } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, Tag, ShoppingCart, Settings, BarChart3, FileText, Handshake, Bell, Users, Truck, Search, Layers, FileUp, Globe, Code, Ticket, Box, Star, MapPin, MessageSquare, Map, Database, CalendarDays, ToggleRight, Building2, Monitor, Utensils, ChefHat, Receipt, ShoppingBag, Warehouse, CreditCard, Wallet, Key, Sparkles, BookOpen, Rocket, ChevronRight, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useOrganization } from "@/context/OrganizationContext";
import AdminHeader from "@/components/admin/AdminHeader";

const ModulesTab = lazy(() => import("@/components/admin/ModulesTab"));
const AgendaTab = lazy(() => import("@/components/admin/AgendaTab"));
const OverviewTab = lazy(() => import("@/components/admin/OverviewTab"));
const ProductsTab = lazy(() => import("@/components/admin/ProductsTab"));
const CategoriesTab = lazy(() => import("@/components/admin/CategoriesTab"));
const OrdersTab = lazy(() => import("@/components/admin/OrdersTab"));
const SettingsTab = lazy(() => import("@/components/admin/SettingsTab"));
const ContentTab = lazy(() => import("@/components/admin/ContentTab"));
const BrandsTab = lazy(() => import("@/components/admin/BrandsTab"));
const NotificationsTab = lazy(() => import("@/components/admin/NotificationsTab"));
const UsersTab = lazy(() => import("@/components/admin/UsersTab"));
const ShippingTab = lazy(() => import("@/components/admin/ShippingTab"));
const HeroSlidesTab = lazy(() => import("@/components/admin/HeroSlidesTab"));
const SeoTab = lazy(() => import("@/components/admin/SeoTab"));
const InventoryTab = lazy(() => import("@/components/admin/InventoryTab"));
const LandingPagesTab = lazy(() => import("@/components/admin/LandingPagesTab"));
const ScriptsTab = lazy(() => import("@/components/admin/ScriptsTab"));
const CouponsTab = lazy(() => import("@/components/admin/CouponsTab"));
const PresentationsTab = lazy(() => import("@/components/admin/PresentationsTab"));
const FeaturedSectionsTab = lazy(() => import("@/components/admin/FeaturedSectionsTab"));
const MunicipalitiesTab = lazy(() => import("@/components/admin/MunicipalitiesTab"));
const CustomerReviewsTab = lazy(() => import("@/components/admin/CustomerReviewsTab"));
const GoogleReviewsTab = lazy(() => import("@/components/admin/GoogleReviewsTab"));
const DataManagementTab = lazy(() => import("@/components/admin/DataManagementTab"));
const ModifiersTab = lazy(() => import("@/components/admin/ModifiersTab"));
const SeoContentTab = lazy(() => import("@/components/admin/SeoContentTab"));
const CrmLeadsTab = lazy(() => import("@/components/admin/CrmLeadsTab"));
const SyncStatusTable = lazy(() => import("@/components/admin/SyncStatusTable"));
const DeadLetterQueue = lazy(() => import("@/components/admin/DeadLetterQueue"));
const SyncMonitor = lazy(() => import("@/components/admin/SyncMonitor"));
const OrganizationsTab = lazy(() => import("@/components/admin/OrganizationsTab"));
const ContactsTab = lazy(() => import("@/components/admin/ContactsTab"));
const FiscalSettingsTab = lazy(() => import("@/components/admin/FiscalSettingsTab"));

// Pestañas OPERATIVAS del negocio (no multi-tenant).
// Las que tocan multi-tenant viven en /superadmin: Tiendas, Módulos,
// Fiscal global, Sincronización, Datos masivos, Ajustes globales.
const allTabs = [
  { id: "overview", label: "Resumen", icon: BarChart3, roles: ["superadmin", "admin"] as AppRole[], module: null as string | null },
  { id: "orders", label: "Pedidos", icon: ShoppingCart, roles: ["superadmin", "admin", "editor"] as AppRole[], module: null },
  { id: "agenda", label: "Agenda", icon: CalendarDays, roles: ["superadmin", "admin", "editor"] as AppRole[], module: "agenda" },
  { id: "products", label: "Inventario", icon: Package, roles: ["superadmin", "admin", "editor"] as AppRole[], module: null },
  { id: "categories", label: "Categorías", icon: Tag, roles: ["superadmin", "admin"] as AppRole[], module: null },
  { id: "brands", label: "Marcas", icon: Handshake, roles: ["superadmin", "admin"] as AppRole[], module: null },
  { id: "users", label: "Usuarios", icon: Users, roles: ["superadmin", "admin"] as AppRole[], module: null },
  { id: "contacts", label: "Contactos", icon: Users, roles: ["superadmin", "admin"] as AppRole[], module: null },
  { id: "crm", label: "CRM Leads", icon: MessageSquare, roles: ["superadmin", "admin"] as AppRole[], module: null },
  { id: "content", label: "Contenido", icon: FileText, roles: ["superadmin", "admin"] as AppRole[], module: null },
  { id: "hero", label: "Hero", icon: Layers, roles: ["superadmin", "admin"] as AppRole[], module: null },
  { id: "municipalities", label: "Ciudades", icon: MapPin, roles: ["superadmin", "admin"] as AppRole[], module: null },
  { id: "shipping", label: "Logística", icon: Truck, roles: ["superadmin", "admin"] as AppRole[], module: null },
  { id: "notifications", label: "Alertas", icon: Bell, roles: ["superadmin", "admin"] as AppRole[], module: null },
  { id: "seo", label: "SEO", icon: Search, roles: ["superadmin", "admin"] as AppRole[], module: null },
  { id: "seo-content", label: "SEO Long", icon: FileText, roles: ["superadmin", "admin", "editor"] as AppRole[], module: null },
  { id: "inventory", label: "Importar", icon: FileUp, roles: ["superadmin", "admin"] as AppRole[], module: null },
  { id: "landing", label: "SEO Pages", icon: Globe, roles: ["superadmin", "admin"] as AppRole[], module: null },
  { id: "presentations", label: "Presentaciones", icon: Box, roles: ["superadmin", "admin"] as AppRole[], module: null },
  { id: "modifiers", label: "Modificadores", icon: Settings, roles: ["superadmin", "admin"] as AppRole[], module: null },
  { id: "featured", label: "Destacados", icon: Star, roles: ["superadmin", "admin"] as AppRole[], module: null },
  { id: "coupons", label: "Cupones", icon: Ticket, roles: ["superadmin", "admin"] as AppRole[], module: null },
  { id: "reviews", label: "Comentarios", icon: MessageSquare, roles: ["superadmin", "admin", "editor"] as AppRole[], module: null },
  { id: "google-reviews", label: "Google", icon: Map, roles: ["superadmin", "admin", "editor"] as AppRole[], module: null },
  { id: "scripts", label: "Scripts", icon: Code, roles: ["superadmin", "admin"] as AppRole[], module: null },
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

const operationsLinks = [
  { path: "/sitios", label: "Sitios / Multi-tenant", icon: Building2, roles: ["superadmin", "admin"] as AppRole[] },
  { path: "/pos", label: "POS", icon: Monitor, roles: ["superadmin", "admin", "editor"] as AppRole[] },
  { path: "/mesas", label: "Mesas", icon: Utensils, roles: ["superadmin", "admin", "editor"] as AppRole[] },
  { path: "/kds", label: "KDS (Cocina)", icon: ChefHat, roles: ["superadmin", "admin", "editor"] as AppRole[] },
  { path: "/facturacion", label: "Facturación", icon: Receipt, roles: ["superadmin", "admin"] as AppRole[] },
  { path: "/compras", label: "Compras", icon: ShoppingBag, roles: ["superadmin", "admin"] as AppRole[] },
  { path: "/inventario", label: "Inventario Avanzado", icon: Warehouse, roles: ["superadmin", "admin"] as AppRole[] },
  { path: "/planes", label: "Planes", icon: CreditCard, roles: ["superadmin", "admin"] as AppRole[] },
  { path: "/billing", label: "Billing", icon: Wallet, roles: ["superadmin", "admin"] as AppRole[] },
  { path: "/licencias", label: "Licencias", icon: Key, roles: ["superadmin"] as AppRole[] },
  { path: "/gerente-ia", label: "Gerente IA", icon: Sparkles, roles: ["superadmin", "admin"] as AppRole[] },
  { path: "/catalogos-base", label: "Catálogos Base", icon: BookOpen, roles: ["superadmin"] as AppRole[] },
  { path: "/onboarding", label: "Onboarding", icon: Rocket, roles: ["superadmin", "admin"] as AppRole[] },
];

const AdminDashboard = () => {
  const { user, isAdmin, role, loading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const queryClient = useQueryClient();

  const { hasModule } = useOrganization();
  const tabs = allTabs.filter((t) => t.roles.includes(role) && (!t.module || hasModule(t.module)));
  const opsLinks = operationsLinks.filter((l) => l.roles.includes(role));

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
      <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Cargando módulo…</div>}>
        {activeTab === "overview" && <OverviewTab products={products} orders={orders} />}
        {activeTab === "orders" && <OrdersTab orders={orders} queryClient={queryClient} />}
        {activeTab === "agenda" && <AgendaTab />}
        {activeTab === "modules" && <ModulesTab />}
        {activeTab === "products" && <ProductsTab products={products} categories={categories} queryClient={queryClient} />}
        {activeTab === "categories" && <CategoriesTab categories={categories} queryClient={queryClient} />}
        {activeTab === "brands" && <BrandsTab queryClient={queryClient} />}
        {activeTab === "users" && <UsersTab queryClient={queryClient} />}
        {activeTab === "contacts" && <ContactsTab />}
        {activeTab === "organizations" && <OrganizationsTab />}
        {activeTab === "crm" && <CrmLeadsTab />}
        {activeTab === "content" && <ContentTab queryClient={queryClient} />}
        {activeTab === "hero" && <HeroSlidesTab queryClient={queryClient} />}
        {activeTab === "municipalities" && <MunicipalitiesTab queryClient={queryClient} />}
        {activeTab === "shipping" && <ShippingTab queryClient={queryClient} />}
        {activeTab === "notifications" && <NotificationsTab queryClient={queryClient} />}
        {activeTab === "seo" && <SeoTab settings={settings} queryClient={queryClient} />}
        {activeTab === "seo-content" && <SeoContentTab queryClient={queryClient} />}
        {activeTab === "inventory" && <InventoryTab products={products} categories={categories} queryClient={queryClient} />}
        {activeTab === "landing" && <LandingPagesTab />}
        {activeTab === "presentations" && <PresentationsTab queryClient={queryClient} />}
        {activeTab === "modifiers" && <ModifiersTab />}
        {activeTab === "featured" && <FeaturedSectionsTab queryClient={queryClient} />}
        {activeTab === "coupons" && <CouponsTab queryClient={queryClient} />}
        {activeTab === "reviews" && <CustomerReviewsTab queryClient={queryClient} />}
        {activeTab === "google-reviews" && <GoogleReviewsTab queryClient={queryClient} />}
        {activeTab === "scripts" && <ScriptsTab queryClient={queryClient} />}
        {activeTab === "data" && <DataManagementTab />}
        {activeTab === "sync" && (
          <div className="space-y-4">
            <SyncStatusTable />
            <SyncMonitor />
            <DeadLetterQueue />
          </div>
        )}
        {activeTab === "fiscal" && <FiscalSettingsTab />}
        {activeTab === "settings" && <SettingsTab settings={settings} queryClient={queryClient} />}
      </Suspense>
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
        {opsLinks.length > 0 && (
          <div className="mb-4 -mx-4 px-4 pb-3 border-b border-border">
            <p className="text-[10px] font-heading font-bold text-muted-foreground uppercase tracking-wider mb-2">Operaciones y Multi-tenant</p>
            <div className="flex gap-2 overflow-x-auto scrollbar-hide">
              {opsLinks.map(({ path, label, icon: Icon }) => (
                <button
                  key={path}
                  onClick={() => navigate(path)}
                  className="shrink-0 flex flex-col items-center gap-1 px-3 py-2 rounded-lg bg-muted hover:bg-muted/80 transition-colors min-w-[72px]"
                >
                  <Icon size={18} className="text-primary" />
                  <span className="text-[10px] font-medium text-center leading-tight">{label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
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

            {opsLinks.length > 0 && (
              <>
                <div className="mt-4 px-4 pt-3 pb-1 border-t border-border">
                  <p className="text-[10px] font-heading font-bold text-muted-foreground uppercase tracking-wider">Operaciones</p>
                </div>
                {opsLinks.map(({ path, label, icon: Icon }) => (
                  <button
                    key={path}
                    onClick={() => navigate(path)}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                  >
                    <Icon size={16} />
                    <span className="flex-1 text-left">{label}</span>
                    <ChevronRight size={14} className="opacity-50" />
                  </button>
                ))}
              </>
            )}
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
