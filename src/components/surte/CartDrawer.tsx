import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { useCart } from "@/context/CartContext";
import { ShoppingCart, Trash2, Minus, Plus, ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(price);

interface CartDrawerProps {
  children?: React.ReactNode;
}

const CartDrawer = ({ children }: CartDrawerProps) => {
  const { items, removeItem, updateQuantity, totalPrice, totalItems, isDrawerOpen, setDrawerOpen } = useCart();
  const navigate = useNavigate();

  return (
    <Sheet open={isDrawerOpen} onOpenChange={setDrawerOpen}>
      {children && <SheetTrigger asChild>{children}</SheetTrigger>}
      <SheetContent className="w-[340px] sm:w-[400px] flex flex-col p-0">
        <SheetHeader className="px-4 pt-4 pb-3 border-b border-border">
          <SheetTitle className="font-heading text-lg flex items-center gap-2">
            <ShoppingCart size={20} className="text-accent" />
            Tu Carrito
            {totalItems > 0 && (
              <span className="text-xs bg-accent/10 text-accent font-semibold px-2 py-0.5 rounded-full">
                {totalItems} {totalItems === 1 ? "item" : "items"}
              </span>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <ShoppingCart size={40} strokeWidth={1.2} className="mb-3 opacity-30" />
              <p className="font-heading font-semibold text-sm">Carrito vacío</p>
              <p className="text-xs mt-1">Agrega productos del catálogo</p>
            </div>
          ) : (
            <AnimatePresence>
              {items.map((item) => {
                const lineId = `${item.product.id}${item.presentationId ? `__${item.presentationId}` : ""}`;
                return (
                <motion.div
                  key={lineId}
                  layout
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="flex gap-3 py-3 border-b border-border last:border-0"
                >
                  <div className="w-14 h-14 rounded-lg bg-muted shrink-0 overflow-hidden flex items-center justify-center">
                    {item.product.image_url ? (
                      <img src={item.product.image_url} alt={item.product.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-lg font-heading font-bold text-muted-foreground/30">
                        {item.product.name.charAt(0)}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-medium text-foreground truncate">{item.product.name}</h4>
                    <p className="text-xs text-muted-foreground">
                      {item.presentationName || item.product.unit}
                    </p>
                    <div className="flex items-center justify-between mt-1.5">
                      <span className="text-sm font-heading font-bold text-foreground">
                        {formatPrice(item.unitPrice * item.quantity)}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity - 1, item.presentationId)}
                          className="w-6 h-6 rounded-md bg-muted flex items-center justify-center text-foreground"
                        >
                          <Minus size={12} />
                        </button>
                        <span className="text-xs font-semibold w-4 text-center">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.product.id, item.quantity + 1, item.presentationId)}
                          className="w-6 h-6 rounded-md bg-accent text-accent-foreground flex items-center justify-center"
                        >
                          <Plus size={12} />
                        </button>
                        <button
                          onClick={() => removeItem(item.product.id, item.presentationId)}
                          className="w-6 h-6 rounded-md flex items-center justify-center text-destructive ml-0.5"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-border px-4 py-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Subtotal</span>
              <span className="text-lg font-heading font-bold text-foreground">{formatPrice(totalPrice)}</span>
            </div>
            <button
              onClick={() => { setDrawerOpen(false); navigate("/carrito"); }}
              className="w-full btn-surte py-3 text-sm flex items-center justify-center gap-2"
            >
              Ir al Carrito
              <ArrowRight size={16} />
            </button>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

export default CartDrawer;
