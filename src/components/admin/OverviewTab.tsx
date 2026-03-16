import { Package, ShoppingCart, BarChart3, Tag } from "lucide-react";

const formatPrice = (price: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", minimumFractionDigits: 0 }).format(price);

const OverviewTab = ({ products, orders }: { products: any[]; orders: any[] }) => {
  const totalProducts = products?.length || 0;
  const totalOrders = orders?.length || 0;
  const totalRevenue = orders?.reduce((sum: number, o: any) => sum + Number(o.total), 0) || 0;
  const pendingOrders = orders?.filter((o: any) => o.status === "pendiente").length || 0;

  const stats = [
    { label: "Productos", value: totalProducts, icon: Package },
    { label: "Pedidos", value: totalOrders, icon: ShoppingCart },
    { label: "Ingresos", value: formatPrice(totalRevenue), icon: BarChart3 },
    { label: "Pendientes", value: pendingOrders, icon: Tag },
  ];

  return (
    <div className="grid grid-cols-2 gap-3">
      {stats.map(({ label, value, icon: Icon }) => (
        <div key={label} className="bg-card rounded-xl p-4" style={{ boxShadow: "var(--shadow-card)" }}>
          <Icon size={20} className="text-accent mb-2" />
          <p className="text-2xl font-heading font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      ))}
    </div>
  );
};

export default OverviewTab;
