import { useState, useEffect, Component, lazy, Suspense, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/modules/auth/context/AuthContext";
import type { AppRole } from "@/modules/auth/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Package, Tag, ShoppingCart, Settings, BarChart3, FileText, Handshake, Bell, Users, Truck, Search, Layers, FileUp, Globe, Code, Ticket, Box, Star, MapPin, MessageSquare, Map, CalendarDays, Monitor, Utensils, ChefHat, Receipt, ShoppingBag, Warehouse, CreditCard, Wallet, Sparkles, Rocket, ChevronRight, Building2, Printer } from "lucide-react";
import { toast } from "sonner";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";
import AdminHeader from "@/modules/admin-cms/components/AdminHeader";

const AgendaTab = lazy(() => import("@/modules/admin-cms/components/AgendaTab"));
const OverviewTab = lazy(() => import("@/modules/admin-cms/components/OverviewTab"));
const ProductsTab = lazy(() => import("@/modules/admin-cms/components/ProductsTab"));
const CategoriesTab = lazy(() => import("@/modules/admin-cms/components/CategoriesTab"));
const OrdersTab = lazy(() => import("@/modules/admin-cms/components/OrdersTab"));
const SettingsTab = lazy(() => import("@/modules/admin-cms/components/SettingsTab"));
const ContentTab = lazy(() => import("@/modules/admin-cms/components/ContentTab"));
const BrandsTab = lazy(() => import("@/modules/admin-cms/components/BrandsTab"));
const NotificationsTab = lazy(() => import("@/modules/admin-cms/components/NotificationsTab"));
const UsersTab = lazy(() => import("@/modules/admin-cms/components/UsersTab"));
const ShippingTab = lazy(() => import("@/modules/admin-cms/components/ShippingTab"));
const HeroSlidesTab = lazy(() => import("@/modules/admin-cms/components/HeroSlidesTab"));
const SeoTab = lazy(() => import("@/modules/admin-cms/components/SeoTab"));
const InventoryTab = lazy(() => import("@/modules/admin-cms/components/InventoryTab"));
const LandingPagesTab = lazy(() => import("@/modules/admin-cms/components/LandingPagesTab"));
const ScriptsTab = lazy(() => import("@/modules/admin-cms/components/ScriptsTab"));
const CouponsTab = lazy(() => import("@/modules/admin-cms/components/CouponsTab"));
const PresentationsTab = lazy(() => import("@/modules/admin-cms/components/PresentationsTab"));
const FeaturedSectionsTab = lazy(() => import("@/modules/admin-cms/components/FeaturedSectionsTab"));
const MunicipalitiesTab = lazy(() => import("@/modules/admin-cms/components/MunicipalitiesTab"));
const CustomerReviewsTab = lazy(() => import("@/modules/admin-cms/components/CustomerReviewsTab"));
const GoogleReviewsTab = lazy(() => import("@/modules/admin-cms/components/GoogleReviewsTab"));
const ModifiersTab = lazy(() => import("@/modules/admin-cms/components/ModifiersTab"));
const SeoContentTab = lazy(() => import("@/modules/admin-cms/components/SeoContentTab"));
const CrmLeadsTab = lazy(() => import("@/modules/admin-cms/components/CrmLeadsTab"));
const ContactsTab = lazy(() => import("@/modules/admin-cms/components/ContactsTab"));
const PrintersTab = lazy(() => import("@/modules/printing/components/PrintersManagerTab").then(m => ({ default: m.PrintersManagerTab })));
const KitchenRoutingTab = lazy(() => import("@/modules/printing/components/KitchenRoutingTab").then(m => ({ default: m.KitchenRoutingTab })));

// Pestañas OPERATIVAS del negocio (no multi-tenant).
// Las que tocan multi-tenant viven en /superadmin: Tiendas, Módulos,
// Fiscal global, Sincronización, Datos masivos, Ajustes globales.
type TabGroup = "ventas" | "catalogo" | "clientes" | "contenido" | "marketing" | "operacion";
const GROUP_LABELS: Record<TabGroup, string> = {
  ventas: "Ventas",
  catalogo: "Catálogo",
  clientes: "Clientes",
  contenido: "Contenido",
  marketing: "Marketing y SEO",
  operacion: "Operación",
};
const GROUP_ORDER: TabGroup[] = ["ventas", "catalogo", "clientes", "contenido", "marketing", "operacion"];

const allTabs = [
  { id: "overview", label: "Resumen", icon: BarChart3, roles: ["superadmin", "admin"] as AppRole[], module: null as string | null, group: "ventas" as TabGroup },
  { id: "orders", label: "Pedidos", icon: ShoppingCart, roles: ["superadmin", "admin", "editor"] as AppRole[], module: null, group: "ventas" as TabGroup },
  { id: "agenda", label: "Agenda", icon: CalendarDays, roles: ["superadmin", "admin", "editor"] as AppRole[], module: "agenda", group: "ventas" as TabGroup },
  { id: "products", label: "Inventario", icon: Package, roles: ["superadmin", "admin", "editor"] as AppRole[], module: null, group: "catalogo" as TabGroup },
  { id: "categories", label: "Categorías", icon: Tag, roles: ["superadmin", "admin"] as AppRole[], module: null, group: "catalogo" as TabGroup },
  { id: "brands", label: "Marcas", icon: Handshake, roles: ["superadmin", "admin"] as AppRole[], module: null, group: "catalogo" as TabGroup },
  { id: "presentations", label: "Presentaciones", icon: Box, roles: ["superadmin", "admin"] as AppRole[], module: null, group: "catalogo" as TabGroup },
  { id: "modifiers", label: "Modificadores", icon: Settings, roles: ["superadmin", "admin"] as AppRole[], module: null, group: "catalogo" as TabGroup },
  { id: "inventory", label: "Importar", icon: FileUp, roles: ["superadmin", "admin"] as AppRole[], module: null, group: "catalogo" as TabGroup },
  { id: "users", label: "Usuarios", icon: Users, roles: ["superadmin", "admin"] as AppRole[], module: null, group: "clientes" as TabGroup },
  { id: "contacts", label: "Contactos", icon: Users, roles: ["superadmin", "admin"] as AppRole[], module: null, group: "clientes" as TabGroup },
  { id: "crm", label: "CRM Leads", icon: MessageSquare, roles: ["superadmin", "admin"] as AppRole[], module: null, group: "clientes" as TabGroup },
  { id: "reviews", label: "Comentarios", icon: MessageSquare, roles: ["superadmin", "admin", "editor"] as AppRole[], module: null, group: "clientes" as TabGroup },
  { id: "google-reviews", label: "Google", icon: Map, roles: ["superadmin", "admin", "editor"] as AppRole[], module: null, group: "clientes" as TabGroup },
  { id: "notifications", label: "Alertas", icon: Bell, roles: ["superadmin", "admin"] as AppRole[], module: null, group: "clientes" as TabGroup },
  { id: "content", label: "Contenido", icon: FileText, roles: ["superadmin", "admin"] as AppRole[], module: null, group: "contenido" as TabGroup },
  { id: "hero", label: "Hero", icon: Layers, roles: ["superadmin", "admin"] as AppRole[], module: null, group: "contenido" as TabGroup },
  { id: "featured", label: "Destacados", icon: Star, roles: ["superadmin", "admin"] as AppRole[], module: null, group: "contenido" as TabGroup },
  { id: "landing", label: "SEO Pages", icon: Globe, roles: ["superadmin", "admin"] as AppRole[], module: null, group: "contenido" as TabGroup },
  { id: "seo", label: "SEO", icon: Search, roles: ["superadmin", "admin"] as AppRole[], module: null, group: "marketing" as TabGroup },
  { id: "seo-content", label: "SEO Long", icon: FileText, roles: ["superadmin", "admin", "editor"] as AppRole[], module: null, group: "marketing" as TabGroup },
  { id: "coupons", label: "Cupones", icon: Ticket, roles: ["superadmin", "admin"] as AppRole[], module: null, group: "marketing" as TabGroup },
  { id: "scripts", label: "Scripts", icon: Code, roles: ["superadmin", "admin"] as AppRole[], module: null, group: "marketing" as TabGroup },
  { id: "municipalities", label: "Ciudades", icon: MapPin, roles: ["superadmin", "admin"] as AppRole[], module: null, group: "operacion" as TabGroup },
  { id: "shipping", label: "Logística", icon: Truck, roles: ["superadmin", "admin"] as AppRole[], module: null, group: "operacion" as TabGroup },
  { id: "printers", label: "Impresoras", icon: Printer, roles: ["superadmin", "admin"] as AppRole[], module: null, group: "operacion" as TabGroup },
  { id: "kitchen-routing", label: "Cocina", icon: ChefHat, roles: ["superadmin", "admin"] as AppRole[], module: null, group: "operacion" as TabGroup },
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

// Solo enlaces operativos del negocio. Sitios, Licencias, Catálogos Base viven en /superadmin.
const operationsLinks = [
  { path: "/pos", label: "POS", icon: Monitor, roles: ["superadmin", "admin", "editor"] as AppRole[] },
  { path: "/mesas", label: "Mesas", icon: Utensils, roles: ["superadmin", "admin", "editor"] as AppRole[] },
  { path: "/kds", label: "KDS (Cocina)", icon: ChefHat, roles: ["superadmin", "admin", "editor"] as AppRole[] },
  { path: "/facturacion", label: "Facturación", icon: Receipt, roles: ["superadmin", "admin"] as AppRole[] },
  { path: "/compras", label: "Compras", icon: ShoppingBag, roles: ["superadmin", "admin"] as AppRole[] },
  { path: "/inventario", label: "Inventario Avanzado", icon: Warehouse, roles: ["superadmin", "admin"] as AppRole[] },
  { path: "/planes", label: "Planes", icon: CreditCard, roles: ["superadmin", "admin"] as AppRole[] },
  { path: "/billing", label: "Billing", icon: Wallet, roles: ["superadmin", "admin"] as AppRole[] },
  { path: "/gerente-ia", label: "Gerente IA", icon: Sparkles, roles: ["superadmin", "admin"] as AppRole[] },
  { path: "/onboarding", label: "Onboarding", icon: Rocket, roles: ["superadmin", "admin"] as AppRole[] },
];

const AdminDashboard = () => {
  const { user, isAdmin, role, loading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("overview");
  const [tabFilter, setTabFilter] = useState("");
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();


  const { hasModule, currentOrg } = useOrganization();
  const tabs = allTabs.filter((t) => t.roles.includes(role) && (!t.module || hasModule(t.module)));
  const opsLinks = operationsLinks.filter((l) => l.roles.includes(role));

  useEffect(() => {
    if (!loading && role === "editor") setActiveTab("orders");
  }, [role, loading]);

  // Sync activeTab ⇄ ?tab=... — habilita deep-linking desde el Command Palette.
  useEffect(() => {
    const q = searchParams.get("tab");
    if (q && q !== activeTab && tabs.some((t) => t.id === q)) setActiveTab(q);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, tabs.length]);

  const selectTab = (id: string) => {
    setActiveTab(id);
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", id);
      return next;
    }, { replace: true });
  };

  useEffect(() => {
    if (!loading && !user) { toast.error("Acceso denegado"); navigate("/"); return; }
    if (!loading && !["superadmin", "admin", "editor"].includes(role)) { toast.error("Acceso denegado"); navigate("/"); }
  }, [user, role, loading, navigate]);

  const hasAdminAccess = ["superadmin", "admin", "editor"].includes(role);

  // Perf: limit + columnas explícitas. Antes traíamos `*, categories(name)` sin
  // límite — con catálogos grandes esto pega el cap de 1000 y satura memoria
  // del cliente. 500 cubre la UI; el resto se paginará dentro de cada tab.
  const { data: products } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("id,name,slug,price,cost_price,price_wholesale,stock,is_active,category_id,brand,image_url,sku,gtin,created_at,categories(name)")
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return data;
    },
    enabled: hasAdminAccess,
    staleTime: 2 * 60_000,
  });

  const { data: categories } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: hasAdminAccess,
    staleTime: 5 * 60_000,
  });

  // Perf: dividir orders en (1) lista ligera para listado y (2) detalle on-demand.
  // El join `order_items(*)` por defecto multiplica filas y RAM; lo cargamos solo
  // si la tab activa lo necesita. Limit 200 cubre el rango operativo del día.
  const ordersHasItems = activeTab === "orders" || activeTab === "overview";
  const { data: orders } = useQuery({
    queryKey: ["admin-orders", ordersHasItems ? "with-items" : "light"],
    queryFn: async () => {
      const select = ordersHasItems ? "*, order_items(*)" : "*";
      const { data, error } = await supabase
        .from("orders")
        .select(select)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
    enabled: hasAdminAccess,
    staleTime: 30_000,
  });

  const { data: settings } = useQuery({
    queryKey: ["admin-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("*");
      if (error) throw error;
      return data;
    },
    enabled: hasAdminAccess,
    staleTime: 10 * 60_000,
  });

  useEffect(() => {
    if (!hasAdminAccess) return;
    // Perf: en horas pico llegan ráfagas de eventos (estado de pedido, items,
    // pagos). Antes invalidábamos en CADA evento → tormenta de refetches del
    // join pesado `orders + order_items`. Debounce 800ms agrupa la ráfaga en
    // un solo refetch sin perder reactividad perceptible.
    let timer: ReturnType<typeof setTimeout> | null = null;
    const scheduleInvalidate = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
        timer = null;
      }, 800);
    };
    const channel = supabase
      .channel("admin-orders-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, scheduleInvalidate)
      .subscribe();
    return () => {
      if (timer) clearTimeout(timer);
      supabase.removeChannel(channel);
    };
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
        {/* modules tab removed — vive en /superadmin */}
        {activeTab === "products" && <ProductsTab products={products} categories={categories} queryClient={queryClient} />}
        {activeTab === "categories" && <CategoriesTab categories={categories} queryClient={queryClient} />}
        {activeTab === "brands" && <BrandsTab queryClient={queryClient} />}
        {activeTab === "users" && <UsersTab queryClient={queryClient} />}
        {activeTab === "contacts" && <ContactsTab />}
        {/* organizations tab removed — vive en /superadmin */}
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
        {activeTab === "printers" && <PrintersTab organizationId={currentOrg?.id ?? ""} />}
        {activeTab === "kitchen-routing" && <KitchenRoutingTab organizationId={currentOrg?.id ?? ""} />}
        {/* data / sync / fiscal removidos — viven en /superadmin */}
        {activeTab === "settings" && <SettingsTab settings={settings} queryClient={queryClient} />}
      </Suspense>
    </TabErrorBoundary>
  );

  return (
    <div className="min-h-screen bg-background">
      <AdminHeader />

      {role === "superadmin" && (
        <div className="border-b border-primary/20 bg-primary/5 px-4 py-2 flex items-center justify-between gap-3">
          <p className="text-xs text-primary flex items-center gap-1.5">
            <Building2 size={12} /> Estás en el panel <strong>operativo</strong> de la tienda. La gestión multi-tenant vive en el panel Superadmin.
          </p>
          <button
            onClick={() => navigate("/superadmin")}
            className="text-xs font-semibold text-white bg-primary hover:bg-primary/90 px-3 py-1.5 rounded-md whitespace-nowrap"
          >
            Ir al panel Superadmin →
          </button>
        </div>
      )}


      {/* Mobile: horizontal tab scroll */}
      <div className="lg:hidden flex overflow-x-auto border-b border-border bg-card scrollbar-hide">
        {tabs.map(({ id, label, icon: Icon }) => (
          <button key={id} onClick={() => selectTab(id)}
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
          <div className="sticky top-0 z-10 bg-card border-b border-border p-2">
            <div className="relative">
              <Search size={13} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="search"
                value={tabFilter}
                onChange={(e) => setTabFilter(e.target.value)}
                placeholder="Buscar módulo…"
                className="w-full pl-7 pr-2 py-1.5 text-xs bg-muted/50 border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>
          <nav className="py-2">
            {(() => {
              const q = tabFilter.trim().toLowerCase();
              const filtered = q ? tabs.filter((t) => t.label.toLowerCase().includes(q)) : tabs;
              const renderTabBtn = ({ id, label, icon: Icon }: typeof tabs[number]) => (
                <button
                  key={id}
                  onClick={() => selectTab(id)}
                  className={`w-full flex items-center gap-2.5 px-4 py-2 text-sm font-medium transition-colors relative ${
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
              );

              if (q) {
                return filtered.length > 0
                  ? filtered.map(renderTabBtn)
                  : <p className="px-4 py-3 text-xs text-muted-foreground">Sin resultados</p>;
              }

              return GROUP_ORDER.map((group) => {
                const groupTabs = filtered.filter((t) => t.group === group);
                if (groupTabs.length === 0) return null;
                return (
                  <div key={group} className="mb-1">
                    <p className="px-4 pt-3 pb-1 text-[10px] font-heading font-bold text-muted-foreground uppercase tracking-wider">
                      {GROUP_LABELS[group]}
                    </p>
                    {groupTabs.map(renderTabBtn)}
                  </div>
                );
              });
            })()}

            {opsLinks.length > 0 && !tabFilter && (
              <>
                <div className="mt-3 px-4 pt-3 pb-1 border-t border-border">
                  <p className="text-[10px] font-heading font-bold text-muted-foreground uppercase tracking-wider">Atajos operativos</p>
                </div>
                {opsLinks.map(({ path, label, icon: Icon }) => (
                  <button
                    key={path}
                    onClick={() => navigate(path)}
                    className="w-full flex items-center gap-2.5 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
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
