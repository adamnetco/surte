import { ShoppingCart } from "lucide-react";
import { useCart } from "@/context/CartContext";
import CartDrawer from "./CartDrawer";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(price);

const FloatingCart = () => {
  const { totalItems, totalPrice, setDrawerOpen } = useCart();
  const navigate = useNavigate();

  return (
    <>
      <CartDrawer />
      <AnimatePresence>
        {totalItems > 0 && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            className="fixed bottom-[68px] md:bottom-6 left-0 right-0 z-40 px-3 pb-1 md:left-auto md:right-6 md:max-w-sm"
          >
            <div className="bg-accent rounded-2xl px-4 py-2.5 flex items-center justify-between shadow-lg">
              <button
                onClick={() => setDrawerOpen(true)}
                className="flex items-center gap-2.5 flex-1 min-w-0"
              >
                <div className="relative">
                  <ShoppingCart size={20} className="text-accent-foreground" />
                  <span className="absolute -top-2 -right-2 bg-card text-foreground text-[9px] font-bold min-w-[16px] h-[16px] flex items-center justify-center rounded-full">
                    {totalItems}
                  </span>
                </div>
                <div className="text-left">
                  <p className="text-[11px] text-accent-foreground/80 leading-none">
                    {totalItems} {totalItems === 1 ? "producto" : "productos"}
                  </p>
                  <p className="text-sm font-heading font-bold text-accent-foreground leading-tight">
                    {formatPrice(totalPrice)}
                  </p>
                </div>
              </button>
              <button
                onClick={() => navigate("/carrito")}
                className="bg-card text-foreground text-sm font-heading font-semibold px-4 py-2 rounded-xl active:scale-95 transition-transform"
              >
                Ver Carrito
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default FloatingCart;
