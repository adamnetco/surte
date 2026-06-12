import { lazy, Suspense, useEffect } from "react";
import { QueryCache, QueryClient, QueryClientProvider, MutationCache } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { toast } from "sonner";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import AppErrorBoundary from "@/components/AppErrorBoundary";
import { errorToMessage, isTenantNotWritableError } from "@/lib/errors";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/modules/cart/context/CartContext";
import { AuthProvider } from "@/modules/auth/context/AuthContext";
import { AgentProvider } from "@/modules/pos/context/AgentContext";
import { OrganizationProvider } from "@/modules/platform/context/OrganizationContext";
import { ThemeProvider } from "@/modules/platform/context/ThemeContext";
import { SwipeProvider } from "@/modules/storefront/context/SwipeContext";
import FloatingWhatsApp from "@/modules/storefront/components/FloatingWhatsApp";
import AgentBar from "@/modules/storefront/components/AgentBar";
import CityPickerModal from "@/modules/storefront/components/CityPickerModal";
import DynamicThemeInjector from "@/components/DynamicThemeInjector";
import CustomScriptInjector from "@/components/CustomScriptInjector";
import Analytics from "@/modules/marketing/seo/Analytics";
import CartNavigationGuard from "@/components/CartNavigationGuard";
import OmnichannelCartListener from "@/components/OmnichannelCartListener";
import GlobalCommandPalette from "@/components/GlobalCommandPalette";
import AuthHealthMonitor from "@/components/AuthHealthMonitor";
const OnboardingChecklist = lazy(() => import("@/modules/onboarding/components/OnboardingChecklist"));
import DevBypassBanner from "@/components/DevBypassBanner";
import { isAuthLockAbort } from "@/modules/auth/lib/authRecovery";

// Eager: only the home page (LCP-critical) — everything else is code-split.
import Index from "./pages/Index";
import LoginRouter from "./modules/auth/pages/LoginRouter";
import RoleGuard from "./modules/auth/components/RoleGuard";
import MasterOnlyGuard from "./modules/auth/components/MasterOnlyGuard";
import HostGuard from "./components/HostGuard";
import { detectTenant, isStorefrontTenant } from "@/modules/tenant/lib/subdomain";

const AdminDiag = lazy(() => import("./pages/AdminDiag"));
const AuthStatus = lazy(() => import("./pages/AuthStatus"));
const ClientPortalShell = lazy(() => import("./modules/clientes").then((m) => ({ default: m.ClientPortalShell })));
const SSOErrorScreen = lazy(() => import("./modules/auth/components/SSOErrorScreen"));


