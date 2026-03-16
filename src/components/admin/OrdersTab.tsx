import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(price);

const statusColors: Record<string, string> = {
  pendiente: "bg-yellow-100 text-yellow-800",
  confirmado: "bg-blue-100 text-blue-800",
  en_preparacion: "bg-orange-100 text-orange-800",
  enviado: "bg-purple-100 text-purple-800",
  entregado: "bg-green-100 text-green-800",
  cancelado: "bg-red-100 text-red-800",
};

const OrdersTab = ({ orders, queryClient }: { orders: any[]; queryClient: any }) => {
  const statuses = ["pendiente", "confirmado", "en_preparacion", "enviado", "entregado", "cancelado"];

  const updateStatus = async (orderId: string, status: string) => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
    if (error) { toast.error(error.message); return; }
    toast.success(`Pedido actualizado a: ${status}`);
    queryClient.invalidateQueries({ queryKey: ["admin-orders"] });
  };

  return (
    <div>
      <h2 className="font-heading font-bold text-lg text-foreground mb-4">Pedidos ({orders?.length || 0})</h2>
      {orders?.length === 0 && <p className="text-center py-8 text-muted-foreground">Sin pedidos aún</p>}
      <div className="space-y-3">
        {orders?.map((o: any) => (
          <div key={o.id} className="bg-card rounded-xl p-4 space-y-2" style={{ boxShadow: "var(--shadow-card)" }}>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-heading font-bold text-foreground">Pedido #{o.order_number}</p>
                <p className="text-xs text-muted-foreground">{o.customer_name} · {o.customer_phone}</p>
                {o.customer_address && <p className="text-xs text-muted-foreground">📍 {o.customer_address}</p>}
              </div>
              <span className="text-sm font-heading font-bold text-foreground">{formatPrice(o.total)}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {o.order_items?.map((item: any) => (
                <span key={item.id} className="text-xs bg-muted rounded-full px-2 py-0.5">{item.quantity}x {item.product_name}</span>
              ))}
            </div>
            {o.notes && <p className="text-xs text-muted-foreground italic">📝 {o.notes}</p>}
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[o.status] || "bg-muted text-muted-foreground"}`}>
                {o.status}
              </span>
              <select value={o.status} onChange={(e) => updateStatus(o.id, e.target.value)} className="flex-1 bg-muted rounded-lg px-3 py-2 text-sm">
                {statuses.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <p className="text-xs text-muted-foreground">{new Date(o.created_at).toLocaleString("es-CO")}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

export default OrdersTab;
