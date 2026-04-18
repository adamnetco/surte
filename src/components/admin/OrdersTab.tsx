import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Phone, MapPin, Clock, MessageCircle, Loader2, CheckCircle2, ChevronDown, Filter, CalendarIcon, Banknote, CreditCard, Sun, Moon, Wallet, AlertCircle, RotateCcw } from "lucide-react";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(price);

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  pendiente: { label: "Pendiente", bg: "bg-accent", text: "text-accent-foreground" },
  confirmado: { label: "Confirmado", bg: "bg-primary", text: "text-primary-foreground" },
  en_preparacion: { label: "Preparando", bg: "bg-secondary/80", text: "text-secondary-foreground" },
  enviado: { label: "Enviado", bg: "bg-primary/70", text: "text-primary-foreground" },
  entregado: { label: "Entregado", bg: "bg-secondary", text: "text-secondary-foreground" },
  cancelado: { label: "Cancelado", bg: "bg-destructive", text: "text-destructive-foreground" },
};

const paymentStatusConfig: Record<string, { label: string; icon: any; bg: string; text: string; emoji: string }> = {
  pendiente: { label: "Pago pendiente", icon: AlertCircle, bg: "bg-accent/15", text: "text-accent", emoji: "⏳" },
  pagado: { label: "Pagado", icon: CheckCircle2, bg: "bg-secondary/15", text: "text-secondary", emoji: "✅" },
  parcial: { label: "Pago parcial", icon: Wallet, bg: "bg-primary/15", text: "text-primary", emoji: "💰" },
  reembolsado: { label: "Reembolsado", icon: RotateCcw, bg: "bg-muted", text: "text-muted-foreground", emoji: "↩️" },
};

const categoryEmojis: Record<string, string> = {
  cárnicos: "🥩", carnicos: "🥩", pulpas: "🍏", agua: "💧", salsas: "🍯", café: "☕", zumos: "🧃",
};

const getEmoji = (name: string) => {
  const lower = name.toLowerCase();
  for (const [key, emoji] of Object.entries(categoryEmojis)) {
    if (lower.includes(key)) return emoji;
  }
  return "📦";
};

