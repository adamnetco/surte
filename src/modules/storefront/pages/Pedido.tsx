import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import TopBar from "@/modules/storefront/components/TopBar";
import BottomNav from "@/modules/storefront/components/BottomNav";
import {
  Package, Clock, CheckCircle, Truck, XCircle, MessageCircle, Copy, ArrowLeft, ShoppingBag,
  Send, CreditCard, RefreshCw, CheckCheck, AlertTriangle, RotateCw, Eye,
} from "lucide-react";
import { motion } from "framer-motion";
import SeoBreadcrumbs from "@/modules/marketing/seo/SeoBreadcrumbs";
import { toast } from "sonner";
import { useAppSettings } from "@/modules/storefront/hooks/useStore";
import { useEffect, useMemo, useState } from "react";

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

// WhatsApp event mapping → icon + label + color.
const waStatusConfig: Record<string, { label: string; icon: any; color: string }> = {
  queued: { label: "WhatsApp en cola", icon: Clock, color: "text-muted-foreground" },
  sent: { label: "WhatsApp enviado", icon: Send, color: "text-green-600" },
  delivered: { label: "WhatsApp entregado", icon: CheckCheck, color: "text-green-700" },
  read: { label: "WhatsApp leído", icon: Eye, color: "text-blue-600" },
  failed: { label: "WhatsApp falló", icon: AlertTriangle, color: "text-destructive" },
  retry_requested: { label: "Reintento solicitado", icon: RotateCw, color: "text-orange-600" },
};

type WaEvent = {
  id: string;
  order_id: string | null;
  whatsapp_ref: string | null;
  status: keyof typeof waStatusConfig;
  error: string | null;
  created_at: string;
  payload: any;
};

const TIMELINE_PAGE = 20;

const dayKey = (iso: string) => new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" });

const PedidoSkeleton = () => (
  <div className="space-y-3" aria-busy="true" aria-label="Cargando pedido">
    <div className="h-20 bg-muted animate-pulse rounded-2xl" />
    <div className="h-32 bg-muted animate-pulse rounded-xl" />
    <div className="h-24 bg-muted animate-pulse rounded-xl" />
    <div className="h-40 bg-muted animate-pulse rounded-xl" />
  </div>
);

