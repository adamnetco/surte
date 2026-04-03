import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import TopBar from "@/components/surte/TopBar";
import BottomNav from "@/components/surte/BottomNav";
import { useCart } from "@/context/CartContext";
import { useAppSettings } from "@/hooks/useStore";
import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Trash2, Minus, Plus, ShoppingCart, AlertTriangle, MessageCircle, Loader2, MapPin, ExternalLink } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { trackPurchase } from "@/components/seo/Analytics";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(price);

const Carrito = () => {
  const { items, removeItem, updateQuantity, totalPrice, clearCart } = useCart();
  const { data: settings } = useAppSettings();
  const { user } = useAuth();
  const navigate = useNavigate();
  const minOrder = Number(settings?.min_order_amount || 40000);
  const meetsMinimum = totalPrice >= minOrder;
  const [submitting, setSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", phone: "", address: "", notes: "", neighborhood_id: "" });
  const [deliveryCost, setDeliveryCost] = useState(0);

  const { data: shippingZones } = useQuery({
    queryKey: ["shipping-zones"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shipping_zones").select("*").eq("is_active", true).order("city").order("neighborhood");
      if (error) throw error;
      return data;
    },
  });

  const handleZoneChange = (zoneId: string) => {
    setForm({ ...form, neighborhood_id: zoneId });
    const zone = shippingZones?.find((z: any) => z.id === zoneId);
    setDeliveryCost(zone ? Number(zone.delivery_price) : 0);
  };

  const handleFinalize = () => {
    if (!meetsMinimum) return;
    if (!user) {
      toast.info("Inicia sesión para hacer tu pedido");
      navigate("/login");
      return;
    }
    // Pre-fill from user metadata
    setForm({
      name: user.user_metadata?.full_name || "",
      phone: user.user_metadata?.phone || "",
      address: "",
      notes: "",
      neighborhood_id: "",
    });
    setShowForm(true);
  };

  const handleSubmitOrder = async () => {
    if (!form.name || !form.phone) {
      toast.error("Nombre y teléfono son obligatorios");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        items: items.map((i) => ({
          product_id: i.product.id,
          name: i.product.name,
          price: i.product.price,
          quantity: i.quantity,
        })),
        customer_name: form.name,
        customer_phone: form.phone,
        customer_address: form.address,
        notes: form.notes,
      };

      const { data, error } = await supabase.functions.invoke("send-whatsapp-order", {
        body: payload,
      });

      if (error) throw new Error(error.message || "Error de conexión al procesar pedido");
      if (data?.error) throw new Error(data.error);

      // Track purchase conversion
      trackPurchase(data.order_number, totalPrice, payload.items);

      toast.success(`¡Pedido #${data.order_number} creado!`);

      // Build WhatsApp message
      const whatsappNumber = settings?.whatsapp_number || "573000000000";
      const trackingUrl = `${window.location.origin}/pedido/${data.order_number}`;
      const orderLines = items.map(
        (i) => `• ${i.quantity}x ${i.product.name} — ${formatPrice(i.product.price * i.quantity)}`
      );
      const whatsappMsg = [
        `🛒 *Pedido SURTÉ #${data.order_number}*`,
        "",
        `👤 ${form.name}`,
        `📱 ${form.phone}`,
        form.address ? `📍 ${form.address}` : "",
        form.notes ? `📝 ${form.notes}` : "",
        "",
        ...orderLines,
        "",
        `💰 *Total: ${formatPrice(totalPrice)}*`,
        "",
        `📦 Seguimiento: ${trackingUrl}`,
      ].filter(Boolean).join("\n");

      const waUrl = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(whatsappMsg)}`;
      
      clearCart();
      setShowForm(false);

      // Open WhatsApp so customer confirms with the store
      window.open(waUrl, "_blank");

      // Navigate to tracking page
      navigate(`/pedido/${data.order_number}`);
    } catch (err: any) {
      toast.error(err.message || "Error al crear pedido");
    } finally {
      setSubmitting(false);
    }
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
              <div className="flex items-start gap-2 bg-surte-naranja/10 border border-surte-naranja/30 rounded-xl p-3 mb-4">
                <AlertTriangle size={18} className="text-surte-naranja shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-foreground">Pedido mínimo: {formatPrice(minOrder)}</p>
                  <p className="text-xs text-muted-foreground">Te faltan {formatPrice(minOrder - totalPrice)}</p>
                </div>
              </div>
            )}

            {/* Order Form */}
            <AnimatePresence>
              {showForm && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  className="bg-card rounded-xl p-4 mb-4 space-y-3"
                  style={{ boxShadow: "var(--shadow-card)" }}
                >
                  <h3 className="font-heading font-semibold text-sm text-foreground">Datos del Pedido</h3>
                  <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Nombre completo *" className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm outline-none" required />
                  <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="WhatsApp (ej: 573001234567) *" className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm outline-none" required />
                  <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Dirección de entrega" className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm outline-none" />
                  {shippingZones && shippingZones.length > 0 && (
                    <div>
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <MapPin size={14} className="text-accent" />
                        <span className="text-xs font-medium text-muted-foreground">Zona de entrega</span>
                      </div>
                      <select value={form.neighborhood_id} onChange={(e) => handleZoneChange(e.target.value)} className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm outline-none">
                        <option value="">Seleccionar barrio...</option>
                        {["Bucaramanga", "Floridablanca", "Girón", "Piedecuesta"].map(city => {
                          const cityZones = shippingZones.filter((z: any) => z.city === city);
                          if (cityZones.length === 0) return null;
                          return (
                            <optgroup key={city} label={city}>
                              {cityZones.map((z: any) => (
                                <option key={z.id} value={z.id}>
                                  {z.neighborhood} — {formatPrice(z.delivery_price)}
                                </option>
                              ))}
                            </optgroup>
                          );
                        })}
                      </select>
                      {deliveryCost > 0 && (
                        <p className="text-xs text-accent font-medium mt-1">Domicilio: {formatPrice(deliveryCost)}</p>
                      )}
                    </div>
                  )}
                  <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Notas adicionales" className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm outline-none" rows={2} />
                  <div className="flex gap-2">
                    <button onClick={() => setShowForm(false)} className="flex-1 bg-muted rounded-xl py-2.5 text-sm text-muted-foreground font-medium">Cancelar</button>
                    <button onClick={handleSubmitOrder} disabled={submitting} className="flex-1 btn-surte py-2.5 text-sm flex items-center justify-center gap-2 disabled:opacity-50">
                      {submitting ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />}
                      {submitting ? "Enviando..." : "Confirmar"}
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </main>

      {items.length > 0 && !showForm && (
        <div className="fixed bottom-[68px] left-0 right-0 bg-card border-t border-border px-4 py-3 z-40" style={{ boxShadow: "var(--shadow-nav)" }}>
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm text-muted-foreground">Subtotal</span>
            <span className="text-sm font-medium text-foreground">{formatPrice(totalPrice)}</span>
          </div>
          {deliveryCost > 0 && (
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm text-muted-foreground">Domicilio</span>
              <span className="text-sm font-medium text-foreground">{formatPrice(deliveryCost)}</span>
            </div>
          )}
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-foreground">Total</span>
            <span className="text-xl font-heading font-bold text-foreground">{formatPrice(totalPrice + deliveryCost)}</span>
          </div>
          <button
            onClick={handleFinalize}
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