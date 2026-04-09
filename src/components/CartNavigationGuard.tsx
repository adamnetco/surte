import { useEffect, useCallback, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
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
import { ShoppingCart } from "lucide-react";
import { useState } from "react";

const ALLOWED_PATHS = ["/carrito", "/pedido"];

const CartNavigationGuard = () => {
  const { totalItems } = useCart();
  const location = useLocation();
  const navigate = useNavigate();
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const originalPush = useRef<typeof navigate | null>(null);

  // Intercept link clicks to show confirmation
  useEffect(() => {
    if (totalItems === 0) return;

    const handleClick = (e: MouseEvent) => {
      const anchor = (e.target as HTMLElement).closest("a[href]");
      if (!anchor) return;
      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("http") || href.startsWith("mailto") || href.startsWith("tel")) return;
      if (ALLOWED_PATHS.some((p) => href.startsWith(p))) return;
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
      navigate(pendingPath);
      setPendingPath(null);
    }
  }, [pendingPath, navigate]);

  const handleCancel = useCallback(() => {
    setPendingPath(null);
  }, []);

  return (
    <AlertDialog open={!!pendingPath}>
      <AlertDialogContent className="max-w-[90vw] rounded-xl sm:max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-base font-heading">
            <ShoppingCart size={18} className="text-accent" />
            Tienes {totalItems} {totalItems === 1 ? "producto" : "productos"} en el carrito
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm">
            Tu carrito se conservará por 24 horas. ¿Seguro que deseas salir de esta página?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row gap-2">
          <AlertDialogCancel onClick={handleCancel} className="flex-1 mt-0">
            Quedarme
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleProceed}
            className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
          >
            Salir
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default CartNavigationGuard;
