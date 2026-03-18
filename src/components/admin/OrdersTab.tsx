import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Phone, MapPin, Clock } from "lucide-react";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(price);

const statusConfig: Record<string, { label: string; bg: string; text: string }> = {
  pendiente: { label: "Pendiente", bg: "bg-yellow-100 dark:bg-yellow-950/40", text: "text-yellow-800 dark:text-yellow-300" },
  confirmado: { label: "Confirmado", bg: "bg-blue-100 dark:bg-blue-950/40", text: "text-blue-800 dark:text-blue-300" },
  en_preparacion: { label: "Preparando", bg: "bg-orange-100 dark:bg-orange-950/40", text: "text-orange-800 dark:text-orange-300" },
  enviado: { label: "Enviado", bg: "bg-purple-100 dark:bg-purple-950/40", text: "text-purple-800 dark:text-purple-300" },
  entregado: { label: "Entregado", bg: "bg-green-100 dark:bg-green-950/40", text: "text-green-800 dark:text-green-300" },
  cancelado: { label: "Cancelado", bg: "bg-red-100 dark:bg-red-950/40", text: "text-red-800 dark:text-red-300" },
};

const OrdersTab = ({ orders, queryClient }: { orders: any[]; queryClient: any }) => {
  const statuses = ["pendiente", "confirmado", "en_preparacion", "enviado", "entregado", "cancelado"];

  const updateStatus = async (orderId: string, status: string) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
    if (error) { toast.error(error.message); return; }
    toast.success(`Estado actualizado: ${statusConfig[status]?.label || status}`);
    queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
  };

  return (
    <div>
      <h2 className="font-heading font-bold text-lg text-foreground mb-4">Pedidos ({orders?.length || 0})</h2>
      {orders?.length === 0 && (
        <div className="text-center py-12 bg-card rounded-xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">Sin pedidos aún</p>
        </div>
      )}
      <div className="space-y-3">
        {orders?.map((o: any) => {
          const sc = statusConfig[o.status] || { label: o.status, bg: "bg-muted", text: "text-muted-foreground" };
          return (
            <div key={o.id} className="bg-card rounded-xl p-4 space-y-3 border border-border">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-heading font-bold text-foreground">#{o.order_number}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${sc.bg} ${sc.text}`}>{sc.label}</span>
                  </div>
                  <p className="text-xs text-foreground font-medium mt-0.5">{o.customer_name}</p>
                </div>
                <p className="text-base font-heading font-bold text-foreground">{formatPrice(o.total)}</p>
              </div>

              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                <span className="flex items-center gap-1"><Phone size={10} /> {o.customer_phone}</span>
                {o.customer_address && <span className="flex items-center gap-1"><MapPin size={10} /> {o.customer_address}</span>}
                <span className="flex items-center gap-1"><Clock size={10} /> {new Date(o.created_at).toLocaleDateString("es-CO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
              </div>

              <div className="flex flex-wrap gap-1">
                {o.order_items?.map((item: any) => (
                  <span key={item.id} className="text-[11px] bg-muted rounded-lg px-2 py-1 font-medium">{item.quantity}× {item.product_name}</span>
                ))}
              </div>

              {o.notes && <p className="text-xs text-muted-foreground italic bg-muted/50 rounded-lg px-3 py-2">📝 {o.notes}</p>}

              <select
                value={o.status}
                onChange={(e) => updateStatus(o.id, e.target.value)}
                className="w-full bg-muted rounded-lg px-3 py-2.5 text-sm font-medium border border-transparent focus:border-accent focus:outline-none transition-colors"
              >
                {statuses.map((s) => <option key={s} value={s}>{statusConfig[s]?.label || s}</option>)}
              </select>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default OrdersTab;
