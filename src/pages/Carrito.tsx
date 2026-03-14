import TopBar from "@/components/surte/TopBar";
import BottomNav from "@/components/surte/BottomNav";
import { useCart } from "@/context/CartContext";
import { useAppSettings } from "@/hooks/useStore";
import { Trash2, Minus, Plus, ShoppingCart, AlertTriangle, MessageCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(price);

const Carrito = () => {
  const { items, removeItem, updateQuantity, totalPrice, clearCart } = useCart();
  const { data: settings } = useAppSettings();
  const minOrder = Number(settings?.min_order_amount || 40000);
  const whatsappNumber = settings?.whatsapp_number || "573000000000";
  const meetsMinimum = totalPrice >= minOrder;

  const handleWhatsAppOrder = () => {
    const orderLines = items.map(
      (i) => `• ${i.quantity}x ${i.product.name} - ${formatPrice(i.product.price * i.quantity)}`
    );
    const message = `🛒 *Nuevo Pedido SURTÉ*\n\n${orderLines.join("\n")}\n\n*Total: ${formatPrice(totalPrice)}*`;
    window.open(`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`, "_blank");
  };

  return (
    <div className="min-h-screen bg-background pb-40">
      <TopBar />
      <main className="px-4 py-4">
        <h1 className="text-xl font-heading font-bold text-foreground mb-4">Tu Carrito</h1>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <ShoppingCart size={48} strokeWidth={1.2} className="mb-3 opacity-40" />
            <p className="font-heading font-semibold text-lg mb-1">Carrito vacío</p>
            <p className="text-sm">Agrega productos desde el catálogo</p>
          </div>
        ) : (
          <>
            <AnimatePresence>
              {items.map((item) => (
                <motion.div
                  key={item.product.id}
                  layout
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="flex items-center gap-3 bg-card rounded-xl p-3 mb-3"
                  style={{ boxShadow: "var(--shadow-card)" }}
                >
                  <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center shrink-0 overflow-hidden">
                    {item.product.image_url ? (
                      <img src={item.product.image_url} alt={item.product.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="text-xl font-heading font-bold text-muted-foreground/40">
                        {item.product.name.charAt(0)}
                      </span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium text-foreground truncate">{item.product.name}</h3>
                    <p className="text-xs text-muted-foreground">{item.product.unit}</p>
                    <p className="text-sm font-heading font-bold text-foreground mt-0.5">
                      {formatPrice(item.product.price * item.quantity)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQuantity(item.product.id, item.quantity - 1)} className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center text-foreground">
                      <Minus size={14} />
                    </button>
                    <span className="text-sm font-semibold w-5 text-center">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.product.id, item.quantity + 1)} className="w-7 h-7 rounded-lg bg-accent text-accent-foreground flex items-center justify-center">
                      <Plus size={14} />
                    </button>
                    <button onClick={() => removeItem(item.product.id)} className="w-7 h-7 rounded-lg flex items-center justify-center text-destructive ml-1">
                      <Trash2 size={14} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>

            {!meetsMinimum && (
              <div className="flex items-start gap-2 bg-surte-orange/10 border border-surte-orange/30 rounded-xl p-3 mb-4">
                <AlertTriangle size={18} className="text-surte-orange shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">Pedido mínimo: {formatPrice(minOrder)}</p>
                  <p className="text-xs text-muted-foreground">Te faltan {formatPrice(minOrder - totalPrice)}</p>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      {items.length > 0 && (
        <div className="fixed bottom-[68px] left-0 right-0 bg-card border-t border-border px-4 py-3 z-40" style={{ boxShadow: "var(--shadow-nav)" }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-xl font-heading font-bold text-foreground">{formatPrice(totalPrice)}</span>
          </div>
          <button
            onClick={handleWhatsAppOrder}
            disabled={!meetsMinimum}
            className={`w-full flex items-center justify-center gap-2 font-heading font-semibold py-3.5 rounded-xl text-sm transition-all ${
              meetsMinimum ? "btn-surte" : "bg-muted text-muted-foreground cursor-not-allowed"
            }`}
          >
            <MessageCircle size={18} />
            Finalizar Pedido por WhatsApp
          </button>
        </div>
      )}
      <BottomNav />
    </div>
  );
};

export default Carrito;
