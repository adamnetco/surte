import { useEffect, useCallback, useRef, useState } from "react";
import { useLocation, useNavigate, UNSAFE_NavigationContext } from "react-router-dom";
import { useCart } from "@/context/CartContext";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ShoppingCart, ShoppingBag, ArrowLeft } from "lucide-react";
import React, { useContext } from "react";

/** Paths the user can navigate to freely while the cart has items */
const ALLOWED_PATHS = [
  "/carrito",
  "/pedido",
  "/catalogo",
  "/hub",
  "/producto",
  "/ofertas",
  "/categorias",
  "/favoritos",
  "/",
  "/login",
  "/perfil",
  "/configuracion",
  "/mis-pedidos",
  "/ayuda",
  "/politicas",
];

const CartNavigationGuard = () => {
  const { totalItems } = useCart();
  const location = useLocation();
  const navigate = useNavigate();
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const navContext = useContext(UNSAFE_NavigationContext);
  const totalItemsRef = useRef(totalItems);
  totalItemsRef.current = totalItems;
  const locationRef = useRef(location.pathname);
  locationRef.current = location.pathname;

  const isAllowed = (path: string) =>
    ALLOWED_PATHS.some((p) => path.startsWith(p));

  // Intercept programmatic navigation (navigate() calls)
  useEffect(() => {
    const navigator = navContext.navigator as any;
    const originalPush = navigator.push.bind(navigator);
    const originalReplace = navigator.replace.bind(navigator);

    const intercept = (original: Function, to: any, ...args: any[]) => {
      const path = typeof to === "string" ? to : to?.pathname || "";
      if (
        totalItemsRef.current > 0 &&
        path !== locationRef.current &&
        !isAllowed(path)
      ) {
        setPendingPath(path);
        return;
      }
      return original(to, ...args);
    };

    navigator.push = (to: any, ...args: any[]) => intercept(originalPush, to, ...args);
    navigator.replace = (to: any, ...args: any[]) => intercept(originalReplace, to, ...args);

    return () => {
      navigator.push = originalPush;
      navigator.replace = originalReplace;
    };
  }, [navContext]);

  // Also intercept <a> link clicks
  useEffect(() => {
    if (totalItems === 0) return;

    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("http") || href.startsWith("mailto") || href.startsWith("tel")) return;
      if (isAllowed(href)) return;
      if (href === location.pathname) return;

      e.preventDefault();
      e.stopPropagation();
      setPendingPath(href);
    };

    document.addEventListener("click", handleClick, true);
    return () => document.removeEventListener("click", handleClick, true);
  }, [totalItems, location.pathname]);

  const handleProceed = useCallback(() => {
    if (pendingPath) {
      const path = pendingPath;
      setPendingPath(null);
      setTimeout(() => navigate(path), 0);
    }
  }, [pendingPath, navigate]);

  const handleCancel = useCallback(() => {
    setPendingPath(null);
  }, []);

  const handleKeepShopping = useCallback(() => {
    setPendingPath(null);
    navigate("/catalogo");
  }, [navigate]);

  return (
    <AlertDialog open={!!pendingPath}>
      <AlertDialogContent className="max-w-[90vw] rounded-xl sm:max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-base font-heading">
            <ShoppingCart size={18} className="text-accent" />
            Tienes {totalItems} {totalItems === 1 ? "producto" : "productos"} en el carrito
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm">
            Tu carrito se conservará por 24 horas. ¿Qué deseas hacer?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-2 pt-1">
          {/* Primary: keep shopping */}
          <button
            onClick={handleKeepShopping}
            className="w-full flex items-center justify-center gap-2 bg-accent text-accent-foreground font-heading font-semibold py-3 rounded-xl text-sm transition-all active:scale-[0.97]"
          >
            <ShoppingBag size={16} />
            Seguir comprando
          </button>
          {/* Secondary: stay on current page */}
          <button
            onClick={handleCancel}
            className="w-full flex items-center justify-center gap-2 bg-muted text-foreground font-medium py-2.5 rounded-xl text-sm transition-colors hover:bg-muted/80"
          >
            <ArrowLeft size={14} />
            Quedarme aquí
          </button>
          {/* Tertiary: leave anyway */}
          <button
            onClick={handleProceed}
            className="w-full text-center text-xs text-muted-foreground py-1.5 hover:text-foreground transition-colors"
          >
            Salir sin comprar
          </button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default CartNavigationGuard;
