import { Home, LayoutGrid, ShoppingCart, Grid3X3, Menu } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useCart } from "@/modules/cart/context/CartContext";

// Tab activeFor: regex/array de prefijos que también deben encender la pestaña
const navItems: Array<{
  icon: any;
  label: string;
  path: string;
  activeFor?: string[];
}> = [
  { icon: Home, label: "Inicio", path: "/" },
  {
    icon: LayoutGrid,
    label: "Catálogo",
    path: "/catalogo",
    activeFor: ["/catalogo", "/producto", "/p/", "/ofertas"],
  },
  { icon: ShoppingCart, label: "Carrito", path: "/carrito" },
  {
    icon: Grid3X3,
    label: "Categorías",
    path: "/categorias",
    activeFor: ["/categorias", "/hub/"],
  },
  {
    icon: Menu,
    label: "Cuenta",
    path: "/menu",
    activeFor: ["/menu", "/perfil", "/pedidos", "/favoritos", "/ayuda", "/configuracion"],
  },
];

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { totalItems } = useCart();

  return (
    <nav className="nav-bottom md:hidden">
      <div className="flex items-center justify-around py-2">
        {navItems.map(({ icon: Icon, label, path, activeFor }) => {
          const pathname = location.pathname;
          const isActive =
            path === "/"
              ? pathname === "/"
              : (activeFor ?? [path]).some((p) =>
                  p === "/" ? pathname === "/" : pathname.startsWith(p),
                );
          const isCart = path === "/carrito";
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-colors ${
                isActive
                  ? "text-accent"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <div className="relative">
                <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
                {isCart && totalItems > 0 && (
                  <span className="absolute -top-2 -right-2.5 bg-surte-naranja text-primary-foreground text-[10px] font-bold min-w-[18px] h-[18px] flex items-center justify-center rounded-full">
                    {totalItems}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          );
        })}
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
};

export default BottomNav;