const Catalogo = lazy(() => import("./modules/storefront").then((m) => ({ default: m.CatalogoPage })));
const Carrito = lazy(() => import("./modules/storefront").then((m) => ({ default: m.CarritoPage })));
const Categorias = lazy(() => import("./pages/Categorias"));
const MenuPage = lazy(() => import("./modules/pos").then((m) => ({ default: m.MenuPage })));
const Ofertas = lazy(() => import("./modules/storefront").then((m) => ({ default: m.OfertasPage })));
const TenantAwareLogin = lazy(() => import("./modules/auth/components/TenantAwareLogin"));
const AdminDashboard = lazy(() => import("./modules/admin-cms").then((m) => ({ default: m.AdminDashboardPage })));
const MisPedidos = lazy(() => import("./pages/MisPedidos"));
const Perfil = lazy(() => import("./pages/Perfil"));
const Favoritos = lazy(() => import("./pages/Favoritos"));
const Ayuda = lazy(() => import("./pages/Ayuda"));
const Configuracion = lazy(() => import("./pages/Configuracion"));
const ProductoDetalle = lazy(() => import("./modules/storefront").then((m) => ({ default: m.ProductoDetallePage })));
const Pedido = lazy(() => import("./modules/storefront").then((m) => ({ default: m.PedidoPage })));
const NotFound = lazy(() => import("./pages/NotFound"));
const Unsubscribe = lazy(() => import("./modules/auth/pages/Unsubscribe"));
const Hub = lazy(() => import("./modules/storefront").then((m) => ({ default: m.HubPage })));
const LandingPage = lazy(() => import("./modules/storefront").then((m) => ({ default: m.LandingPagePage })));
const Politicas = lazy(() => import("./pages/Politicas"));
const TratamientoDatos = lazy(() => import("./pages/TratamientoDatos"));
const ResetPassword = lazy(() => import("./modules/auth/pages/ResetPassword"));
const POS = lazy(() => import("./modules/pos").then((m) => ({ default: m.POSPage })));
const PosHub = lazy(() => import("./modules/pos").then((m) => ({ default: m.PosHubPage })));
const Mesas = lazy(() => import("./modules/pos").then((m) => ({ default: m.MesasPage })));
const KDS = lazy(() => import("./modules/pos").then((m) => ({ default: m.KDSPage })));
const Inventario = lazy(() => import("./modules/admin-cms").then((m) => ({ default: m.InventarioPage })));
const Facturacion = lazy(() => import("./modules/admin-cms").then((m) => ({ default: m.FacturacionPage })));
const Planes = lazy(() => import("./modules/clientes").then((m) => ({ default: m.PlanesPage })));
const Billing = lazy(() => import("./modules/clientes").then((m) => ({ default: m.BillingPage })));
const Onboarding = lazy(() => import("./modules/clientes").then((m) => ({ default: m.OnboardingPage })));
const ActivationStatus = lazy(() => import("./modules/onboarding/pages/ActivationStatus"));
const CatalogosBase = lazy(() => import("./modules/superadmin").then((m) => ({ default: m.CatalogosBasePage })));
const Licencias = lazy(() => import("./modules/superadmin").then((m) => ({ default: m.LicenciasPage })));
const GerenteIA = lazy(() => import("./pages/GerenteIA"));
const Compras = lazy(() => import("./modules/admin-cms").then((m) => ({ default: m.ComprasPage })));
const HealthLogs = lazy(() => import("./modules/admin-cms").then((m) => ({ default: m.HealthLogsPage })));
const Sitios = lazy(() => import("./modules/superadmin").then((m) => ({ default: m.SitiosPage })));
const SuperadminDashboard = lazy(() => import("./modules/superadmin").then((m) => ({ default: m.SuperadminDashboardPage })));
const TenantWorkspace = lazy(() => import("./modules/superadmin").then((m) => ({ default: m.TenantWorkspacePage })));
const LoginSuperadmin = lazy(() => import("./modules/auth/pages/LoginSuperadmin"));
const MiSeguridad = lazy(() => import("./pages/MiSeguridad"));

// Perf: defaults conservadores para evitar refetches innecesarios.
// - staleTime 60s: la mayoría de paneles no necesitan datos frescos por segundo.
// - gcTime 5min: mantiene cache caliente al navegar entre tabs.
// - refetchOnWindowFocus false: en POS/Admin abrir otra pestaña no debería re-pegarle a la DB.
// - retry 1: errores transitorios sí reintentan, pero no bucles largos.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
  // Captura global de errores: cualquier query/mutation que falle y no tenga
  // handler propio termina aquí. Las mutations con onError local NO se duplican
  // porque sonner deduplica por id.
  queryCache: new QueryCache({
    onError: (error, query) => {
      // Solo molestar al usuario si la query ya tenía datos antes (refetch fallido)
      // o si fue invocada explícitamente (no en hover/prefetch).
      if (query.state.data === undefined && query.meta?.silent !== true) {
        const msg = errorToMessage(error);
        toast.error(msg, { id: `q:${String(query.queryHash)}` });
      }
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) => {
      if (mutation.options.onError) return; // ya manejado a nivel local
      toast.error(errorToMessage(error));
    },
  }),
});

const RouteFallback = () => (
  <div className="min-h-[100dvh] flex items-center justify-center text-sm text-muted-foreground">
    Cargando…
  </div>
);

/**
 * Tenant-aware home: la ruta `/` cambia de componente según el subdominio.
 * Ver `src/lib/subdomain.ts` para el mapeo.
 */
