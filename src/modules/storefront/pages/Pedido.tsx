import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import TopBar from "@/modules/storefront/components/TopBar";
import BottomNav from "@/modules/storefront/components/BottomNav";
import { Package, Clock, CheckCircle, Truck, XCircle, MessageCircle, Copy, ArrowLeft, ShoppingBag } from "lucide-react";
import { motion } from "framer-motion";
import SeoBreadcrumbs from "@/modules/marketing/seo/SeoBreadcrumbs";
import { toast } from "sonner";
import { useAppSettings } from "@/modules/storefront/hooks/useStore";
import { useEffect } from "react";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(price);

const statusConfig: Record<string, { label: string; icon: any; color: string; bg: string }> = {
  pendiente: { label: "Pendiente", icon: Clock, color: "text-yellow-600", bg: "bg-yellow-100" },
  confirmado: { label: "Confirmado", icon: CheckCircle, color: "text-blue-600", bg: "bg-blue-100" },
  en_preparacion: { label: "En Preparación", icon: Package, color: "text-orange-600", bg: "bg-orange-100" },
  enviado: { label: "Enviado", icon: Truck, color: "text-accent", bg: "bg-accent/10" },
  entregado: { label: "Entregado", icon: CheckCircle, color: "text-green-600", bg: "bg-green-100" },
  cancelado: { label: "Cancelado", icon: XCircle, color: "text-destructive", bg: "bg-destructive/10" },
};

const statusSteps = ["pendiente", "confirmado", "en_preparacion", "enviado", "entregado"];

const Pedido = () => {
  const { orderNumber } = useParams();
  const { data: settings } = useAppSettings();

  const { data: order, isLoading, isError, refetch } = useQuery({
    queryKey: ["public-order", orderNumber],
    queryFn: async () => {
      const num = parseInt(orderNumber || "0");
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("order_number", num)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!orderNumber,
    retry: false,
  });

  // Request notification permission
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Realtime updates with push notification
  useEffect(() => {
    if (!order?.id) return;
    const channel = supabase
      .channel(`order-${order.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${order.id}` }, (payload) => {
        refetch();
        const newStatus = payload.new?.status;
        const conf = statusConfig[newStatus as string];
        if (conf && "Notification" in window && Notification.permission === "granted") {
          new Notification(`Pedido #${order.order_number}`, {
            body: `Estado actualizado: ${conf.label}`,
            icon: "/favicon.ico",
          });
        }
        if (conf) {
          toast.success(`Estado actualizado: ${conf.label}`);
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [order?.id, order?.order_number, refetch]);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Enlace copiado");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <TopBar />
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-8 h-8 border-2 border-accent border-t-transparent rounded-full" />
        </div>
        <BottomNav />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background">
        <TopBar />
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <Package size={48} strokeWidth={1.2} className="text-muted-foreground/40 mb-4" />
          <h2 className="font-heading font-bold text-lg text-foreground mb-2">Pedido no encontrado</h2>
          <p className="text-sm text-muted-foreground">Verifica el número de pedido</p>
        </div>
        <BottomNav />
      </div>
    );
  }

  const status = statusConfig[order.status] || statusConfig.pendiente;
  const StatusIcon = status.icon;
  const currentStepIndex = statusSteps.indexOf(order.status);
  const isCancelled = order.status === "cancelado";
  const whatsappNumber = settings?.whatsapp_number || "573000000000";

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopBar />
      <main className="px-4 py-4 max-w-lg mx-auto">
        <SeoBreadcrumbs items={[{ label: "Inicio", href: "/" }, { label: `Pedido #${order.order_number}` }]} className="mb-2" />
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-1.5 text-sm text-muted-foreground mb-2 active:scale-95"
        >
          <ArrowLeft size={14} /> Volver al inicio
        </button>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-6"
        >
          <div className={`w-16 h-16 rounded-2xl ${status.bg} ${status.color} flex items-center justify-center mx-auto mb-3`}>
            <StatusIcon size={32} />
          </div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Pedido #{order.order_number}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {new Date(order.created_at).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </p>
          <span className={`inline-block mt-2 text-xs font-semibold px-3 py-1 rounded-full ${status.bg} ${status.color}`}>
            {status.label}
          </span>
        </motion.div>

        {/* Progress tracker */}
        {!isCancelled && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="mb-6"
          >
            <div className="flex items-center gap-1">
              {statusSteps.map((step, i) => {
                const isCompleted = i <= currentStepIndex;
                const stepConf = statusConfig[step];
                return (
                  <div key={step} className="flex-1 flex flex-col items-center gap-1">
                    <div className={`w-full h-2 rounded-full transition-colors ${isCompleted ? "bg-accent" : "bg-muted"}`} />
                    <span className={`text-[9px] text-center ${isCompleted ? "text-accent font-semibold" : "text-muted-foreground"}`}>
                      {stepConf.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Order details */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-card rounded-xl border border-border overflow-hidden mb-4"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <div className="p-4 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Productos</p>
            <div className="space-y-2">
              {order.order_items?.map((item: any) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-foreground">{item.quantity}x {item.product_name}</span>
                  <span className="font-medium text-foreground">{formatPrice(item.total_price)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span className="text-foreground">{formatPrice(order.subtotal || order.total)}</span>
            </div>
            {order.delivery_price > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Domicilio</span>
                <span className="text-foreground">{formatPrice(order.delivery_price)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-heading font-bold pt-2 border-t border-border">
              <span className="text-foreground">Total</span>
              <span className="text-foreground">{formatPrice(order.total)}</span>
            </div>
          </div>
        </motion.div>

        {/* Customer info */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-card rounded-xl border border-border p-4 mb-4"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Datos de entrega</p>
          <p className="text-sm text-foreground font-medium">{order.customer_name}</p>
          <p className="text-sm text-muted-foreground">{order.customer_phone}</p>
          {order.customer_address && <p className="text-sm text-muted-foreground">{order.customer_address}</p>}
          {order.notes && <p className="text-sm text-muted-foreground mt-1">📝 {order.notes}</p>}
        </motion.div>

        {/* Actions */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25 }}
          className="space-y-2"
        >
          <a
            href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`Hola, quiero consultar sobre mi pedido #${order.order_number}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-heading font-semibold py-3.5 rounded-xl text-sm transition-colors"
          >
            <MessageCircle size={18} /> Contactar por WhatsApp
          </a>
          <button
            onClick={copyLink}
            className="w-full flex items-center justify-center gap-2 bg-muted text-foreground font-medium py-3 rounded-xl text-sm"
          >
            <Copy size={16} /> Copiar enlace de seguimiento
          </button>
          <button
            onClick={() => navigate("/catalogo")}
            className="w-full flex items-center justify-center gap-2 bg-accent/10 text-accent font-medium py-3 rounded-xl text-sm"
          >
            <ShoppingBag size={16} /> Seguir comprando
          </button>
        </motion.div>
      </main>
      <BottomNav />
    </div>
  );
};

export default Pedido;
