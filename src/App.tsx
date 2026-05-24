import { lazy, Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/context/CartContext";
import { AuthProvider } from "@/context/AuthContext";
import { AgentProvider } from "@/context/AgentContext";
import { OrganizationProvider } from "@/context/OrganizationContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { SwipeProvider } from "@/context/SwipeContext";
import FloatingWhatsApp from "@/components/surte/FloatingWhatsApp";
import AgentBar from "@/components/surte/AgentBar";
import CityPickerModal from "@/components/surte/CityPickerModal";
import DynamicThemeInjector from "@/components/DynamicThemeInjector";
import CustomScriptInjector from "@/components/CustomScriptInjector";
import Analytics from "@/components/seo/Analytics";
import CartNavigationGuard from "@/components/CartNavigationGuard";
import OmnichannelCartListener from "@/components/OmnichannelCartListener";

// Eager: only the home page (LCP-critical) — everything else is code-split.
import Index from "./pages/Index";
import AdminDiag from "./pages/AdminDiag";
import RoleGuard from "./components/RoleGuard";
import { detectTenant } from "@/lib/subdomain";

const ClientPortalShell = lazy(() => import("./components/clientes/ClientPortalShell"));

const Catalogo = lazy(() => import("./pages/Catalogo"));
const Carrito = lazy(() => import("./pages/Carrito"));
const Categorias = lazy(() => import("./pages/Categorias"));
const MenuPage = lazy(() => import("./pages/MenuPage"));
const Ofertas = lazy(() => import("./pages/Ofertas"));
const Login = lazy(() => import("./pages/Login"));
const AdminDashboard = lazy(() => import("./pages/AdminDashboard"));
const MisPedidos = lazy(() => import("./pages/MisPedidos"));
const Perfil = lazy(() => import("./pages/Perfil"));
const Favoritos = lazy(() => import("./pages/Favoritos"));
const Ayuda = lazy(() => import("./pages/Ayuda"));
const Configuracion = lazy(() => import("./pages/Configuracion"));
const ProductoDetalle = lazy(() => import("./pages/ProductoDetalle"));
const Pedido = lazy(() => import("./pages/Pedido"));
const NotFound = lazy(() => import("./pages/NotFound"));
const Unsubscribe = lazy(() => import("./pages/Unsubscribe"));
const Hub = lazy(() => import("./pages/Hub"));
const LandingPage = lazy(() => import("./pages/LandingPage"));
const Politicas = lazy(() => import("./pages/Politicas"));
const TratamientoDatos = lazy(() => import("./pages/TratamientoDatos"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const POS = lazy(() => import("./pages/POS"));
const Mesas = lazy(() => import("./pages/Mesas"));
const KDS = lazy(() => import("./pages/KDS"));
const Inventario = lazy(() => import("./pages/Inventario"));
const Facturacion = lazy(() => import("./pages/Facturacion"));
const Planes = lazy(() => import("./pages/Planes"));
const Billing = lazy(() => import("./pages/Billing"));
const Onboarding = lazy(() => import("./pages/Onboarding"));
const CatalogosBase = lazy(() => import("./pages/CatalogosBase"));
const Licencias = lazy(() => import("./pages/Licencias"));
const GerenteIA = lazy(() => import("./pages/GerenteIA"));
const Compras = lazy(() => import("./pages/Compras"));
const Sitios = lazy(() => import("./pages/Sitios"));

const queryClient = new QueryClient();

const RouteFallback = () => (
  <div className="min-h-[100dvh] flex items-center justify-center text-sm text-muted-foreground">
    Cargando…
  </div>
);

/**
 * Tenant-aware home: la ruta `/` cambia de componente según el subdominio.
 * Ver `src/lib/subdomain.ts` para el mapeo.
 */
const TenantHome = () => {
  const tenant = detectTenant();
  if (tenant === "admin") {
    return (
      <RoleGuard section="admin">
        <AdminDashboard />
      </RoleGuard>
    );
  }
  if (tenant === "pos") return <POS />;
  if (tenant === "mi") return <ClientPortalShell />;
  return <Index />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <AuthProvider>
          <OrganizationProvider>
          <AgentProvider>
          <CartProvider>
            <Toaster />
            <Sonner />
            <DynamicThemeInjector />
            <CustomScriptInjector />
                <AgentBar />
              <BrowserRouter>
                <CityPickerModal />
                <Analytics />
                <CartNavigationGuard />
                <OmnichannelCartListener />
                <SwipeProvider>
                  <Suspense fallback={<RouteFallback />}>
                  <Routes>
                    <Route path="/" element={<TenantHome />} />
                    <Route path="/catalogo" element={<Catalogo />} />
                    <Route path="/carrito" element={<Carrito />} />
                    <Route path="/categorias" element={<Categorias />} />
                    <Route path="/menu" element={<MenuPage />} />
                    <Route path="/ofertas" element={<Ofertas />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/user/login" element={<Login />} />
                    <Route path="/admin/login" element={<Login />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/clientes" element={<ClientPortalShell />} />
                    <Route path="/pedidos" element={<MisPedidos />} />
                    <Route path="/perfil" element={<Perfil />} />
                    <Route path="/favoritos" element={<Favoritos />} />
                    <Route path="/ayuda" element={<Ayuda />} />
                    <Route path="/configuracion" element={<Configuracion />} />
                    <Route path="/producto/:id" element={<ProductoDetalle />} />
                    <Route path="/p/:id" element={<ProductoDetalle />} />
                    <Route path="/pedido/:orderNumber" element={<Pedido />} />
                    <Route path="/admin" element={<RoleGuard section="admin"><AdminDashboard /></RoleGuard>} />
                    <Route path="/admin/diag" element={<AdminDiag />} />
                    <Route path="/admin-diag" element={<AdminDiag />} />
                    <Route path="/pos" element={<POS />} />
                    <Route path="/mesas" element={<Mesas />} />
                    <Route path="/kds" element={<KDS />} />
                    <Route path="/inventario" element={<Inventario />} />
                    <Route path="/facturacion" element={<Facturacion />} />
                    <Route path="/planes" element={<Planes />} />
                    <Route path="/billing" element={<Billing />} />
                    <Route path="/onboarding" element={<Onboarding />} />
                    <Route path="/catalogos-base" element={<CatalogosBase />} />
                    <Route path="/licencias" element={<Licencias />} />
                    <Route path="/gerente-ia" element={<GerenteIA />} />
                    <Route path="/compras" element={<Compras />} />
                    <Route path="/sitios" element={<Sitios />} />
                    <Route path="/unsubscribe" element={<Unsubscribe />} />
                    <Route path="/hub/:type/:slug" element={<Hub />} />
                    {/* SEO local: URLs amigables con ciudad */}
                    <Route path="/:city/categoria/:slug" element={<Hub />} />
                    <Route path="/:city/marca/:slug" element={<Hub />} />
                    <Route path="/:city/etiqueta/:slug" element={<Hub />} />
                    <Route path="/:city" element={<Hub />} />
                    <Route path="/s/:slug" element={<LandingPage />} />
                    <Route path="/politicas" element={<Politicas />} />
                    <Route path="/tratamiento-datos" element={<TratamientoDatos />} />
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
);

export default App;
