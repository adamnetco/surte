import { Package, ShoppingCart, Clock, TrendingUp, Activity, AlertCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useOrganization } from "@/modules/platform/context/OrganizationContext";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(price);

const OverviewTab = ({ products, orders }: { products: any[]; orders: any[] }) => {
  const { currentOrg } = useOrganization();
  const orgId = currentOrg?.id;
  const totalProducts = products?.length || 0;
  const totalOrders = orders?.length || 0;
  const totalRevenue = orders?.reduce((sum: number, o: any) => sum + Number(o.total), 0) || 0;
  const pendingOrders = orders?.filter((o: any) => o.status === "pendiente").length || 0;
  const lowStock = products?.filter((p: any) => p.stock <= 5).length || 0;

  const [syncErrors, setSyncErrors] = useState<number | null>(null);
  useEffect(() => {
    if (!orgId) { setSyncErrors(null); return; }
    let active = true;
    (async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const { count } = await supabase
        .from("sync_logs")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("status", "error")
        .gte("last_run_at", since);
      if (active) setSyncErrors(count ?? 0);
    })();
    return () => { active = false; };
  }, [orgId]);

  const stats = [
    { label: "Productos", value: totalProducts, icon: Package, color: "text-accent" },
    { label: "Pedidos", value: totalOrders, icon: ShoppingCart, color: "text-blue-500" },
    { label: "Ingresos", value: formatPrice(totalRevenue), icon: TrendingUp, color: "text-green-500" },
    { label: "Pendientes", value: pendingOrders, icon: Clock, color: pendingOrders > 0 ? "text-yellow-500" : "text-muted-foreground" },
    { label: "Sync (24h err)", value: syncErrors ?? "—", icon: syncErrors && syncErrors > 0 ? AlertCircle : Activity, color: syncErrors && syncErrors > 0 ? "text-red-500" : "text-emerald-500" },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {stats.map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-card rounded-xl p-4 border border-border">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-8 h-8 rounded-lg bg-muted flex items-center justify-center`}>
                <Icon size={16} className={color} />
              </div>
            </div>
            <p className="text-xl font-heading font-bold text-foreground">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      {/* Low stock alert */}
      {lowStock > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800 rounded-xl p-3.5">
          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">⚠️ {lowStock} producto{lowStock > 1 ? "s" : ""} con stock bajo (≤5)</p>
          <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-0.5">Revisa la pestaña Productos para reabastecer</p>
        </div>
      )}

      {/* Recent orders */}
      {orders && orders.length > 0 && (
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Últimos pedidos</p>
          <div className="space-y-2">
            {orders.slice(0, 3).map((o: any) => (
              <div key={o.id} className="flex items-center gap-3 bg-card rounded-xl p-3 border border-border">
                <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <ShoppingCart size={14} className="text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">#{o.order_number} · {o.customer_name}</p>
                  <p className="text-[11px] text-muted-foreground">{new Date(o.created_at).toLocaleDateString("es-CO")}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-heading font-bold text-foreground">{formatPrice(o.total)}</p>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${
                    o.status === "pendiente" ? "bg-yellow-100 text-yellow-800" :
                    o.status === "entregado" ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground"
                  }`}>{o.status}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default OverviewTab;
