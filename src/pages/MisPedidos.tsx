import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/modules/auth/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import TopBar from "@/modules/storefront/components/TopBar";
import BottomNav from "@/modules/storefront/components/BottomNav";
import { Package, Clock, CheckCircle, Truck, XCircle, ChevronDown, ChevronUp, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import SeoBreadcrumbs from "@/components/seo/SeoBreadcrumbs";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(price);

const statusConfig: Record<string, { label: string; icon: any; color: string }> = {
  pendiente: { label: "Pendiente", icon: Clock, color: "text-yellow-600 bg-yellow-100" },
  confirmado: { label: "Confirmado", icon: CheckCircle, color: "text-blue-600 bg-blue-100" },
  en_preparacion: { label: "En Preparación", icon: Package, color: "text-orange-600 bg-orange-100" },
  enviado: { label: "Enviado", icon: Truck, color: "text-accent bg-accent/10" },
  entregado: { label: "Entregado", icon: CheckCircle, color: "text-green-600 bg-green-100" },
  cancelado: { label: "Cancelado", icon: XCircle, color: "text-destructive bg-destructive/10" },
};

const statusSteps = ["pendiente", "confirmado", "en_preparacion", "enviado", "entregado"];

import HeadMeta from "@/components/seo/HeadMeta";

const MisPedidos = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);

  const { data: orders, refetch } = useQuery({
    queryKey: ["my-orders", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("*, order_items(*)")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Realtime subscription for order updates
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("my-orders-realtime")
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `user_id=eq.${user.id}` }, () => {
        refetch();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, refetch]);

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground">Cargando...</p></div>;

  if (!user) {
    return (
      <div className="min-h-screen bg-background pb-20">
        <TopBar />
        <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
          <Package size={48} strokeWidth={1.2} className="text-muted-foreground/40 mb-4" />
          <h2 className="font-heading font-bold text-lg text-foreground mb-2">Inicia sesión para ver tus pedidos</h2>
          <p className="text-sm text-muted-foreground mb-6">Necesitas una cuenta para hacer seguimiento de tus pedidos</p>
          <button onClick={() => navigate("/login")} className="btn-surte px-6 py-3 text-sm">Iniciar Sesión</button>
        </div>
        <BottomNav />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopBar />
      <main className="px-4 py-4">
        <SeoBreadcrumbs items={[{ label: "Mis Pedidos" }]} className="mb-2" />
        <div className="flex items-center gap-3 mb-4">
          <button onClick={() => navigate(-1)} className="text-foreground"><ArrowLeft size={20} /></button>
          <h1 className="text-xl font-heading font-bold text-foreground">Mis Pedidos</h1>
        </div>

        {(!orders || orders.length === 0) ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Package size={48} strokeWidth={1.2} className="mb-3 opacity-40" />
            <p className="font-heading font-semibold text-lg mb-1">Sin pedidos</p>
            <p className="text-sm">Tus pedidos aparecerán aquí</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order: any) => {
              const status = statusConfig[order.status] || statusConfig.pendiente;
              const StatusIcon = status.icon;
              const isExpanded = expandedOrder === order.id;
              const currentStepIndex = statusSteps.indexOf(order.status);
              const isCancelled = order.status === "cancelado";

              return (
                <motion.div
                  key={order.id}
                  layout
                  className="bg-card rounded-xl overflow-hidden"
                  style={{ boxShadow: "var(--shadow-card)" }}
                >
                  <button
                    onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                    className="w-full p-4 flex items-center gap-3 text-left"
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${status.color}`}>
                      <StatusIcon size={20} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-heading font-bold text-foreground">Pedido #{order.order_number}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-heading font-bold text-foreground">{formatPrice(order.total)}</p>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${status.color}`}>{status.label}</span>
                    </div>
                    {isExpanded ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 space-y-4">
                          {/* Progress tracker */}
                          {!isCancelled && (
                            <div className="flex items-center gap-1">
                              {statusSteps.map((step, i) => {
                                const isCompleted = i <= currentStepIndex;
                                const stepConf = statusConfig[step];
                                return (
                                  <div key={step} className="flex-1 flex flex-col items-center gap-1">
                                    <div className={`w-full h-1.5 rounded-full ${isCompleted ? "bg-accent" : "bg-muted"}`} />
                                    <span className={`text-[9px] ${isCompleted ? "text-accent font-medium" : "text-muted-foreground"}`}>
                                      {stepConf.label}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* Order items */}
                          <div className="space-y-1.5">
                            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Productos</p>
                            {order.order_items?.map((item: any) => (
                              <div key={item.id} className="flex justify-between text-sm">
                                <span className="text-foreground">{item.quantity}x {item.product_name}</span>
                                <span className="text-muted-foreground">{formatPrice(item.total_price)}</span>
                              </div>
                            ))}
                          </div>

                          {order.notes && (
                            <div>
                              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Notas</p>
                              <p className="text-sm text-foreground">{order.notes}</p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  );
};

export default MisPedidos;