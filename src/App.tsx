import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/context/CartContext";
import { AuthProvider } from "@/context/AuthContext";
import { AgentProvider } from "@/context/AgentContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { SwipeProvider } from "@/context/SwipeContext";
import FloatingWhatsApp from "@/components/surte/FloatingWhatsApp";
import AgentBar from "@/components/surte/AgentBar";
import CityPickerModal from "@/components/surte/CityPickerModal";
import DynamicThemeInjector from "@/components/DynamicThemeInjector";
import CustomScriptInjector from "@/components/CustomScriptInjector";
import Analytics from "@/components/seo/Analytics";
import CartNavigationGuard from "@/components/CartNavigationGuard";
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

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <TooltipProvider>
        <AuthProvider>
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
                  <Route path="/unsubscribe" element={<Unsubscribe />} />
                  <Route path="/hub/:type/:slug" element={<Hub />} />
                  <Route path="/s/:slug" element={<LandingPage />} />
                  <Route path="/politicas" element={<Politicas />} />
                  <Route path="/tratamiento-datos" element={<TratamientoDatos />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
                <FloatingWhatsApp />
              </BrowserRouter>
          </CartProvider>
          </AgentProvider>
        </AuthProvider>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;