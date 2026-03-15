import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CartProvider } from "@/context/CartContext";
import { AuthProvider } from "@/context/AuthContext";
import Index from "./pages/Index";
import Catalogo from "./pages/Catalogo";
import Carrito from "./pages/Carrito";
import Categorias from "./pages/Categorias";
import MenuPage from "./pages/MenuPage";
import Ofertas from "./pages/Ofertas";
import Login from "./pages/Login";
import AdminDashboard from "./pages/AdminDashboard";
import MisPedidos from "./pages/MisPedidos";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <CartProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/catalogo" element={<Catalogo />} />
              <Route path="/carrito" element={<Carrito />} />
              <Route path="/categorias" element={<Categorias />} />
              <Route path="/menu" element={<MenuPage />} />
              <Route path="/ofertas" element={<Ofertas />} />
              <Route path="/login" element={<Login />} />
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </CartProvider>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