/**
 * Tenant-aware home: la ruta `/` cambia de componente según el subdominio.
 * - admin.* → AdminDashboard
 * - pos.*   → POSWorkspace
 * - mi.*    → ClientPortal
 * - <slug>.sistecpos.com (cada tenant) → Storefront (Index)
 * - sistecpos.com / www / app → LoginRouter (portal de acceso al SaaS)
 */
const TenantHome = () => {
  const tenant = detectTenant();
  // Los storefronts (cualquier slug de tenant) siguen mostrando la tienda.
  if (isStorefrontTenant(tenant)) return <Index />;
  // Para admin/app/www/pos/mi → portal de login unificado.
  // Tras autenticarse, LoginRouter redirige al panel correspondiente según rol.
  return <LoginRouter />;
};

/** Captura errores async no manejados (promesas) y los muestra al usuario. */
const GlobalErrorListeners = () => {
  useEffect(() => {
    const onUnhandled = (event: PromiseRejectionEvent) => {
      if (isAuthLockAbort(event.reason)) {
        event.preventDefault();
        return;
      }
      // eslint-disable-next-line no-console
      console.error("[unhandledrejection]", event.reason);
      const msg = errorToMessage(event.reason);
      // No spammear: dedupe por mensaje
      toast.error(msg, { id: `unhandled:${msg}` });
    };
    const onError = (event: ErrorEvent) => {
      // Solo logueamos: los errores de render los atrapa el ErrorBoundary,
      // y los de scripts de 3eros no son accionables para el usuario final.
      // eslint-disable-next-line no-console
      console.error("[window.onerror]", event.error ?? event.message);
    };
    window.addEventListener("unhandledrejection", onUnhandled);
    window.addEventListener("error", onError);
    return () => {
      window.removeEventListener("unhandledrejection", onUnhandled);
      window.removeEventListener("error", onError);
    };
  }, []);
  return null;
};

