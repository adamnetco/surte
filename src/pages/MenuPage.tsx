import TopBar from "@/components/surte/TopBar";
import BottomNav from "@/components/surte/BottomNav";
import { User, Package, Heart, HelpCircle, LogIn, Settings } from "lucide-react";
import { useNavigate } from "react-router-dom";

const menuItems = [
  { icon: LogIn, label: "Iniciar Sesión", path: "/login", desc: "Accede a tu cuenta" },
  { icon: Package, label: "Mis Pedidos", path: "/pedidos", desc: "Seguimiento de pedidos" },
  { icon: Heart, label: "Favoritos", path: "/favoritos", desc: "Productos guardados" },
  { icon: User, label: "Mi Perfil", path: "/perfil", desc: "Datos de cuenta" },
  { icon: Settings, label: "Configuración", path: "/configuracion", desc: "Preferencias" },
  { icon: HelpCircle, label: "Ayuda", path: "/ayuda", desc: "Soporte y FAQ" },
];

const MenuPage = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopBar />
      <main className="px-4 py-4">
        <h1 className="text-xl font-heading font-bold text-foreground mb-4">Menú</h1>
        <div className="flex flex-col gap-2">
          {menuItems.map(({ icon: Icon, label, path, desc }) => (
            <button
              key={path}
              onClick={() => navigate(path)}
              className="flex items-center gap-3 bg-card rounded-xl p-4 text-left transition-all hover:shadow-md"
              style={{ boxShadow: "var(--shadow-card)" }}
            >
              <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
                <Icon size={20} className="text-accent" />
              </div>
              <div>
                <p className="font-medium text-sm text-foreground">{label}</p>
                <p className="text-xs text-muted-foreground">{desc}</p>
              </div>
            </button>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  );
};

export default MenuPage;
