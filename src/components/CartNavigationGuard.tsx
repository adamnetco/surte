import { useEffect } from "react";
import { useBlocker } from "react-router-dom";
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

/** Pages where we never block navigation (user is completing the purchase flow) */
const ALLOWED_PATHS = ["/carrito", "/pedido"];

const CartNavigationGuard = () => {
  const { totalItems } = useCart();

  const blocker = useBlocker(({ currentLocation, nextLocation }) => {
    if (totalItems === 0) return false;
    // Don't block if going to checkout-related pages
    if (ALLOWED_PATHS.some((p) => nextLocation.pathname.startsWith(p))) return false;
    // Don't block same-page hash/search changes
    if (currentLocation.pathname === nextLocation.pathname) return false;
    return true;
  });

  // Reset blocker if items become 0 while dialog is open
  useEffect(() => {
    if (totalItems === 0 && blocker.state === "blocked") {
      blocker.proceed?.();
    }
  }, [totalItems, blocker]);

  return (
    <AlertDialog open={blocker.state === "blocked"}>
      <AlertDialogContent className="max-w-[90vw] rounded-xl sm:max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-base font-heading">
            <ShoppingCart size={18} className="text-accent" />
            Tienes {totalItems} {totalItems === 1 ? "producto" : "productos"} en el carrito
          </AlertDialogTitle>
          <AlertDialogDescription className="text-sm">
            Si sales de esta página tu carrito se conservará por 24 horas, pero ¿seguro que deseas salir?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row gap-2">
          <AlertDialogCancel
            onClick={() => blocker.reset?.()}
            className="flex-1 mt-0"
          >
            Quedarme
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={() => blocker.proceed?.()}
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
