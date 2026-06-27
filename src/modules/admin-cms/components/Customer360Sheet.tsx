import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, DollarSign, Package, ShoppingCart, TrendingUp, User } from "lucide-react";

interface Props {
  profileId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

const fmtCop = (n: number) =>
  new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n || 0);

const Customer360Sheet = ({ profileId, open, onOpenChange }: Props) => {
  const { data, isLoading } = useQuery({
    queryKey: ["customer-360", profileId],
    enabled: !!profileId && open,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("customer_360", { p_profile_id: profileId! });
      if (error) throw error;
      return data as any;
    },
  });

  const { data: loyalty } = useQuery({
    queryKey: ["customer-loyalty", profileId],
    enabled: !!profileId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loyalty_accounts")
        .select("balance,points_earned,points_redeemed")
        .eq("profile_id", profileId!)
        .maybeSingle();
      if (error) return null;
      return data;
    },
  });

  const summary = data?.summary || {};
  const profile = data?.profile || {};
  const top = (data?.top_products || []) as Array<any>;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <User className="h-5 w-5" /> Ficha 360°
          </SheetTitle>
        </SheetHeader>

        {isLoading ? (
          <div className="space-y-3 mt-6">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        ) : data?.error ? (
          <p className="text-sm text-destructive mt-6">No se pudo cargar la ficha del cliente.</p>
        ) : (
          <div className="mt-6 space-y-5">
            <div className="rounded-lg border border-border p-3 bg-card">
              <div className="font-semibold">{profile.full_name || "Sin nombre"}</div>
              <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-2">
                {profile.customer_code && <span>{profile.customer_code}</span>}
                {profile.phone && <span>· {profile.phone}</span>}
                {profile.city && <span>· {profile.city}</span>}
                {profile.business_type && <Badge variant="secondary" className="text-[10px]">{profile.business_type}</Badge>}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Kpi icon={<ShoppingCart className="h-4 w-4" />} label="Compras" value={String(summary.orders_count ?? 0)} />
              <Kpi icon={<DollarSign className="h-4 w-4" />} label="LTV" value={fmtCop(Number(summary.lifetime_value || 0))} />
              <Kpi icon={<TrendingUp className="h-4 w-4" />} label="Ticket prom." value={fmtCop(Number(summary.avg_ticket || 0))} />
              <Kpi
                icon={<CalendarDays className="h-4 w-4" />}
                label="Días desde última"
                value={summary.days_since_last == null ? "—" : `${summary.days_since_last} d`}
                hint={summary.days_since_last != null && summary.days_since_last > 60 ? "Inactivo" : undefined}
              />
            </div>

            <div className="text-xs text-muted-foreground grid grid-cols-2 gap-2">
              <div>
                <div className="font-medium text-foreground">Primera compra</div>
                <div>{summary.first_purchase ? new Date(summary.first_purchase).toLocaleDateString("es-CO") : "—"}</div>
              </div>
              <div>
                <div className="font-medium text-foreground">Última compra</div>
                <div>{summary.last_purchase ? new Date(summary.last_purchase).toLocaleDateString("es-CO") : "—"}</div>
              </div>
            </div>

            {loyalty && (
              <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                <div className="text-xs font-medium text-muted-foreground">Saldo de fidelización</div>
                <div className="text-2xl font-semibold text-primary mt-0.5">
                  {Number(loyalty.balance || 0).toLocaleString("es-CO")} pts
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  Acumulados: {Number(loyalty.points_earned || 0).toLocaleString("es-CO")} · Redimidos: {Number(loyalty.points_redeemed || 0).toLocaleString("es-CO")}
                </div>
              </div>
            )}

            <div>
              <h4 className="text-sm font-semibold flex items-center gap-1 mb-2">
                <Package className="h-4 w-4" /> Top 5 productos
              </h4>
              {top.length === 0 ? (
                <p className="text-xs text-muted-foreground">Sin compras registradas.</p>
              ) : (
                <ul className="space-y-1">
                  {top.map((p) => (
                    <li key={p.product_id || p.product_name} className="flex items-center justify-between text-sm border border-border rounded p-2">
                      <span className="truncate pr-2">{p.product_name || "—"}</span>
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {Number(p.qty).toLocaleString("es-CO")} u · {fmtCop(Number(p.total))}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
};

const Kpi = ({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) => (
  <div className="rounded-lg border border-border p-2.5 bg-card">
    <div className="text-[11px] text-muted-foreground flex items-center gap-1">{icon} {label}</div>
    <div className="text-lg font-semibold mt-0.5">{value}</div>
    {hint && <Badge variant="outline" className="text-[10px] mt-1">{hint}</Badge>}
  </div>
);

export default Customer360Sheet;
