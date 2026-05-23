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
import Index from "./pages/Index";
import Catalogo from "./pages/Catalogo";
import Carrito from "./pages/Carrito";
import Categorias from "./pages/Categorias";
import MenuPage from "./pages/MenuPage";
import Ofertas from "./pages/Ofertas";
import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import MisPedidos from "./pages/MisPedidos";
import Perfil from "./pages/Perfil";
import Favoritos from "./pages/Favoritos";
import Ayuda from "./pages/Ayuda";
import Configuracion from "./pages/Configuracion";
import ProductoDetalle from "./pages/ProductoDetalle";
import Pedido from "./pages/Pedido";
import NotFound from "./pages/NotFound";
import Unsubscribe from "./pages/Unsubscribe";
import Hub from "./pages/Hub";
import LandingPage from "./pages/LandingPage";
import Politicas from "./pages/Politicas";
import TratamientoDatos from "./pages/TratamientoDatos";
import ResetPassword from "./pages/ResetPassword";
import POS from "./pages/POS";
import Mesas from "./pages/Mesas";
import KDS from "./pages/KDS";
import Inventario from "./pages/Inventario";
import Facturacion from "./pages/Facturacion";
import Planes from "./pages/Planes";
import Billing from "./pages/Billing";
import Onboarding from "./pages/Onboarding";
import CatalogosBase from "./pages/CatalogosBase";
import Licencias from "./pages/Licencias";
import GerenteIA from "./pages/GerenteIA";
import Compras from "./pages/Compras";
import Sitios from "./pages/Sitios";

const queryClient = new QueryClient();

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
                <CityPickerModal />
              <BrowserRouter>
                <Analytics />
                <CartNavigationGuard />
                <OmnichannelCartListener />
                <SwipeProvider>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/catalogo" element={<Catalogo />} />
                    <Route path="/carrito" element={<Carrito />} />
                    <Route path="/categorias" element={<Categorias />} />
                    <Route path="/menu" element={<MenuPage />} />
                    <Route path="/ofertas" element={<Ofertas />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/pedidos" element={<MisPedidos />} />
                    <Route path="/perfil" element={<Perfil />} />
                    <Route path="/favoritos" element={<Favoritos />} />
                    <Route path="/ayuda" element={<Ayuda />} />
                    <Route path="/configuracion" element={<Configuracion />} />
                    <Route path="/producto/:id" element={<ProductoDetalle />} />
                    <Route path="/p/:id" element={<ProductoDetalle />} />
                    <Route path="/pedido/:orderNumber" element={<Pedido />} />
                    <Route path="/admin" element={<AdminDashboard />} />
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