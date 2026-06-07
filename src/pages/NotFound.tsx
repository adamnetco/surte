import { useLocation, useNavigate } from "react-router-dom";
import { useEffect } from "react";
import TopBar from "@/modules/storefront/components/TopBar";
import BottomNav from "@/modules/storefront/components/BottomNav";
import HeadMeta from "@/modules/marketing/seo/HeadMeta";
import { Home, Search, ArrowLeft } from "lucide-react";

const NotFound = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    console.error("404 Error:", location.pathname);
  }, [location.pathname]);

  return (
    <div className="min-h-screen bg-background pb-20">
      <HeadMeta title="Página no encontrada — SURTÉ YA" description="La página que buscas no existe." />
      <TopBar />
      <main className="flex flex-col items-center justify-center px-4 py-16 text-center">
        <div className="text-7xl font-heading font-bold text-accent mb-4">404</div>
        <h1 className="text-xl font-heading font-bold text-foreground mb-2">Página no encontrada</h1>
        <p className="text-sm text-muted-foreground mb-8 max-w-xs">
          La página que buscas no existe o fue movida. Intenta buscar en nuestro catálogo.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <button onClick={() => navigate("/")} className="btn-surte px-6 py-3 text-sm flex items-center gap-2">
            <Home size={16} /> Ir al Inicio
          </button>
          <button onClick={() => navigate("/catalogo")} className="bg-muted text-foreground px-6 py-3 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-muted/80 transition-colors">
            <Search size={16} /> Ver Catálogo
          </button>
          <button onClick={() => navigate(-1)} className="bg-muted text-muted-foreground px-6 py-3 rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-muted/80 transition-colors">
            <ArrowLeft size={16} /> Volver
          </button>
        </div>
      </main>
      <BottomNav />
    </div>
  );
};

export default NotFound;
