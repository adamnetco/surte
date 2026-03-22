import { ShoppingCart } from "lucide-react";
import { useCart } from "@/context/CartContext";
import CartDrawer from "./CartDrawer";
import { AnimatePresence, motion } from "framer-motion";

const FloatingCart = () => {
  const { totalItems, totalPrice } = useCart();

  const formatPrice = (price: number) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(price);

  return (
    <AnimatePresence>
      {totalItems > 0 && (
        <motion.div
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0, opacity: 0 }}
          className="fixed bottom-24 right-4 z-50"
        >
          <CartDrawer>
            <button className="relative flex items-center gap-2 bg-accent text-accent-foreground pl-3 pr-4 py-2.5 rounded-full font-heading font-semibold text-sm shadow-lg hover:opacity-90 transition-all active:scale-95">
              <div className="relative">
                <ShoppingCart size={18} />
                <span className="absolute -top-2 -right-2.5 bg-surte-naranja text-primary-foreground text-[9px] font-bold min-w-[16px] h-[16px] flex items-center justify-center rounded-full">
                  {totalItems}
                </span>
              </div>
              <span>{formatPrice(totalPrice)}</span>
            </button>
          </CartDrawer>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FloatingCart;