const OrdersTab = ({ orders, queryClient }: { orders: any[]; queryClient: any }) => {
  const statuses = ["pendiente", "confirmado", "en_preparacion", "enviado", "entregado", "cancelado"];
  const [sendingWhatsApp, setSendingWhatsApp] = useState<Record<string, boolean>>({});
  const [sentWhatsApp, setSentWhatsApp] = useState<Record<string, boolean>>({});
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [openPayment, setOpenPayment] = useState<Record<string, boolean>>({});
  const [paymentForm, setPaymentForm] = useState<Record<string, { status: string; amount: string; notes: string }>>({});
  const [savingPayment, setSavingPayment] = useState<Record<string, boolean>>({});

  const updateStatus = async (orderId: string, status: string) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
    if (error) { toast.error(error.message); return; }
    toast.success(`Estado actualizado: ${statusConfig[status]?.label || status}`);
    queryClient.invalidateQueries({ queryKey: ["admin-orders"] });

    // Auto-send WhatsApp on key status changes
    const order = orders?.find((o: any) => o.id === orderId);
    if (order && ["confirmado", "enviado", "entregado"].includes(status)) {
      const updatedOrder = { ...order, status };
      sendWhatsAppUpdate(updatedOrder);
    }
  };

  const sendWhatsAppUpdate = async (order: any) => {
    setSendingWhatsApp((p) => ({ ...p, [order.id]: true }));
    try {
      const sc = statusConfig[order.status] || { label: order.status };
      const statusEmoji = order.status === "pendiente" ? "🟠" : order.status === "confirmado" ? "🔵" : order.status === "en_preparacion" ? "🟡" : order.status === "enviado" ? "🟣" : order.status === "entregado" ? "🟢" : "🔴";

      const itemLines = order.order_items?.map((item: any) =>
        `${getEmoji(item.product_name)} ${item.quantity}x ${item.product_name} — ${formatPrice(item.total_price)}`
      ) || [];

      const message = [
        `📦 *SURTÉ YA - Actualización de Pedido*`,
        `_Soluciones Alimenticias | Grupo Conjuguémonos_`,
        ``,
        `Hola, *${order.customer_name}*!`,
        ``,
        `Tu pedido *#${order.order_number}* ha sido actualizado.`,
        ``,
        `*Detalle del Pedido:*`,
        ...itemLines,
        ``,
        `💰 *Total a Pagar: ${formatPrice(order.total)} COP*`,
        ``,
        order.customer_address ? `📍 *Dirección:* ${order.customer_address}` : "",
        ``,
        `${statusEmoji} *Estado: ${sc.label}*`,
        ``,
        `Gracias por confiar en La Unión y *SURTÉ YA*. 🙏`,
      ].filter(Boolean).join("\n");

      // Send via YCloud edge function
      const { data, error } = await supabase.functions.invoke("send-ycloud-whatsapp", {
        body: {
          action: "send_text",
          to: order.customer_phone,
          message,
        },
      });

      if (error) throw error;
      if (data?.error) {
        // Fallback to wa.me if YCloud not configured
        const phone = order.customer_phone.replace(/\D/g, "");
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, "_blank");
        toast.info("YCloud no configurado, abriendo WhatsApp Web");
      } else {
        toast.success("WhatsApp enviado vía YCloud ✓");
      }

      setSentWhatsApp((p) => ({ ...p, [order.id]: true }));
      setTimeout(() => setSentWhatsApp((p) => ({ ...p, [order.id]: false })), 3000);
    } catch (err: any) {
      toast.error("Error al enviar WhatsApp: " + (err.message || ""));
    } finally {
      setSendingWhatsApp((p) => ({ ...p, [order.id]: false }));
    }
  };

  const savePayment = async (orderId: string, total: number) => {
    const f = paymentForm[orderId];
    if (!f) return;
    setSavingPayment((p) => ({ ...p, [orderId]: true }));
    try {
      const amount = Number(f.amount) || 0;
      // Guard: parcial must be > 0 and < total; pagado must equal total
      let normalizedStatus = f.status;
      let normalizedAmount = amount;
      if (f.status === "pagado") normalizedAmount = total;
      if (f.status === "pendiente") normalizedAmount = 0;
      if (f.status === "parcial" && (amount <= 0 || amount >= total)) {
        toast.error("El monto parcial debe ser mayor a 0 y menor al total");
        setSavingPayment((p) => ({ ...p, [orderId]: false }));
        return;
      }
      const { error } = await supabase
        .from("orders")
        .update({
          payment_status: normalizedStatus,
          amount_paid: normalizedAmount,
          payment_notes: f.notes || null,
          payment_recorded_at: new Date().toISOString(),
        })
        .eq("id", orderId);
      if (error) { toast.error(error.message); return; }
      toast.success(`Pago registrado: ${paymentStatusConfig[normalizedStatus]?.label}`);
      setOpenPayment((p) => ({ ...p, [orderId]: false }));
      queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
    } finally {
      setSavingPayment((p) => ({ ...p, [orderId]: false }));
    }
  };

  const togglePaymentPanel = (o: any) => {
    const isOpen = !openPayment[o.id];
    setOpenPayment((p) => ({ ...p, [o.id]: isOpen }));
    if (isOpen && !paymentForm[o.id]) {
      setPaymentForm((p) => ({
        ...p,
        [o.id]: {
          status: o.payment_status || "pendiente",
          amount: String(o.amount_paid || 0),
          notes: o.payment_notes || "",
        },
      }));
    }
  };

  const filtered = (statusFilter === "all" ? orders : orders?.filter((o: any) => o.status === statusFilter))
    ?.filter((o: any) => paymentFilter === "all" || (o.payment_status || "pendiente") === paymentFilter);

  // Payment KPIs
  const totalRevenue = orders?.reduce((s: number, o: any) => s + Number(o.amount_paid || 0), 0) || 0;
  const totalPending = orders?.reduce((s: number, o: any) => {
    const ps = o.payment_status || "pendiente";
    if (ps === "pendiente" || ps === "parcial") {
      return s + Math.max(0, Number(o.total) - Number(o.amount_paid || 0));
    }
    return s;
  }, 0) || 0;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-heading font-bold text-lg text-foreground">Pedidos ({orders?.length || 0})</h2>
      </div>

      {/* Status filter chips */}
      <div className="flex gap-1.5 overflow-x-auto scrollbar-hide mb-4 pb-1">
        <button onClick={() => setStatusFilter("all")}
          className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-heading font-semibold transition-colors ${statusFilter === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
          Todos
        </button>
        {statuses.map((s) => {
          const count = orders?.filter((o: any) => o.status === s).length || 0;
          if (count === 0) return null;
          const sc = statusConfig[s];
          return (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-heading font-semibold transition-colors ${statusFilter === s ? `${sc.bg} ${sc.text}` : "bg-muted text-muted-foreground"}`}>
              {sc.label} ({count})
            </button>
          );
        })}
      </div>

      {filtered?.length === 0 && (
        <div className="text-center py-12 bg-card rounded-xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">Sin pedidos en este estado</p>
        </div>
      )}

      <div className="space-y-3">
        {filtered?.map((o: any) => {
          const sc = statusConfig[o.status] || { label: o.status, bg: "bg-muted", text: "text-muted-foreground" };
          const isSending = sendingWhatsApp[o.id];
          const isSent = sentWhatsApp[o.id];

          return (
            <div key={o.id} className="bg-card rounded-lg p-4 space-y-3 border border-border shadow-sm">
              {/* Header */}
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-heading font-bold text-foreground">#{o.order_number}</p>
                    <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-heading font-bold ${sc.bg} ${sc.text}`}>
                      {sc.label}
                    </span>
                  </div>
                  <p className="text-xs text-foreground font-medium mt-0.5">{o.customer_name}</p>
                </div>
                <p className="text-base font-heading font-bold text-primary">{formatPrice(o.total)}</p>
              </div>

              {/* Contact info */}
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><Phone size={10} /> {o.customer_phone}</span>
                {o.customer_address && <span className="flex items-center gap-1"><MapPin size={10} /> {o.customer_address}</span>}
                <span className="flex items-center gap-1">
                  <Clock size={10} />
                  {new Date(o.created_at).toLocaleDateString("es-CO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>

              {/* Items */}
              <div className="flex flex-wrap gap-1">
                {o.order_items?.map((item: any) => (
                  <span key={item.id} className="text-[11px] bg-muted rounded-lg px-2 py-1 font-medium">
                    {getEmoji(item.product_name)} {item.quantity}× {item.product_name}
                  </span>
                ))}
              </div>

              {o.notes && <p className="text-xs text-muted-foreground italic bg-muted/50 rounded-lg px-3 py-2">📝 {o.notes}</p>}

              {/* Delivery & payment info */}
              {(o.preferred_delivery_date || o.payment_method) && (
                <div className="flex flex-wrap gap-1.5">
                  {o.preferred_delivery_date && (
                    <span className="text-[11px] bg-accent/10 text-accent rounded-lg px-2 py-1 font-medium flex items-center gap-1">
                      <CalendarIcon size={10} />
                      {new Date(o.preferred_delivery_date + "T12:00:00").toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" })}
                    </span>
                  )}
                  {o.preferred_time_slot && (
                    <span className="text-[11px] bg-muted rounded-lg px-2 py-1 font-medium flex items-center gap-1">
                      {o.preferred_time_slot === "mañana" ? <Sun size={10} /> : <Moon size={10} />}
                      {o.preferred_time_slot === "mañana" ? "8-12pm" : "2-6pm"}
                    </span>
                  )}
                  {o.payment_method && (
                    <span className="text-[11px] bg-muted rounded-lg px-2 py-1 font-medium flex items-center gap-1">
                      {o.payment_method === "transferencia" ? <CreditCard size={10} /> : <Banknote size={10} />}
                      {o.payment_method === "transferencia" ? "Transferencia" : "Efectivo"}
                    </span>
                  )}
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-2">
                <select
                  value={o.status}
                  onChange={(e) => updateStatus(o.id, e.target.value)}
                  className="flex-1 bg-muted rounded-lg px-3 py-2.5 text-sm font-heading font-medium border border-transparent focus:border-primary focus:outline-none transition-colors"
                >
                  {statuses.map((s) => <option key={s} value={s}>{statusConfig[s]?.label || s}</option>)}
                </select>

                <button
                  onClick={() => sendWhatsAppUpdate(o)}
                  disabled={isSending}
                  className={`shrink-0 flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-heading font-semibold transition-all ${
                    isSent
                      ? "bg-secondary text-secondary-foreground"
                      : "bg-[#25D366] text-white hover:opacity-90 active:scale-95"
                  }`}
                >
                  {isSending ? <Loader2 size={14} className="animate-spin" /> : isSent ? <CheckCircle2 size={14} /> : <MessageCircle size={14} />}
                  {isSent ? "Enviado" : "WhatsApp"}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OrdersTab;
