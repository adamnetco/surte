import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/context/CartContext";
import { AuthProvider } from "@/context/AuthContext";
import FloatingWhatsApp from "@/components/surte/FloatingWhatsApp";
import CityPickerModal from "@/components/surte/CityPickerModal";
import DynamicThemeInjector from "@/components/DynamicThemeInjector";
import Analytics from "@/components/seo/Analytics";
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
import Politicas from "./pages/Politicas";
import TratamientoDatos from "./pages/TratamientoDatos";
import Hub from "./pages/Hub";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <CartProvider>
          <Toaster />
          <Sonner />
          <DynamicThemeInjector />
          <CityPickerModal />
            <BrowserRouter>
              <Analytics />
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/catalogo" element={<Catalogo />} />
                <Route path="/carrito" element={<Carrito />} />
                <Route path="/categorias" element={<Categorias />} />
                <Route path="/menu" element={<MenuPage />} />
                <Route path="/ofertas" element={<Ofertas />} />
                <Route path="/login" element={<Login />} />
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
                <Route path="*" element={<NotFound />} />
              </Routes>
              <FloatingWhatsApp />
            </BrowserRouter>
        </CartProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;