const Pedido = () => {
  const { orderNumber } = useParams();
  const navigate = useNavigate();
  const { data: settings } = useAppSettings();
  const [isRetrying, setIsRetrying] = useState(false);
  const [isPaging, setIsPaging] = useState(false);
  const [visibleCount, setVisibleCount] = useState(TIMELINE_PAGE);

  const { data: order, isLoading, refetch } = useQuery({
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

  const {
    data: waEvents = [],
    isLoading: waLoading,
    isError: waError,
    refetch: refetchEvents,
  } = useQuery({
    queryKey: ["wa-events", order?.id],
    queryFn: async () => {
      if (!order?.id) return [];
      const { data, error } = await (supabase as any)
        .from("whatsapp_message_events")
        .select("id, order_id, whatsapp_ref, status, error, created_at, payload")
        .eq("order_id", order.id)
        .order("created_at", { ascending: true })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as WaEvent[];
    },
    enabled: !!order?.id,
    retry: 1,
  });

  // Notification permission
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Realtime: orders + whatsapp_message_events
  useEffect(() => {
    if (!order?.id) return;
    const channel = supabase
      .channel(`order-${order.id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${order.id}` }, (payload) => {
        refetch();
        const newStatus = (payload.new as any)?.status;
        const conf = statusConfig[newStatus as string];
        if (conf && "Notification" in window && Notification.permission === "granted") {
          new Notification(`Pedido #${order.order_number}`, { body: `Estado actualizado: ${conf.label}`, icon: "/favicon.ico" });
        }
        if (conf) toast.success(`Estado actualizado: ${conf.label}`);
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "whatsapp_message_events", filter: `order_id=eq.${order.id}` }, (payload) => {
        refetchEvents();
        const st = (payload.new as any)?.status as keyof typeof waStatusConfig;
        const conf = waStatusConfig[st];
        if (conf) toast(conf.label, { icon: undefined });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [order?.id, order?.order_number, refetch, refetchEvents]);

  const copyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Enlace copiado");
  };

  const handleRetryWhatsApp = async () => {
    if (!order?.order_number) return;
    const reason = window.prompt(
      "Motivo del reenvío (opcional):\n— No llegó el mensaje\n— Cliente cambió número\n— Otro",
      ""
    );
    if (reason === null) return; // canceló
    setIsRetrying(true);
    try {
      const { data: userResp } = await supabase.auth.getUser().catch(() => ({ data: { user: null } as any }));
      const actor = userResp?.user;
      const { data, error } = await supabase.functions.invoke("resend-whatsapp-order", {
        body: {
          order_number: order.order_number,
          reason: reason || undefined,
          actor_id: actor?.id ?? null,
          actor_name: actor?.email ?? actor?.user_metadata?.full_name ?? "anónimo",
        },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Reenvío solicitado. Recibirás el mensaje en breve.");
      refetchEvents();
    } catch (e: any) {
      const msg = e?.message?.includes("rate_limited")
        ? "Demasiados reintentos. Espera unos minutos."
        : `No se pudo reenviar: ${e?.message ?? "error desconocido"}`;
      toast.error(msg);
    } finally {
      setIsRetrying(false);
    }
  };

  const loadMore = () => {
    setIsPaging(true);
    setTimeout(() => {
      setVisibleCount((n) => n + TIMELINE_PAGE);
      setIsPaging(false);
    }, 150);
  };

  // Build unified timeline (order milestones + WhatsApp events).
  const timeline = useMemo(() => {
    if (!order) return [] as Array<{ ts: string; icon: any; label: string; color: string; sub?: string }>;
    const status = statusConfig[order.status] || statusConfig.pendiente;
    const events: Array<{ ts: string; icon: any; label: string; color: string; sub?: string } | null> = [
      { ts: order.created_at, icon: Package, label: "Pedido recibido", color: "text-accent" },
      order.payment_recorded_at
        ? { ts: order.payment_recorded_at, icon: CreditCard, label: `Pago registrado${order.payment_method ? ` · ${order.payment_method}` : ""}`, color: "text-blue-600" }
        : null,
      order.external_sync_sent_at
        ? { ts: order.external_sync_sent_at, icon: CheckCircle, label: `Sincronizado (${order.external_sync_status || "ok"})`, color: "text-purple-600" }
        : null,
      order.updated_at && order.updated_at !== order.created_at
        ? { ts: order.updated_at, icon: status.icon, label: `Estado actual: ${status.label}`, color: status.color }
        : null,
    ];
    for (const ev of waEvents) {
      const c = waStatusConfig[ev.status];
      if (!c) continue;
      events.push({
        ts: ev.created_at,
        icon: c.icon,
        label: ev.whatsapp_ref ? `${c.label} · ${ev.whatsapp_ref.slice(0, 12)}…` : c.label,
        color: c.color,
        sub: ev.error || undefined,
      });
    }
    return events
      .filter((e): e is NonNullable<typeof e> => Boolean(e))
      .sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
  }, [order, waEvents]);

  const lastWaStatus = waEvents[waEvents.length - 1]?.status;
  const canRetry = !isRetrying && (lastWaStatus === "failed" || !lastWaStatus || lastWaStatus === "sent" || lastWaStatus === "queued");

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <TopBar />
        <main className="px-4 py-4 max-w-lg mx-auto">
          <PedidoSkeleton />
        </main>
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

  // Reverse-chrono slice for display (newest first), with pagination.
  const displayedTimeline = [...timeline].reverse().slice(0, visibleCount);
  const hasMore = timeline.length > visibleCount;

  return (
    <div className="min-h-screen bg-background pb-20">
      <TopBar />
      <main className="px-4 py-4 max-w-lg mx-auto">
        <SeoBreadcrumbs items={[{ label: "Inicio", href: "/" }, { label: `Pedido #${order.order_number}` }]} className="mb-2" />
        <button onClick={() => navigate("/")} className="flex items-center gap-1.5 text-sm text-muted-foreground mb-2 active:scale-95">
          <ArrowLeft size={14} /> Volver al inicio
        </button>

        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-6">
          <div className={`w-16 h-16 rounded-2xl ${status.bg} ${status.color} flex items-center justify-center mx-auto mb-3`}>
            <StatusIcon size={32} />
          </div>
          <h1 className="text-2xl font-heading font-bold text-foreground">Pedido #{order.order_number}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {new Date(order.created_at).toLocaleDateString("es-CO", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </p>
          <span className={`inline-block mt-2 text-xs font-semibold px-3 py-1 rounded-full ${status.bg} ${status.color}`}>{status.label}</span>
        </motion.div>

        {!isCancelled && (
          <div className="mb-6">
            <div className="flex items-center gap-1">
              {statusSteps.map((step, i) => {
                const isCompleted = i <= currentStepIndex;
                const stepConf = statusConfig[step];
                return (
                  <div key={step} className="flex-1 flex flex-col items-center gap-1">
                    <div className={`w-full h-2 rounded-full transition-colors ${isCompleted ? "bg-accent" : "bg-muted"}`} />
                    <span className={`text-[9px] text-center ${isCompleted ? "text-accent font-semibold" : "text-muted-foreground"}`}>{stepConf.label}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="bg-card rounded-xl border border-border overflow-hidden mb-4" style={{ boxShadow: "var(--shadow-card)" }}>
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
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span className="text-foreground">{formatPrice(order.subtotal || order.total)}</span></div>
            {order.delivery_price > 0 && (
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Domicilio</span><span className="text-foreground">{formatPrice(order.delivery_price)}</span></div>
            )}
            <div className="flex justify-between text-base font-heading font-bold pt-2 border-t border-border"><span className="text-foreground">Total</span><span className="text-foreground">{formatPrice(order.total)}</span></div>
          </div>
        </div>

        <div className="bg-card rounded-xl border border-border p-4 mb-4" style={{ boxShadow: "var(--shadow-card)" }}>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Datos de entrega</p>
          <p className="text-sm text-foreground font-medium">{order.customer_name}</p>
          <p className="text-sm text-muted-foreground">{order.customer_phone}</p>
          {order.customer_address && <p className="text-sm text-muted-foreground">{order.customer_address}</p>}
          {order.notes && <p className="text-sm text-muted-foreground mt-1">📝 {order.notes}</p>}
        </div>

        {/* Historial */}
        <section
          aria-label="Historial del pedido"
          data-testid="historial-block"
          className="bg-card rounded-xl border border-border p-4 mb-4"
          style={{ boxShadow: "var(--shadow-card)" }}
        >
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Historial</p>
            <div className="flex items-center gap-1">
              <button
                onClick={handleRetryWhatsApp}
                disabled={!canRetry}
                className="text-xs flex items-center gap-1 px-2 py-1 rounded-md bg-green-50 text-green-700 active:scale-95 disabled:opacity-50"
                aria-label="Reenviar WhatsApp"
                data-testid="retry-whatsapp"
              >
                <RotateCw size={12} className={isRetrying ? "animate-spin" : ""} />
                {isRetrying ? "Reintentando…" : "Reenviar WA"}
              </button>
              <button
                onClick={() => { refetch(); refetchEvents(); }}
                className="text-muted-foreground active:scale-95 p-1"
                aria-label="Refrescar historial"
                data-testid="refresh-historial"
              >
                <RefreshCw size={14} />
              </button>
            </div>
          </div>

          {waLoading && waEvents.length === 0 ? (
            <div className="space-y-2" aria-busy="true">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-8 bg-muted animate-pulse rounded" />)}
            </div>
          ) : waError ? (
            <div className="text-center py-6">
              <AlertTriangle size={24} className="mx-auto text-destructive mb-2" />
              <p className="text-sm text-muted-foreground">No se pudo cargar el historial</p>
              <button onClick={() => refetchEvents()} className="mt-2 text-xs text-accent font-medium">Reintentar</button>
            </div>
          ) : timeline.length === 0 ? (
            <div className="text-center py-6">
              <Clock size={24} strokeWidth={1.5} className="mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">Aún no hay eventos para mostrar</p>
            </div>
          ) : (
            <>
              <ol className="relative border-l border-border ml-2 space-y-3">
                {displayedTimeline.map((ev, idx) => {
                  const Icon = ev.icon;
                  return (
                    <li key={idx} className="ml-4">
                      <span className={`absolute -left-[7px] flex items-center justify-center w-3.5 h-3.5 rounded-full bg-background border-2 ${ev.color.replace("text-", "border-")}`} />
                      <div className="flex items-start gap-2">
                        <Icon size={14} className={`${ev.color} mt-0.5 flex-shrink-0`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground">{ev.label}</p>
                          {ev.sub && <p className="text-[11px] text-destructive break-words">{ev.sub}</p>}
                          <p className="text-[11px] text-muted-foreground">
                            {new Date(ev.ts).toLocaleString("es-CO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
              {hasMore && (
                <button
                  onClick={() => setVisibleCount((n) => n + TIMELINE_PAGE)}
                  className="mt-3 w-full text-xs text-accent font-medium py-2 rounded-md bg-accent/5"
                >
                  Ver más ({timeline.length - visibleCount} restantes)
                </button>
              )}
            </>
          )}
        </section>

        <div className="space-y-2">
          <a
            href={`https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`Hola, quiero consultar sobre mi pedido #${order.order_number}`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center justify-center gap-2 bg-green-600 hover:bg-green-700 text-white font-heading font-semibold py-3.5 rounded-xl text-sm transition-colors"
          >
            <MessageCircle size={18} /> Contactar por WhatsApp
          </a>
          <button onClick={copyLink} className="w-full flex items-center justify-center gap-2 bg-muted text-foreground font-medium py-3 rounded-xl text-sm">
            <Copy size={16} /> Copiar enlace de seguimiento
          </button>
          <button onClick={() => navigate("/catalogo")} className="w-full flex items-center justify-center gap-2 bg-accent/10 text-accent font-medium py-3 rounded-xl text-sm">
            <ShoppingBag size={16} /> Seguir comprando
          </button>
        </div>
      </main>
      <BottomNav />
    </div>
  );
};

export default Pedido;
