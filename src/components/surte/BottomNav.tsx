import { Home, Star, ShoppingCart, Grid3X3, Menu } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { useCart } from "@/context/CartContext";

const navItems = [
  { icon: Home, label: "Inicio", path: "/" },
  { icon: Star, label: "Ofertas", path: "/ofertas" },
  { icon: ShoppingCart, label: "Carrito", path: "/carrito" },
  { icon: Grid3X3, label: "Categorías", path: "/categorias" },
  { icon: Menu, label: "Menú", path: "/menu" },
];

const BottomNav = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { totalItems } = useCart();

  return (
    <nav className="nav-bottom">
      <div className="flex items-center justify-around py-2">
        {navItems.map(({ icon: Icon, label, path }) => {
          const isActive = location.pathname === path;
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
                  <span className="absolute -top-2 -right-2.5 bg-surte-naranja text-primary-foreground text-[10px] font-bold w-4.5 h-4.5 flex items-center justify-center rounded-full min-w-[18px] h-[18px]">
                    {totalItems}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{label}</span>
            </button>
          );
        })}
      </div>
      {/* Safe area for iOS */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
};

export default BottomNav;