const App = () => (
  <AppErrorBoundary label="root">
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <AuthProvider>
          <OrganizationProvider>
          <AgentProvider>
          <CartProvider>
            <Toaster />
            <Sonner />
            <DevBypassBanner />
            <GlobalErrorListeners />
            <Suspense fallback={null}><SSOErrorScreen /></Suspense>

            <DynamicThemeInjector />
            <CustomScriptInjector />
                <AgentBar />
              <BrowserRouter>
                <CityPickerModal />
                <Analytics />
                <CartNavigationGuard />
                <OmnichannelCartListener />
                <GlobalCommandPalette />
                <AuthHealthMonitor />
                <Suspense fallback={null}><OnboardingChecklist /></Suspense>
                <SwipeProvider>
                  <Suspense fallback={<RouteFallback />}>
                  <Routes>
                    <Route path="/" element={<TenantHome />} />

                    {/* === Rutas universales (cualquier host) === */}
                    <Route path="/login" element={<TenantAwareLogin />} />
                    <Route path="/user/login" element={<TenantAwareLogin />} />
                    <Route path="/admin/login" element={<TenantAwareLogin />} />
                    <Route path="/superadmin/acceso" element={<LoginSuperadmin />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/unsubscribe" element={<Unsubscribe />} />
                    <Route path="/politicas" element={<Politicas />} />
                    <Route path="/tratamiento-datos" element={<TratamientoDatos />} />
                    <Route path="/planes" element={<Planes />} />

                    {/* === Storefront (solo en hosts de tenant: <slug>.sistecpos.com) === */}
                    <Route path="/catalogo" element={<HostGuard require="storefront"><Catalogo /></HostGuard>} />
                    <Route path="/carrito" element={<HostGuard require="storefront"><Carrito /></HostGuard>} />
                    <Route path="/categorias" element={<HostGuard require="storefront"><Categorias /></HostGuard>} />
                    <Route path="/menu" element={<HostGuard require="storefront"><MenuPage /></HostGuard>} />
                    <Route path="/ofertas" element={<HostGuard require="storefront"><Ofertas /></HostGuard>} />
                    <Route path="/producto/:id" element={<HostGuard require="storefront"><ProductoDetalle /></HostGuard>} />
                    <Route path="/p/:id" element={<HostGuard require="storefront"><ProductoDetalle /></HostGuard>} />
                    <Route path="/pedido/:orderNumber" element={<HostGuard require="storefront"><Pedido /></HostGuard>} />
                    <Route path="/pedidos" element={<MisPedidos />} />
                    <Route path="/favoritos" element={<Favoritos />} />
                    <Route path="/perfil" element={<Perfil />} />
                    <Route path="/ayuda" element={<Ayuda />} />
                    <Route path="/configuracion" element={<Configuracion />} />
                    <Route path="/mi/seguridad" element={<MiSeguridad />} />
                    <Route path="/clientes" element={<ClientPortalShell />} />

                    {/* SEO local (hubs por ciudad) → solo en hosts de tenant */}
                    <Route path="/hub/:type/:slug" element={<HostGuard require="storefront"><Hub /></HostGuard>} />
                    <Route path="/:city/categoria/:slug" element={<HostGuard require="storefront"><Hub /></HostGuard>} />
                    <Route path="/:city/marca/:slug" element={<HostGuard require="storefront"><Hub /></HostGuard>} />
                    <Route path="/:city/etiqueta/:slug" element={<HostGuard require="storefront"><Hub /></HostGuard>} />
                    <Route path="/:city" element={<HostGuard require="storefront"><Hub /></HostGuard>} />
                    <Route path="/s/:slug" element={<HostGuard require="storefront"><LandingPage /></HostGuard>} />

                    {/* === Operativa / configuración de un negocio ===
                        Accesible tanto desde admin.sistecpos.com (panel SaaS) como
                        desde <slug>.sistecpos.com (subdominio del tenant). El acceso
                        real lo controlan RoleGuard / módulos, no el host. */}
                    <Route path="/admin" element={<RoleGuard section="admin"><AdminDashboard /></RoleGuard>} />
                    <Route path="/pos" element={<PosHub />} />
                    <Route path="/pos/vender" element={<POS />} />
                    <Route path="/mesas" element={<Mesas />} />
                    <Route path="/kds" element={<KDS />} />
                    <Route path="/inventario" element={<Inventario />} />
                    <Route path="/facturacion" element={<Facturacion />} />
                    <Route path="/compras" element={<Compras />} />
                    <Route path="/admin/health-logs" element={<RoleGuard section="admin"><HealthLogs /></RoleGuard>} />
                    <Route path="/gerente-ia" element={<GerenteIA />} />
                    <Route path="/onboarding" element={<Onboarding />} />
                    <Route path="/activacion" element={<ActivationStatus />} />
                    <Route path="/billing" element={<Billing />} />

                    {/* === Panel SistecPOS (solo en hosts del sistema) === */}
                    <Route path="/superadmin/*" element={<HostGuard require="system"><SuperadminDashboard /></HostGuard>} />
                    <Route path="/sitios" element={<HostGuard require="system"><Sitios /></HostGuard>} />
                    <Route path="/licencias" element={<HostGuard require="system"><Licencias /></HostGuard>} />
                    <Route path="/catalogos-base" element={<HostGuard require="system"><CatalogosBase /></HostGuard>} />
                    <Route path="/t/:slug/admin" element={<HostGuard require="system"><TenantWorkspace /></HostGuard>} />
                    <Route path="/admin/diag" element={<MasterOnlyGuard><AdminDiag /></MasterOnlyGuard>} />
                    <Route path="/admin-diag" element={<MasterOnlyGuard><AdminDiag /></MasterOnlyGuard>} />
                    <Route path="/auth-status" element={<MasterOnlyGuard><AuthStatus /></MasterOnlyGuard>} />
                    <Route path="/admin/auth-status" element={<MasterOnlyGuard><AuthStatus /></MasterOnlyGuard>} />

                    <Route path="*" element={<NotFound />} />
                  </Routes>
                  </Suspense>
                  <FloatingWhatsApp />
                </SwipeProvider>
              </BrowserRouter>
          </CartProvider>
          </AgentProvider>
          </OrganizationProvider>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
  </AppErrorBoundary>
);

export default App;
